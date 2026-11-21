import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { ensureSeeded } from "@/lib/ensure-seed";
import { STAFF_ROLES, type Role } from "@/lib/constants";

export const dynamic = "force-dynamic";

// POST /api/auth/register { nombreCompleto, email, password, role }
// Demo: registro abierto. En producción esto lo haría solo un ADMIN.
export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));
  const nombreCompleto = String(body.nombreCompleto ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = String(body.role ?? "") as Role;

  if (!nombreCompleto || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Nombre y correo válidos son obligatorios." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (!STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
  }

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) return NextResponse.json({ error: "Ese correo ya está registrado." }, { status: 409 });

  const user = await prisma.user.create({
    data: { nombreCompleto, email, passwordHash: hashPassword(password), role },
  });

  const session = { id: user.id, email: user.email, nombreCompleto: user.nombreCompleto, role: user.role as never };
  const token = await createSessionToken(session);
  const res = NextResponse.json({ user: session }, { status: 201 });
  setSessionCookie(res, token);

  await audit({
    actorName: nombreCompleto, role, action: "REGISTRO_USUARIO",
    detail: `Alta de personal (${email}, ${role})`, req,
  });
  return res;
}
