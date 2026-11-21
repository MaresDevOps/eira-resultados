import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { revokeAccessToken } from "@/lib/cache";
import { ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const RAZONES = ["identidad_incorrecta", "fallo_envio", "otro"];

// POST /api/studies/[id]/revoke — MEDICO/ADMIN
// Body: { reason: "identidad_incorrecta"|"fallo_envio"|"otro", reasonDetail?, newPatientId? }
// - Invalida de inmediato el token efímero en Valkey/memoria.
// - Sin reasignación: estado -> REVOCADO_POR_CORRECCION.
// - Con newPatientId: reasigna el PDF al expediente correcto y vuelve a
//   EN_REVISION_CLINICA (cambió el paciente: exige nueva revisión clínica).
// Ambos casos quedan en la bitácora de forma inmutable.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, ["MEDICO", "ADMIN"]);
  if (auth.response) return auth.response;
  const session = auth.session;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "");
  const reasonDetail = String(body.reasonDetail ?? "").trim() || null;
  const newPatientId = String(body.newPatientId ?? "").trim() || null;

  if (!RAZONES.includes(reason)) {
    return NextResponse.json({ error: "Motivo inválido." }, { status: 400 });
  }

  const study = await prisma.study.findUnique({ where: { id }, include: { patient: true } });
  if (!study) return NextResponse.json({ error: "Estudio no encontrado." }, { status: 404 });
  if (study.estado === ESTADOS.REVOCADO_POR_CORRECCION && !newPatientId) {
    return NextResponse.json({ error: "El estudio ya está revocado; indica un expediente para reasignar." }, { status: 409 });
  }

  // Invalida el token vigente de inmediato (caché efímera).
  if (study.tokenId) await revokeAccessToken(study.tokenId);

  let newPatient = null;
  if (newPatientId) {
    if (newPatientId === study.patientId) {
      return NextResponse.json({ error: "El expediente indicado es el mismo del estudio." }, { status: 400 });
    }
    newPatient = await prisma.patient.findUnique({ where: { id: newPatientId } });
    if (!newPatient) return NextResponse.json({ error: "Expediente de destino no encontrado." }, { status: 404 });
  }

  const motivo = `${reason}${reasonDetail ? `: ${reasonDetail}` : ""}`;
  const data: Record<string, unknown> = {
    tokenId: null,
    estado: newPatient ? ESTADOS.EN_REVISION_CLINICA : ESTADOS.REVOCADO_POR_CORRECCION,
  };
  if (newPatient) data.patientId = newPatient.id;
  const updated = await prisma.study.update({ where: { id }, data, include: { patient: true } });

  await audit({
    actorName: session.nombreCompleto, role: session.role,
    action: newPatient ? "REASIGNACION_PACIENTE" : "ACCESO_REVOCADO",
    patientId: newPatient ? newPatient.id : study.patientId, studyId: id,
    detail: newPatient
      ? `Revocado (${motivo}); PDF reasignado de ${study.patient.nombreCompleto} a ${newPatient.nombreCompleto}; vuelve a revisión clínica`
      : `Acceso revocado (${motivo}); token invalidado`,
    req,
  });

  return NextResponse.json({ study: updated });
}
