import { NextResponse } from "next/server";
import { buildSimplePdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// GET /api/utils/sample-pdf — PDF sintético de prueba descargable.
export async function GET() {
  const pdf = buildSimplePdf([
    "Paciente: DEMO-0000",
    "Estudio: Prueba de usabilidad EIRA",
    "Este documento es SINTETICO y no contiene informacion clinica real.",
    "Sirve para validar el flujo de carga, revision, notificacion y entrega.",
    "Fecha de generacion: " + new Date().toISOString().slice(0, 10),
  ]);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=pdf-prueba-eira.pdf",
    },
  });
}
