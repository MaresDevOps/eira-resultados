import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findUnique({ where: { studyId: id } });
  if (!receipt) return NextResponse.json({ error: "Sin acuse de entrega" }, { status: 404 });
  const study = await prisma.study.findUnique({ where: { id }, include: { patient: true } });
  return NextResponse.json({ receipt, study });
}
