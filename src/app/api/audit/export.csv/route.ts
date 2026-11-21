import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/ensure-seed";
import { requireSession } from "@/lib/auth";
import { ESTADO_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function diffMin(a: Date | null, b: Date | null): string {
  if (!a || !b) return "";
  return String(Math.round((b.getTime() - a.getTime()) / 60000));
}

// GET /api/audit/export.csv — reporte de estados de entrega y tiempos.
// No incluye notas médicas ni datos clínicos (LFPDPPP).
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ["ADMIN", "MEDICO"]);
  if (auth.response) return auth.response;
  await ensureSeeded();
  const studies = await prisma.study.findMany({
    include: { patient: { select: { nombreCompleto: true, municipio: true } } },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "estudio_id", "paciente", "municipio", "fecha_toma", "sede_muestra",
    "estado", "estado_legible", "creado_en", "autorizado_en", "notificado_en",
    "entregado_en", "modo_entrega", "sede_entrega", "entregado_por",
    "minutos_carga_a_autorizacion", "minutos_autorizacion_a_entrega",
  ];

  const rows = studies.map((s) => [
    s.id,
    s.patient.nombreCompleto,
    s.patient.municipio,
    s.fechaToma,
    s.sede,
    s.estado,
    ESTADO_LABELS[s.estado] ?? s.estado,
    s.createdAt.toISOString(),
    s.autorizadoAt?.toISOString() ?? "",
    s.notificadoAt?.toISOString() ?? "",
    s.entregadoAt?.toISOString() ?? "",
    s.entregadoModo ?? "",
    s.sedeEntrega ?? "",
    s.entregadoPor ?? "",
    diffMin(s.createdAt, s.autorizadoAt),
    diffMin(s.autorizadoAt ?? s.notificadoAt, s.entregadoAt),
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eira-reporte-entregas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
