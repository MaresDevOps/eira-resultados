import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PDF_DIR = path.join(process.cwd(), "storage", "pdfs");

// Stream del PDF SOLO a través del backend autenticado (bucket privado simulado).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const study = await prisma.study.findUnique({ where: { id } });
  if (!study) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const safe = path.basename(study.pdfPath);
  const file = await readFile(path.join(PDF_DIR, safe)).catch(() => null);
  if (!file) return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="resultado-${study.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
