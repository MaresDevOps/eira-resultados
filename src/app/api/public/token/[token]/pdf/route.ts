import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAccessToken, getDownloadTicket, consumeAccessToken } from "@/lib/cache";
import { ensureSeeded } from "@/lib/ensure-seed";
import { ESTADOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PDF_DIR = path.join(process.cwd(), "storage", "pdfs");

// Descarga del PDF: exige token vigente + ticket de verificación + un solo uso.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  await ensureSeeded();
  const { token } = await ctx.params;
  const payload = await getAccessToken(token);
  const ticketStudy = await getDownloadTicket(token);
  if (!payload || !ticketStudy || ticketStudy !== payload.studyId) {
    return NextResponse.json({ error: "Sesión no verificada o expirada." }, { status: 401 });
  }

  const study = await prisma.study.findUnique({ where: { id: payload.studyId }, include: { patient: true } });
  if (!study) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const safe = path.basename(study.pdfPath);
  const file = await readFile(path.join(PDF_DIR, safe)).catch(() => null);
  if (!file) return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });

  // Un solo uso: consumimos el token al descargar.
  await consumeAccessToken(token, payload);
  if (study.estado === ESTADOS.NOTIFICADO || study.estado === ESTADOS.AUTORIZADO_PARA_ENTREGA) {
    await prisma.study.update({
      where: { id: study.id },
      data: { estado: ESTADOS.DESCARGADO_PACIENTE, entregadoAt: new Date(), entregadoModo: "DIGITAL_PACIENTE" },
    });
  }
  await audit({
    actorName: study.patient.nombreCompleto, role: "PACIENTE", action: "RESULTADO_DESCARGADO",
    patientId: study.patientId, studyId: study.id,
    detail: "Descarga digital del PDF por la paciente (token de un solo uso)",
    req: _req,
  });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resultado-EIRA-${study.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
