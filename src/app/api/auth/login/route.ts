import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ensureSeeded } from "@/lib/ensure-seed";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/login  { email, password }
export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  const session = { id: user.id, email: user.email, nombreCompleto: user.nombreCompleto, role: user.role as never };
  const token = await createSessionToken(session);
  const res = NextResponse.json({ user: session });
  setSessionCookie(res, token);

  await audit({
    actorName: user.nombreCompleto, role: user.role, action: "LOGIN",
    detail: `Sesión iniciada (${user.email})`, req,
  });
  return res;
}
