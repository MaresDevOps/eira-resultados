import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// POST /api/studies/[id]/authorize  { notaMedico?, prioritario? } — MEDICO/ADMIN
// prioritario=true  -> REQUIERE_CONTACTO_MEDICO (bloquea descarga automática)
// prioritario=false -> AUTORIZADO_PARA_ENTREGA
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, ["MEDICO", "ADMIN"]);
  if (auth.response) return auth.response;
  const session = auth.session;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const notaMedico = String(body.notaMedico ?? "").trim() || null;
  const prioritario = body.prioritario === true;

  const study = await prisma.study.findUnique({ where: { id }, include: { patient: true } });
  if (!study) return NextResponse.json({ error: "Estudio no encontrado." }, { status: 404 });
  if (study.estado !== ESTADOS.EN_REVISION_CLINICA && study.estado !== ESTADOS.CARGADO) {
    return NextResponse.json({ error: `No se puede autorizar un estudio en estado ${study.estado}.` }, { status: 409 });
  }

  const nuevoEstado = prioritario ? ESTADOS.REQUIERE_CONTACTO_MEDICO : ESTADOS.AUTORIZADO_PARA_ENTREGA;
  const updated = await prisma.study.update({
    where: { id },
    data: { estado: nuevoEstado, notaMedico, autorizadoAt: new Date() },
    include: { patient: true },
  });

  await audit({
    actorName: session.nombreCompleto, role: session.role,
    action: prioritario ? "AUTORIZACION_PRIORITARIA" : "AUTORIZACION_CLINICA",
    patientId: study.patientId, studyId: id,
    detail: prioritario
      ? "Seguimiento prioritario: requiere llamada médica, enlace de descarga bloqueado"
      : notaMedico ? `Nota interna: ${notaMedico}` : "Sin nota interna",
    req,
  });

  return NextResponse.json({ study: updated });
}
