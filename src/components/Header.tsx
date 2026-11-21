"use client";

import { useRouter } from "next/navigation";

export type Vista = "panel" | "bitacora" | "bandeja";

export interface SessionUser {
  id: string;
  email: string;
  nombreCompleto: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  LABORATORIO: "Laboratorio / Capturista",
  MEDICO: "Médico / Revisión Clínica",
  PROMOTORA: "Promotora / Entrega Asistida",
  ADMIN: "Administradora",
};

export function Header({
  user,
  vista,
  setVista,
  verBitacora,
}: {
  user: SessionUser;
  vista: Vista;
  setVista: (v: Vista) => void;
  verBitacora: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--rosa)] text-xl font-black text-white">
            E
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black leading-tight text-slate-900"><span className="text-[var(--rosa-logo)]">EIRA</span> <span className="hidden sm:inline">Movimiento Rosa</span></p>
            <p className="truncate text-xs font-semibold text-slate-500">Programa Tamizaje Rosa</p>
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-black leading-tight text-slate-800">{user.nombreCompleto}</p>
            <p className="text-xs font-bold text-[var(--rosa)]">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <div className="text-right sm:hidden">
            <p className="text-xs font-black leading-tight text-[var(--rosa)]">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <button onClick={logout} className="btn-ghost !px-3 !py-2 !text-sm whitespace-nowrap">
            <span className="hidden sm:inline">Cerrar sesión</span>
            <span className="sm:hidden">Salir</span>
          </button>
        </div>
      </div>

      <p className="px-4 pb-1 text-xs font-semibold text-slate-500 sm:hidden">
        {user.nombreCompleto} · {user.email}
      </p>

      <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["panel", "Panel operativo"],
            ["bandeja", "SMS / Correo"],
            ...(verBitacora ? [["bitacora", "Bitácora"] as [Vista, string]] : []),
          ] as [Vista, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
              vista === v ? "bg-[var(--rosa)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
