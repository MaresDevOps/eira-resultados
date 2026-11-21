import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// POST /api/studies/[id]/deliver — PROMOTORA/ADMIN
// Entrega asistida en sede. También marca entregados los estudios en
// REQUIERE_CONTACTO_MEDICO (la promotora confirma que el contacto se realizó).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, ["PROMOTORA", "ADMIN"]);
  if (auth.response) return auth.response;
  const session = auth.session;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const sede = String(body.sede ?? "").trim();
  const observations = String(body.observations ?? "").trim() || null;

  if (!sede) return NextResponse.json({ error: "La sede de entrega es obligatoria." }, { status: 400 });

  const study = await prisma.study.findUnique({ where: { id }, include: { patient: true } });
  if (!study) return NextResponse.json({ error: "Estudio no encontrado." }, { status: 404 });
  const entregables = [
    ESTADOS.AUTORIZADO_PARA_ENTREGA,
    ESTADOS.NOTIFICADO,
    ESTADOS.EN_REVISION_CLINICA,
    ESTADOS.REQUIERE_CONTACTO_MEDICO,
  ];
  if (!entregables.includes(study.estado as never)) {
    return NextResponse.json({ error: `No se puede entregar un estudio en estado ${study.estado}.` }, { status: 409 });
  }

  const updated = await prisma.study.update({
    where: { id },
    data: {
      estado: ESTADOS.ENTREGADO_ASISTIDO,
      entregadoAt: new Date(),
      entregadoModo: "ASISTIDO_SEDE",
      sedeEntrega: sede,
      entregadoPor: session.nombreCompleto,
    },
    include: { patient: true },
  });

  const receipt = await prisma.receipt.create({
    data: {
      studyId: id,
      patientId: study.patientId,
      sede,
      deliveredBy: session.nombreCompleto,
      observations,
    },
  });

  await audit({
    actorName: session.nombreCompleto, role: session.role, action: "ENTREGA_ASISTIDA_SEDE",
    patientId: study.patientId, studyId: id,
    detail: `Entrega física / lectura asistida en ${sede}`,
    req,
  });

  return NextResponse.json({ study: updated, receipt }, { status: 201 });
}
