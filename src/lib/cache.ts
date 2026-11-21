// Capa de "caché efímera": usa Valkey/Redis real si VALKEY_URL está definido,
// si no, cae a un store en memoria con la misma semántica (TTL + delete).
// ioredis se importa dinámicamente SOLO cuando hay VALKEY_URL configurada:
// así el bundle nunca incluye módulos de Node ('stream', etc.) en edge/memoria.
// Nunca lanza por indisponibilidad: la demo no debe fallar.
//
// IMPORTANTE: el store vive en globalThis porque Next.js puede instanciar el
// módulo una vez por ruta en dev (los tokens deben compartirse entre rutas).

import type Redis from "ioredis";
import { DOWNLOAD_TTL_SEG, OTP_INTENTOS_MAX, TOKEN_TTL_SEG } from "./constants";

type Entry = { value: string; expiresAt: number };
type MemStore = Map<string, Entry>;

const g = globalThis as unknown as {
  __eiraMem?: MemStore;
  __eiraSweep?: NodeJS.Timeout;
  __eiraRedis?: Redis | null;
  __eiraRedisTried?: boolean;
};

const memory = (g.__eiraMem ??= new Map());

function ensureSweep() {
  if (!g.__eiraSweep) {
    g.__eiraSweep = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k);
    }, 30_000);
    if (g.__eiraSweep.unref) g.__eiraSweep.unref();
  }
}

function memGet(key: string): string | null {
  const e = memory.get(key);
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return e.value;
}

function memSet(key: string, value: string, ttlSec: number) {
  ensureSweep();
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

// --- Redis real (Valkey), carga perezosa y singleton global ---
async function getRedis(): Promise<Redis | null> {
  const url = process.env.VALKEY_URL ?? process.env.REDIS_URL;
  if (!url) return null;
  if (g.__eiraRedisTried) return g.__eiraRedis ?? null;
  g.__eiraRedisTried = true;
  try {
    const { default: RedisCtor } = await import("ioredis");
    const client = new RedisCtor(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      retryStrategy: () => null,
    });
    client.on("error", () => {
      g.__eiraRedis = null;
    });
    await client.connect();
    g.__eiraRedis = client;
  } catch {
    g.__eiraRedis = null;
  }
  return g.__eiraRedis ?? null;
}

export async function cacheBackend(): Promise<"valkey" | "memoria"> {
  return (await getRedis()) ? "valkey" : "memoria";
}

// ---- API mínima ----

async function rawSet(key: string, value: string, ttlSec: number) {
  const r = await getRedis();
  if (r) {
    try {
      await r.set(key, value, "EX", ttlSec);
      return;
    } catch {
      g.__eiraRedis = null;
    }
  }
  memSet(key, value, ttlSec);
}

async function rawGet(key: string): Promise<string | null> {
  const r = await getRedis();
  if (r) {
    try {
      return await r.get(key);
    } catch {
      g.__eiraRedis = null;
    }
  }
  return memGet(key);
}

async function rawDel(key: string) {
  const r = await getRedis();
  if (r) {
    try {
      await r.del(key);
      return;
    } catch {
      g.__eiraRedis = null;
    }
  }
  memory.delete(key);
}

async function rawIncr(key: string, ttlSec: number): Promise<number> {
  const r = await getRedis();
  if (r) {
    try {
      const n = await r.incr(key);
      if (n === 1) await r.expire(key, ttlSec);
      return n;
    } catch {
      g.__eiraRedis = null;
    }
  }
  const cur = memGet(key);
  const n = cur ? parseInt(cur, 10) + 1 : 1;
  memSet(key, String(n), ttlSec);
  return n;
}

// ---- Dominio: tokens de acceso, OTP y tickets de descarga ----

export interface AccessTokenPayload {
  studyId: string;
  patientId: string;
  otp: string;
  used: boolean;
  createdAt: number;
}

const tokenKey = (t: string) => `eira:token:${t}`;
const otpTryKey = (t: string) => `eira:otptry:${t}`;
const dlKey = (t: string) => `eira:dl:${t}`;

export async function createAccessToken(token: string, payload: Omit<AccessTokenPayload, "used" | "createdAt">) {
  await rawSet(
    tokenKey(token),
    JSON.stringify({ ...payload, used: false, createdAt: Date.now() } satisfies AccessTokenPayload),
    TOKEN_TTL_SEG
  );
}

export async function getAccessToken(token: string): Promise<AccessTokenPayload | null> {
  const raw = await rawGet(tokenKey(token));
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as AccessTokenPayload;
    return p.used ? null : p;
  } catch {
    return null;
  }
}

export async function consumeAccessToken(token: string, payload: AccessTokenPayload) {
  await rawSet(tokenKey(token), JSON.stringify({ ...payload, used: true }), TOKEN_TTL_SEG);
}

export async function registerOtpFail(token: string): Promise<number> {
  return rawIncr(otpTryKey(token), TOKEN_TTL_SEG);
}

export async function otpAttemptsLeft(token: string): Promise<number> {
  const raw = await rawGet(otpTryKey(token));
  const used = raw ? parseInt(raw, 10) : 0;
  return Math.max(0, OTP_INTENTOS_MAX - used);
}

export async function grantDownloadTicket(token: string, studyId: string) {
  await rawSet(dlKey(token), studyId, DOWNLOAD_TTL_SEG);
}

export async function getDownloadTicket(token: string): Promise<string | null> {
  return rawGet(dlKey(token));
}

export async function clearOtpTries(token: string) {
  await rawDel(otpTryKey(token));
}

// Revocación: invalida de inmediato token, intentos OTP y ticket de descarga.
export async function revokeAccessToken(token: string) {
  await rawDel(tokenKey(token));
  await rawDel(otpTryKey(token));
  await rawDel(dlKey(token));
}
