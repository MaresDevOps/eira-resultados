import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAccessToken, registerOtpFail, otpAttemptsLeft, clearOtpTries, grantDownloadTicket } from "@/lib/cache";
import { ensureSeeded } from "@/lib/ensure-seed";
import { OTP_INTENTOS_MAX, ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function findBlocked(token: string) {
  const left = await otpAttemptsLeft(token);
  return left <= 0;
}

// GET: estado del token (sin exponer datos clínicos)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  await ensureSeeded();
  const { token } = await ctx.params;
  const payload = await getAccessToken(token);
  if (!payload) {
    const blocked = await findBlocked(token);
    return NextResponse.json({ ok: false, reason: blocked ? "blocked" : "expired_or_used" }, { status: 410 });
  }
  const left = await otpAttemptsLeft(token);
  if (left <= 0) {
    return NextResponse.json({ ok: false, reason: "blocked" }, { status: 429 });
  }
  const study = await prisma.study.findUnique({ where: { id: payload.studyId }, include: { patient: true } });
  if (!study) return NextResponse.json({ ok: false, reason: "expired_or_used" }, { status: 410 });
  if (study.estado === ESTADOS.REQUIERE_CONTACTO_MEDICO) {
    return NextResponse.json({ ok: false, reason: "requiere_contacto" }, { status: 200 });
  }

  const primerNombre = study.patient.nombreCompleto.split(" ")[0];
  return NextResponse.json({
    ok: true,
    nombre: primerNombre,
    sede: study.sede,
    intentosRestantes: left,
  });
}

// POST: verificación con PIN/OTP (4 dígitos) O fecha de nacimiento.
// Máximo 3 intentos fallidos -> bloqueo del token.
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  await ensureSeeded();
  const { token } = await ctx.params;
  const payload = await getAccessToken(token);
  if (!payload) {
    const blocked = await findBlocked(token);
    return NextResponse.json({ ok: false, reason: blocked ? "blocked" : "expired_or_used" }, { status: 410 });
  }

  const study = await prisma.study.findUnique({ where: { id: payload.studyId }, include: { patient: true } });
  if (!study) return NextResponse.json({ ok: false, reason: "expired_or_used" }, { status: 410 });
  if (study.estado === ESTADOS.REQUIERE_CONTACTO_MEDICO) {
    return NextResponse.json({ ok: false, reason: "requiere_contacto" }, { status: 200 });
  }

  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "").replace(/\D/g, "");

  // Normaliza la fecha de nacimiento a ISO (yyyy-mm-dd); acepta
  // dd/mm/aaaa y dd-mm-aaaa por si la paciente la escribe a mano.
  const normFecha = (v: string): string => {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return s;
  };
  const fechaNac = normFecha(String(body.fechaNacimiento ?? ""));

  const pinOk = pin.length === 4 && pin === payload.otp;
  const fechaOk = fechaNac !== "" && fechaNac === study.patient.fechaNacimiento;

  if (!pinOk && !fechaOk) {
    const fails = await registerOtpFail(token);
    const left = Math.max(0, OTP_INTENTOS_MAX - fails);
    await audit({
      actorName: "Paciente (anónimo)", role: "PACIENTE", action: "ACCESO_FALLIDO",
      patientId: study.patientId, studyId: study.id,
      detail: `Intento fallido de verificación (${fails}/${OTP_INTENTOS_MAX})`,
      req,
    });
    if (left <= 0) {
      return NextResponse.json({ ok: false, reason: "blocked", intentosRestantes: 0 }, { status: 429 });
    }
    return NextResponse.json({ ok: false, reason: "invalid", intentosRestantes: left }, { status: 401 });
  }

  await clearOtpTries(token);
  await grantDownloadTicket(token, study.id);
  await audit({
    actorName: study.patient.nombreCompleto, role: "PACIENTE", action: "ACCESO_VERIFICADO",
    patientId: study.patientId, studyId: study.id,
    detail: pinOk ? "Verificación por código PIN" : "Verificación por fecha de nacimiento",
    req,
  });

  return NextResponse.json({
    ok: true,
    downloadUrl: `/api/public/token/${token}/pdf`,
    pdfSha256: study.pdfSha256,
    folio: study.folio,
  });
}
