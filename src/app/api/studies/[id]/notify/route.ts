import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { createAccessToken, cacheBackend } from "@/lib/cache";
import { notifyResultAvailable } from "@/services/notificationService";
import { ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function otpFor(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return String(Math.floor(1000 + Math.random() * 9000));
}

function appBase(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

// POST /api/studies/[id]/notify — MEDICO/ADMIN
// AUTORIZADO_PARA_ENTREGA -> NOTIFICADO. Token efímero (15 min) + OTP.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, ["MEDICO", "ADMIN"]);
  if (auth.response) return auth.response;
  const session = auth.session;

  const { id } = await ctx.params;
  const study = await prisma.study.findUnique({ where: { id }, include: { patient: true } });
  if (!study) return NextResponse.json({ error: "Estudio no encontrado." }, { status: 404 });
  if (study.estado !== ESTADOS.AUTORIZADO_PARA_ENTREGA) {
    return NextResponse.json({ error: `El estudio no está listo para notificar (estado: ${study.estado}).` }, { status: 409 });
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const otp = otpFor(study.patient.telefono);
  await createAccessToken(token, { studyId: id, patientId: study.patientId, otp });

  const link = `${appBase(req)}/acceso/${token}`;

  const updated = await prisma.study.update({
    where: { id },
    data: { estado: ESTADOS.NOTIFICADO, tokenId: token, notificadoAt: new Date() },
    include: { patient: true },
  });

  const notif = await notifyResultAvailable({
    studyId: id,
    toPhone: study.patient.telefono,
    toEmail: study.patient.email,
    link,
    otp,
  });
  const mensaje = notif.results[0]?.body ?? "";

  await audit({
    actorName: session.nombreCompleto, role: session.role, action: "NOTIFICACION_ENVIADA",
    patientId: study.patientId, studyId: id,
    detail: `Token efímero (TTL 15 min) · proveedor ${notif.provider} · sin datos clínicos en el mensaje`,
    req,
  });

  return NextResponse.json({
    study: updated,
    token,
    link,
    otp, // en producción NO se mostraría; aquí es parte del simulador de demo
    mensaje,
    proveedor: notif.provider,
    resultados: notif.results,
    backend: await cacheBackend(),
    expiraEn: "15 minutos",
  });
}
