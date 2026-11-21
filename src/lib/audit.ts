import { prisma } from "./db";
import { getSession } from "./auth";
import type { NextRequest } from "next/server";

export async function audit(entry: {
  actorName: string;
  role: string;
  action: string;
  patientId?: string | null;
  studyId?: string | null;
  detail?: string | null;
  req?: NextRequest | Request;
}) {
  try {
    let ip = "desconocida";
    let userId: string | null = null;
    let email: string | null = null;
    if (entry.req) {
      const h = entry.req.headers;
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
      const session = await getSession(entry.req as NextRequest);
      userId = session?.id ?? null;
      email = session?.email ?? null;
    }
    await prisma.auditLog.create({
      data: {
        actorName: entry.actorName,
        role: entry.role,
        userId,
        email,
        action: entry.action,
        patientId: entry.patientId ?? null,
        studyId: entry.studyId ?? null,
        detail: entry.detail ?? null,
        ip,
      },
    });
  } catch (e) {
    console.error("audit error", e);
  }
}
