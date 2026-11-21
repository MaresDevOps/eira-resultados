import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { buildSimplePdf } from "./pdf";
import { createAccessToken } from "./cache";
import { hashPassword } from "./auth";

export const DEMO_PASSWORD = "demo1234";

const DEMO_USERS = [
  { email: "lab@eira.org.mx", nombreCompleto: "Capturista EIRA (demo)", role: "LABORATORIO" },
  { email: "dra.martinez@eira.org.mx", nombreCompleto: "Dra. Mariana Martínez (demo)", role: "MEDICO" },
  { email: "promotora@eira.org.mx", nombreCompleto: "Promotora EIRA (demo)", role: "PROMOTORA" },
  { email: "admin@eira.org.mx", nombreCompleto: "Administradora EIRA (demo)", role: "ADMIN" },
];

export function makeFolio(seedN = 0): string {
  const alnum = crypto.randomBytes(3).toString("hex").slice(0, 4).toUpperCase();
  return `EIRA-${new Date().getFullYear()}-${alnum}${seedN}`;
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Seed compartido: lo usan `npm run seed` (CLI) y `src/instrumentation.ts` (boot del servidor).
// Cuando corre dentro del servidor, el token del estudio NOTIFICADO queda en la
// misma caché efímera (Valkey o memoria) que usan las rutas API.

const PDF_DIR = path.join(process.cwd(), "storage", "pdfs");

export const PACIENTES_SEED = [
  { nombreCompleto: "María Fernanda López Hernández", curp: "LOHM940315MDFRRN09", fechaNacimiento: "1994-03-15", telefono: "5512340001", municipio: "Tlalpan", email: "mafe.lopez@example.com" },
  { nombreCompleto: "Ana Patricia González Ruiz", curp: "GORP880722HDFRRL04", fechaNacimiento: "1988-07-22", telefono: "5587650002", municipio: "Iztapalapa", email: "ana.gonzalez@example.com" },
  { nombreCompleto: "Guadalupe Ramírez Torres", curp: "RATG760901MJCNRL08", fechaNacimiento: "1976-09-01", telefono: "5544330003", municipio: "Ecatepec", email: null },
  { nombreCompleto: "Carmen Elizabeth Flores Díaz", curp: "FLED910512MRCRND02", fechaNacimiento: "1991-05-12", telefono: "5599880004", municipio: "Toluca", email: "carmen.flores@example.com" },
  { nombreCompleto: "Rosa María Jiménez Castro", curp: "JICR830226MJCNSL01", fechaNacimiento: "1983-02-26", telefono: "5566770005", municipio: "Cuernavaca", email: null },
  { nombreCompleto: "Verónica Salazar Mendoza", curp: "SAMV950819HDFSRR06", fechaNacimiento: "1995-08-19", telefono: "5533220006", municipio: "Zapopan", email: "vero.salazar@example.com" },
  // Caso práctico oficial "Tamizaje Rosa" (ficticios): Ana lista para demostrar el
  // flujo de autorización; Sofía con hallazgo que exige contacto clínico prioritario.
  { nombreCompleto: "Ana Ejemplo", curp: "EJEA900101MJCNCA90", fechaNacimiento: "1990-01-01", telefono: "3411099001", municipio: "Ciudad Guzmán, Jalisco", email: "ana.ejemplo@example.com" },
  { nombreCompleto: "Sofía Ejemplo", curp: "EJES920202MJCNCB91", fechaNacimiento: "1992-02-02", telefono: "3411099002", municipio: "Ciudad Guzmán, Jalisco", email: "sofia.ejemplo@example.com" },
];

export async function runSeed(prisma: PrismaClient) {
  const existentes = await prisma.patient.count();
  if (existentes > 0) {
    console.log(`[seed] Omitido: ya existen ${existentes} pacientes.`);
    return { seeded: false };
  }

  await mkdir(PDF_DIR, { recursive: true });

  // Usuarios de staff para la demo (misma contraseña documentada en README)
  const pass = hashPassword(DEMO_PASSWORD);
  await Promise.all(
    DEMO_USERS.map((u) => prisma.user.create({ data: { ...u, passwordHash: pass } }))
  );

  const patients = await Promise.all(PACIENTES_SEED.map((p) => prisma.patient.create({ data: p })));

  const pdf1 = buildSimplePdf([
    "Estudio: Citologia cervical (Papanicolaou)",
    "Resultado: muestra satisfactoria para evaluacion",
    "Observaciones: sin datos de alarma en este documento sintetico.",
    "NOTA: documento de demostracion, no es un reporte clinico real.",
  ]);
  const pdf2 = buildSimplePdf([
    "Estudio: Citologia cervical (Papanicolaou)",
    "Resultado: muestra satisfactoria para evaluacion",
    "Observaciones: control recomendado segun protocolo EIRA.",
    "NOTA: documento de demostracion, no es un reporte clinico real.",
  ]);
  await writeFile(path.join(PDF_DIR, "seed-1.pdf"), pdf1);
  await writeFile(path.join(PDF_DIR, "seed-2.pdf"), pdf2);
  const h1 = sha256(pdf1);
  const h2 = sha256(pdf2);

  const ahora = new Date();
  const hace = (min: number) => new Date(ahora.getTime() - min * 60000);

  const s1 = await prisma.study.create({
    data: {
      patientId: patients[0].id, estado: "EN_REVISION_CLINICA",
      fechaToma: "2026-11-10", sede: "Clínica Móvil Tecámac",
      pdfPath: "seed-1.pdf", pdfSha256: h1, folio: makeFolio(1), createdAt: hace(180), updatedAt: hace(180),
    },
  });
  const s2 = await prisma.study.create({
    data: {
      patientId: patients[1].id, estado: "AUTORIZADO_PARA_ENTREGA",
      fechaToma: "2026-11-12", sede: "Unidad EIRA Iztapalapa",
      pdfPath: "seed-2.pdf", pdfSha256: h2, folio: makeFolio(2), notaMedico: "Verificado: datos completos, sin observaciones.",
      autorizadoAt: hace(60), createdAt: hace(300), updatedAt: hace(60),
    },
  });
  const token3 = crypto.randomBytes(24).toString("base64url");
  const otp3 = patients[2].telefono.slice(-4);
  const link3 = `/acceso/${token3}`;
  const s3 = await prisma.study.create({
    data: {
      patientId: patients[2].id, estado: "NOTIFICADO",
      fechaToma: "2026-11-08", sede: "Campaña Cuautitlán",
      pdfPath: "seed-2.pdf", pdfSha256: h2, folio: makeFolio(3), tokenId: token3,
      notificadoAt: hace(20), createdAt: hace(400), updatedAt: hace(20),
    },
  });
  // Token real en la caché efímera (solo efectivo si el seed corre dentro del servidor;
  // si corre por CLI, la paciente puede usar "Solicitar reenvío" desde la pantalla de bloqueo).
  await createAccessToken(token3, { studyId: s3.id, patientId: patients[2].id, otp: otp3 });
  await prisma.simulatedMessage.create({
    data: {
      studyId: s3.id, toPhone: patients[2].telefono, channel: "SMS_SIMULADO",
      body: `EIRA Movimiento Rosa: Tu resultado médico ya está disponible. Ábrelo de forma segura aquí: ${link3} con tu PIN de 4 dígitos (${otp3}). Por tu privacidad, este mensaje no incluye información clínica.`,
      otpCode: otp3,
    },
  });
  const s4 = await prisma.study.create({
    data: {
      patientId: patients[3].id, estado: "ENTREGADO_ASISTIDO",
      fechaToma: "2026-11-05", sede: "Clínica Móvil Tecámac",
      pdfPath: "seed-1.pdf", pdfSha256: h1, folio: makeFolio(4), entregadoAt: hace(30), entregadoModo: "ASISTIDO_SEDE",
      sedeEntrega: "Clínica Móvil Tecámac", entregadoPor: "Promotora EIRA (demo)",
      createdAt: hace(500), updatedAt: hace(30),
    },
  });
  await prisma.receipt.create({
    data: { studyId: s4.id, patientId: patients[3].id, sede: "Clínica Móvil Tecámac", deliveredBy: "Promotora EIRA (demo)", observations: "Entrega física con lectura asistida." },
  });
  await prisma.study.create({
    data: {
      patientId: patients[4].id, estado: "CARGADO",
      fechaToma: "2026-11-18", sede: "Unidad EIRA Cuernavaca",
      pdfPath: "seed-2.pdf", pdfSha256: h2, folio: makeFolio(5), createdAt: hace(15), updatedAt: hace(15),
    },
  });
  // Ana Ejemplo — listo para demostrar el caso práctico de la guía (autorización + notificación).
  const s6 = await prisma.study.create({
    data: {
      patientId: patients[6].id, estado: "EN_REVISION_CLINICA",
      fechaToma: "2026-11-16", sede: "Sede EIRA Ciudad Guzmán",
      pdfPath: "seed-1.pdf", pdfSha256: h1, folio: makeFolio(6), createdAt: hace(90), updatedAt: hace(90),
    },
  });
  // Sofía Ejemplo — hallazgo clínico prioritario: bloquea descarga automática y exige
  // que una médica de EIRA contacte a la paciente (nota interna, nunca expuesta en SMS/paciente).
  const s7 = await prisma.study.create({
    data: {
      patientId: patients[7].id, estado: "REQUIERE_CONTACTO_MEDICO",
      fechaToma: "2026-11-14", sede: "Sede EIRA Ciudad Guzmán",
      pdfPath: "seed-2.pdf", pdfSha256: h2, folio: makeFolio(7),
      notaMedico: "Hallazgo que requiere contacto clínico prioritario — tarea interna EIRA.",
      autorizadoAt: hace(45), createdAt: hace(360), updatedAt: hace(45),
    },
  });

  const logs = [
    ["Capturista EIRA (demo)", "LABORATORIO", "ESTUDIO_CARGADO", patients[0].id, s1.id, "PDF cargado · muestra 2026-11-10 · Clínica Móvil Tecámac"],
    ["Médico Revisor (demo)", "MEDICO", "ESTUDIO_CARGADO", patients[1].id, s2.id, "PDF cargado · muestra 2026-11-12"],
    ["Médico Revisor (demo)", "MEDICO", "AUTORIZACION_CLINICA", patients[1].id, s2.id, "Sin nota interna"],
    ["Capturista EIRA (demo)", "LABORATORIO", "NOTIFICACION_ENVIADA", patients[2].id, s3.id, "Token efímero (TTL 15 min) · SMS simulado"],
    ["Promotora EIRA (demo)", "PROMOTORA", "ENTREGA_ASISTIDA_SEDE", patients[3].id, s4.id, "Entrega física / lectura asistida en Clínica Móvil Tecámac"],
    ["Capturista EIRA (demo)", "LABORATORIO", "ESTUDIO_CARGADO", patients[6].id, s6.id, "PDF cargado · Tamizaje Rosa · Ciudad Guzmán"],
    ["Dra. Mariana Martínez (demo)", "MEDICO", "AUTORIZACION_PRIORITARIA", patients[7].id, s7.id, "Requiere llamada médica previa a la paciente"],
  ] as const;
  for (const [actorName, role, action, patientId, studyId, detail] of logs) {
    await prisma.auditLog.create({
      data: { actorName, role, action, patientId, studyId, detail, ip: "seed-local" },
    });
  }

  console.log("[seed] Completado: 8 pacientes (incl. Ana/Sofía Ejemplo — Tamizaje Rosa), 7 estudios, 2 PDFs.");
  console.log(`[seed] Link paciente ya notificado: /acceso/${token3}`);
  return { seeded: true };
}
