import { NextRequest, NextResponse } from "next/server";
import { cacheBackend } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/ensure-seed";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  await ensureSeeded();
  const [patients, studies, logs] = await Promise.all([
    prisma.patient.count(),
    prisma.study.count(),
    prisma.auditLog.count(),
  ]);
  return NextResponse.json({
    ok: true,
    backend_cache: await cacheBackend(),
    conteos: { pacientes: patients, estudios: studies, eventos_auditoria: logs },
  });
}
