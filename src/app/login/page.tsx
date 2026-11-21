"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_ACCOUNTS = [
  { label: "Capturista / Laboratorio", email: "lab@eira.org.mx", color: "bg-sky-600" },
  { label: "Dra. Martínez / Médico", email: "dra.martinez@eira.org.mx", color: "bg-emerald-600" },
  { label: "Promotora / Entrega", email: "promotora@eira.org.mx", color: "bg-violet-600" },
  { label: "Admin (todo + bitácora)", email: "admin@eira.org.mx", color: "bg-slate-700" },
];
const DEMO_PASS = "demo1234";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds ?? { email, password }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json();
      setErr(d.error ?? "Error al iniciar sesión.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--rosa-claro)] to-white px-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <img src="/brand/logo-eira.jpg" alt="EIRA" className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
          <h1 className="text-3xl font-black text-slate-900">EIRA Movimiento Rosa</h1>
          <p className="text-slate-600">Programa Tamizaje Rosa · Entrega digital segura de resultados</p>
        </div>

        <form onSubmit={login} className="card space-y-4">
          <h2 className="text-xl font-black">Iniciar sesión</h2>
          <div>
            <label className="label">Correo institucional</label>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@eira.org.mx" />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{err}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
          <p className="text-center text-sm">
            ¿Personal nuevo? <a className="font-bold text-[var(--rosa)] underline" href="/register">Regístrate aquí</a>
          </p>
        </form>

        <div className="card border-dashed">
          <p className="mb-2 text-center text-sm font-bold text-slate-500">Acceso Rápido de Demostración (1 clic)</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={(e) => login(e, { email: a.email, password: DEMO_PASS })}
                disabled={busy}
                className={`${a.color} rounded-xl px-3 py-3 text-sm font-bold text-white hover:opacity-90 active:scale-[0.98]`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">Usuarios ficticios del seed · contraseña demo</p>
        </div>

        <p className="text-center text-xs leading-relaxed text-slate-400">
          EIRA, Movimiento Rosa A.C. · Ciudad Guzmán, Jalisco · Datos 100% ficticios
        </p>
      </div>
    </div>
  );
}
