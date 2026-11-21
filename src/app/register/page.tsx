"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "LABORATORIO", label: "Laboratorio / Capturista EIRA" },
  { value: "MEDICO", label: "Médico / Revisión Clínica" },
  { value: "PROMOTORA", label: "Promotora / Entrega Asistida" },
  { value: "ADMIN", label: "Administradora / Acceso total" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nombreCompleto: "", email: "", password: "", password2: "", role: "LABORATORIO" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (form.password !== form.password2) {
      setErr("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErr(d.error ?? "No se pudo registrar.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const f = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--rosa-claro)] to-white px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <img src="/brand/logo-eira.jpg" alt="EIRA" className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
          <h1 className="text-3xl font-black text-slate-900">Registro de personal</h1>
          <p className="text-slate-600">EIRA Movimiento Rosa · Portal interno</p>
        </div>

        <form onSubmit={registrar} className="card space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={form.nombreCompleto} onChange={(e) => f("nombreCompleto", e.target.value)} />
          </div>
          <div>
            <label className="label">Correo institucional</label>
            <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => f("email", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Contraseña (mín. 8)</label>
              <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => f("password", e.target.value)} />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input className="input" type="password" autoComplete="new-password" value={form.password2} onChange={(e) => f("password2", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.role} onChange={(e) => f("role", e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {err && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{err}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Registrando…" : "Crear cuenta e iniciar sesión"}
          </button>
          <p className="text-center text-sm">
            ¿Ya tienes cuenta? <a className="font-bold text-[var(--rosa)] underline" href="/login">Inicia sesión</a>
          </p>
        </form>
      </div>
    </div>
  );
}
