import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createAccessToken } from "@/lib/cache";
import { ensureSeeded } from "@/lib/ensure-seed";
import { notifyResultAvailable, buildSmsBody } from "@/services/notificationService";
import { ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function otpFor(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return String(Math.floor(1000 + Math.random() * 9000));
}

// POST /api/public/token/[token]/resend
// "Solicitar reenvío" desde la pantalla de bloqueo de la paciente.
// Genera un token nuevo (el anterior expira por TTL de todos modos).
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  await ensureSeeded();
  const { token } = await ctx.params;

  // Recuperamos el studyId del token viejo si aún existe; si no, no hay a quién reenviar.
  const { getAccessToken } = await import("@/lib/cache");
  const old = await getAccessToken(token);
  let studyId = old?.studyId;

  if (!studyId) {
    // fallback: buscar estudio cuyo tokenId coincida (token ya consumido pero vigente en BD)
    const study = await prisma.study.findFirst({ where: { tokenId: token } });
    studyId = study?.id;
  }
  if (!studyId) return NextResponse.json({ error: "No se encontró un resultado asociado a este enlace." }, { status: 404 });

  const study = await prisma.study.findUnique({ where: { id: studyId }, include: { patient: true } });
  if (!study) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (study.estado === ESTADOS.REQUIERE_CONTACTO_MEDICO) {
    return NextResponse.json({ ok: false, reason: "requiere_contacto" }, { status: 200 });
  }
  if (study.estado === ESTADOS.DESCARGADO_PACIENTE || study.estado === ESTADOS.ENTREGADO_ASISTIDO) {
    return NextResponse.json({ error: "Este resultado ya fue entregado." }, { status: 409 });
  }

  const newToken = crypto.randomBytes(24).toString("base64url");
  const otp = otpFor(study.patient.telefono);
  await createAccessToken(newToken, { studyId: study.id, patientId: study.patientId, otp });
  await prisma.study.update({ where: { id: study.id }, data: { tokenId: newToken, estado: ESTADOS.NOTIFICADO, notificadoAt: new Date() } });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const link = `${base}/acceso/${newToken}`;
  await notifyResultAvailable({
    studyId: study.id,
    toPhone: study.patient.telefono,
    toEmail: study.patient.email,
    link,
    otp,
  });
  const mensaje = buildSmsBody(link);

  await audit({
    actorName: "Paciente (anónimo)", role: "PACIENTE", action: "REENVIO_SOLICITADO",
    patientId: study.patientId, studyId: study.id,
    detail: "La paciente solicitó reenvío desde pantalla de bloqueo; nuevo token generado",
    req,
  });

  return NextResponse.json({ token: newToken, link, otp, mensaje });
}
