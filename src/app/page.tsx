"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, type Vista, type SessionUser } from "@/components/Header";
import { LaboratorioPanel, MedicoPanel, PromotoraPanel, BandejaPanel, AuditoriaPanel, MetricasPanel } from "@/components/panels";
import { ROLE_INFO, type Role } from "@/components/types";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>("panel");
  const [panelAdmin, setPanelAdmin] = useState<Role>("LABORATORIO");
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/auth/me");
      if (!r.ok) {
        router.replace("/login");
        return;
      }
      const d = await r.json();
      setUser(d.user);
      setCargando(false);
    })();
  }, [router]);

  if (cargando || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl font-bold text-slate-500">
        Verificando sesión…
      </div>
    );
  }

  const esAdmin = user.role === "ADMIN";
  const rolActivo: Role = esAdmin ? panelAdmin : (user.role as Role);
  const verBitacora = esAdmin || user.role === "MEDICO";

  return (
    <div className="min-h-screen">
      <Header user={user} vista={vista} setVista={setVista} verBitacora={verBitacora} />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {vista === "panel" && <MetricasPanel />}

        {vista === "bandeja" && <BandejaPanel />}
        {vista === "bitacora" && verBitacora && <AuditoriaPanel />}
        {vista === "panel" && (
          <>
            {esAdmin && (
              <div className="card flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-600">Vista de admin — operar como:</p>
                {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setPanelAdmin(r)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      panelAdmin === r ? "bg-[var(--rosa)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {ROLE_INFO[r].short}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-[var(--rosa)]/30 bg-[var(--rosa-claro)] p-4">
              <p className="text-lg font-black text-[var(--rosa)]">{ROLE_INFO[rolActivo].label}</p>
              <p className="text-slate-700">{ROLE_INFO[rolActivo].descripcion}</p>
            </div>

            {rolActivo === "LABORATORIO" && <LaboratorioPanel onChanged={refresh} />}
            {rolActivo === "MEDICO" && <MedicoPanel onChanged={refresh} />}
            {rolActivo === "PROMOTORA" && <PromotoraPanel onChanged={refresh} />}
            {rolActivo === "ADMIN" && <LaboratorioPanel onChanged={refresh} />}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/60 px-4 py-6 text-center text-xs leading-relaxed text-slate-500">
        <p className="font-black text-[var(--rosa)]">Programa Tamizaje Rosa · EIRA, Movimiento Rosa A.C.</p>
        <p>Fundada en 2017 · Ciudad Guzmán, Jalisco · Más de 51,000 personas beneficiadas acumuladas a septiembre de 2026</p>
        <p className="mt-2">
          Prototipo con <b>registros ficticios</b> para demostración. Cualquier despliegue con pacientes reales
          requiere revisión jurídica y clínica previa (LFPDPPP y normativa de salud vigente).
        </p>
      </footer>
    </div>
  );
}
