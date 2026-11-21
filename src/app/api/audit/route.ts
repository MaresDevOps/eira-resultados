import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/ensure-seed";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ["ADMIN", "MEDICO"]);
  if (auth.response) return auth.response;
  await ensureSeeded();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10) || 100, 500);
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return NextResponse.json({ logs });
}
