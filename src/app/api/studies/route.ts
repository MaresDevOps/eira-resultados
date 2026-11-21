import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { ensureSeeded } from "@/lib/ensure-seed";
import { ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PDF_DIR = path.join(process.cwd(), "storage", "pdfs");

function makeFolio(): string {
  return `EIRA-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
}

// GET /api/studies?estado=NOTIFICADO  (solo personal autenticado)
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  await ensureSeeded();
  const estado = req.nextUrl.searchParams.get("estado");
  const studies = await prisma.study.findMany({
    where: estado ? { estado } : undefined,
    include: { patient: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ studies });
}

// POST /api/studies  (multipart: file, patientId, fechaToma, sede) — LABORATORIO/ADMIN
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, ["LABORATORIO", "ADMIN"]);
  if (auth.response) return auth.response;
  const session = auth.session;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const patientId = String(form.get("patientId") ?? "");
  const fechaToma = String(form.get("fechaToma") ?? "");
  const sede = String(form.get("sede") ?? "");

  if (!file || !patientId || !fechaToma || !sede) {
    return NextResponse.json({ error: "Faltan datos: PDF, paciente, fecha de toma y sede son obligatorios." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "El archivo no es un PDF válido." }, { status: 400 });
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });

  const digest = crypto.createHash("sha256").update(buf).digest("hex");

  const study = await prisma.study.create({
    data: {
      patientId,
      estado: ESTADOS.EN_REVISION_CLINICA,
      fechaToma,
      sede,
      pdfPath: "",
      pdfSha256: digest,
      folio: makeFolio(),
    },
    include: { patient: true },
  });

  await mkdir(PDF_DIR, { recursive: true });
  const filename = `${study.id}.pdf`;
  await writeFile(path.join(PDF_DIR, filename), buf);
  await prisma.study.update({ where: { id: study.id }, data: { pdfPath: filename } });

  await audit({
    actorName: session.nombreCompleto, role: session.role, action: "ESTUDIO_CARGADO",
    patientId, studyId: study.id,
    detail: `PDF cargado (sha256 ${digest.slice(0, 12)}…) · folio ${study.folio} · muestra ${fechaToma} · sede ${sede}`,
    req,
  });

  return NextResponse.json({ study: { ...study, pdfPath: filename } }, { status: 201 });
}
