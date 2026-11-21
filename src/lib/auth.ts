// Autenticación de personal EIRA: bcrypt para contraseñas + JWT en cookie httpOnly.
// Sin dependencias de librerías de sesión pesadas: `jose` funciona en Node y Edge.

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SEG, STAFF_ROLES, type Role } from "./constants";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "eira-dev-secret-cambiar-en-produccion"
);

export interface SessionUser {
  id: string;
  email: string;
  nombreCompleto: string;
  role: Role;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, nombreCompleto: user.nombreCompleto, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEG}s`)
    .sign(secret);
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0",
    path: "/",
    maxAge: SESSION_TTL_SEG,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(req: NextRequest | Request): Promise<SessionUser | null> {
  let token: string | undefined;
  if ("cookies" in req) {
    token = (req as NextRequest).cookies.get(SESSION_COOKIE)?.value;
  } else {
    const header = req.headers.get("cookie") ?? "";
    token = header
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.split("=")[1];
  }
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.role) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      nombreCompleto: String(payload.nombreCompleto ?? ""),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

// Guard para Route Handlers: devuelve la sesión o una respuesta 401/403 lista.
export async function requireSession(
  req: NextRequest,
  roles?: Role[]
): Promise<{ session: SessionUser; response?: never } | { session?: never; response: NextResponse }> {
  const session = await getSession(req);
  if (!session) {
    return { response: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  const allowed = roles ?? STAFF_ROLES;
  if (!allowed.includes(session.role)) {
    return { response: NextResponse.json({ error: "Sin permiso para esta acción." }, { status: 403 }) };
  }
  return { session };
}
