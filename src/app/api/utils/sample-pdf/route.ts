import { NextResponse } from "next/server";
import { buildResultPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// GET /api/utils/sample-pdf — PDF sintético de prueba descargable.
export async function GET() {
  const pdf = buildResultPdf({
    folio: "EIRA-" + new Date().getFullYear() + "-DEMO",
    paciente: "PACIENTE DE PRUEBA (FICTICIA)",
    curp: "XXXX000000XXXXXXXX",
    fechaNacimiento: "1990-01-01",
    municipio: "Ciudad Guzmán, Jalisco",
    sede: "Sede EIRA Ciudad Guzmán",
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=resultado-EIRA-demo.pdf",
    },
  });
}
