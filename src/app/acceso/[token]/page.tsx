"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Fase = "cargando" | "formulario" | "exito" | "bloqueado" | "expirado" | "contacto_medico";

export default function AccesoPaciente() {
  const { token } = useParams<{ token: string }>();
  const [fase, setFase] = useState<Fase>("cargando");
  const [nombre, setNombre] = useState("");
  const [sede, setSede] = useState("");
  const [pin, setPin] = useState("");
  const [fecha, setFecha] = useState("");
  const [intentos, setIntentos] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reenviado, setReenviado] = useState<{ link: string; otp: string; mensaje: string } | null>(null);
  const [descarga, setDescarga] = useState<{ url: string; sha256?: string; folio?: string } | null>(null);
  const [textoGrande, setTextoGrande] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/public/token/${token}`);
    const d = await r.json();
    if (d.ok) {
      setNombre(d.nombre);
      setSede(d.sede);
      setIntentos(d.intentosRestantes ?? 3);
      setFase("formulario");
    } else if (d.reason === "blocked") {
      setFase("bloqueado");
    } else if (d.reason === "requiere_contacto") {
      setFase("contacto_medico");
    } else {
      setFase("expirado");
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/public/token/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, fechaNacimiento: fecha }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.ok) {
      setDescarga({ url: d.downloadUrl, sha256: d.pdfSha256, folio: d.folio });
      setFase("exito");
    } else if (d.reason === "blocked") {
      setFase("bloqueado");
    } else if (d.reason === "requiere_contacto") {
      setFase("contacto_medico");
    } else if (d.reason === "expired_or_used") {
      setFase("expirado");
    } else {
      setIntentos(d.intentosRestantes ?? intentos - 1);
      setError(`Código incorrecto. Te quedan ${d.intentosRestantes ?? "?"} intentos. Revisa el SMS e intenta de nuevo.`);
    }
  }

  async function reenviar() {
    setBusy(true);
    const r = await fetch(`/api/public/token/${token}/resend`, { method: "POST" });
    const d = await r.json();
    setBusy(false);
    if (d.reason === "requiere_contacto") {
      setFase("contacto_medico");
    } else if (r.ok) {
      setReenviado(d);
    } else {
      setError(d.error ?? "No se pudo reenviar. Acude a la sede más cercana.");
    }
  }

  const texto = textoGrande ? "text-2xl leading-relaxed" : "";
  const btnExtra = textoGrande ? "!py-5 !text-2xl" : "";

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 py-8 ${textoGrande ? "bg-slate-900" : "bg-gradient-to-b from-[var(--rosa-claro)] to-white"}`}>
      {/* Botón flotante de accesibilidad */}
      <button
        onClick={() => setTextoGrande(!textoGrande)}
        className={`fixed right-3 top-3 z-30 rounded-full px-4 py-3 font-black shadow-lg ${
          textoGrande ? "bg-white text-slate-900" : "bg-slate-900 text-white"
        }`}
        aria-pressed={textoGrande}
      >
        A+ {textoGrande ? "Vista normal" : "Texto grande"}
      </button>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--rosa)] text-4xl shadow-lg">
            💗
          </div>
          <h1 className={`font-black ${textoGrande ? "text-4xl text-white" : "text-3xl text-slate-900"}`}>EIRA Movimiento Rosa</h1>
          <p className={`mt-1 text-lg ${textoGrande ? "text-slate-200" : "text-slate-600"}`}>Tu resultado está protegido y es solo para ti</p>
        </div>

        {fase === "cargando" && (
          <div className={`card text-center text-lg ${textoGrande ? "text-white" : ""}`}>Verificando tu enlace seguro…</div>
        )}

        {fase === "contacto_medico" && (
          <div className="card space-y-4 text-center">
            <div className="text-6xl">🩺</div>
            <h2 className="text-2xl font-black text-slate-800">Estamos contigo</h2>
            <p className={`text-slate-700 ${texto}`}>
              Tu resultado ya está listo. Una médica de <b>EIRA Movimiento Rosa</b> se comunicará
              contigo personalmente para acompañarte y explicarte todo con calma.
            </p>
            <p className={`text-slate-700 ${texto}`}>
              No necesitas hacer nada más. <b>Estás en buenas manos.</b>
            </p>
            <div className="rounded-2xl bg-amber-50 p-4 text-left text-amber-800">
              <p className="font-black">¿Tienes dudas o algo te preocupa?</p>
              <p>Acude a la sede EIRA más cercana o llama a tu promotora con tu identificación.</p>
            </div>
          </div>
        )}

        {fase === "formulario" && (
          <form onSubmit={verificar} className="card space-y-5">
            <div className="rounded-2xl bg-emerald-50 p-4 text-center">
              <p className={`font-black text-emerald-900 ${textoGrande ? "text-3xl" : "text-xl"}`}>Hola, {nombre} 💛</p>
              <p className={`text-emerald-800 ${texto}`}>Tu resultado de tu estudio de Papanicolaou está listo.</p>
              {sede && <p className="mt-1 text-sm text-emerald-700">Tomado en: {sede}</p>}
            </div>

            <p className={`text-center text-slate-700 ${texto}`}>
              Para cuidar tu información, escribe el <b>código de 4 números</b> que te enviamos por SMS,
              <b> o tu fecha de nacimiento</b>.
            </p>

            <div>
              <label className="label">Código de verificación (4 dígitos)</label>
              <input
                className={`input text-center font-mono tracking-[0.5em] ${textoGrande ? "!py-5 !text-4xl" : "text-3xl"}`}
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <div className="flex items-center gap-3 text-slate-400">
              <div className="h-px flex-1 bg-slate-300" />
              <span className="font-bold">o</span>
              <div className="h-px flex-1 bg-slate-300" />
            </div>

            <div>
              <label className="label">Fecha de nacimiento</label>
              <input type="date" className={`input ${btnExtra}`} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</p>}

            <button type="submit" className={`btn-primary w-full ${btnExtra}`} disabled={busy || (!pin && !fecha)}>
              {busy ? "Verificando…" : "Ver mi resultado"}
            </button>
            <p className="text-center text-sm text-slate-500">
              Intentos restantes: <b>{intentos}</b> · Este enlace vence en 15 minutos
            </p>
          </form>
        )}

        {fase === "exito" && (
          <div className="card space-y-5 text-center">
            <div className="text-6xl">✅</div>
            <h2 className={`font-black text-emerald-700 ${textoGrande ? "text-3xl" : "text-2xl"}`}>¡Tu identidad está verificada!</h2>
            <p className={`text-slate-700 ${texto}`}>
              Descarga tu resultado en PDF. <b>Guárdalo en un lugar seguro</b> y muéstralo a tu médico
              de confianza en tu próxima visita.
            </p>
            <a href={descarga?.url} className={`btn-primary w-full ${btnExtra}`}>
              Descargar mi resultado (PDF)
            </a>
            {descarga?.sha256 && (
              <p className="rounded-xl bg-emerald-50 p-3 font-mono text-xs text-emerald-800" title={descarga.sha256}>
                🔒 Documento íntegro y sin alteraciones
                {descarga.folio && <> · Folio <b>{descarga.folio}</b></>}
                <br />SHA-256: {descarga.sha256.slice(0, 32)}…
              </p>
            )}
            <div className="rounded-2xl bg-slate-50 p-4 text-left text-slate-700">
              <p className={`font-black ${texto}`}>📋 ¿Qué sigue?</p>
              <ul className={`mt-2 list-disc space-y-1 pl-5 ${texto}`}>
                <li>Agenda tu consulta con tu médico para revisar el resultado.</li>
                <li>Si tienes dudas o síntomas, no esperes: acude a tu unidad de salud.</li>
                <li>Nunca compartas este enlace ni tu código con nadie.</li>
              </ul>
            </div>
          </div>
        )}

        {(fase === "bloqueado" || fase === "expirado") && (
          <div className="card space-y-4 text-center">
            <div className="text-6xl">🔒</div>
            <h2 className="text-2xl font-black text-slate-800">
              {fase === "bloqueado" ? "Acceso bloqueado por seguridad" : "Este enlace ya no está disponible"}
            </h2>
            <p className={`text-slate-700 ${texto}`}>
              {fase === "bloqueado"
                ? "Por tu seguridad, el enlace se bloqueó tras varios intentos fallidos. Puedes solicitar un nuevo enlace."
                : "El enlace venció (duran 15 minutos) o ya fue utilizado. Puedes solicitar uno nuevo."}
            </p>
            {reenviado ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-left">
                <p className="font-black text-emerald-800">✅ Nuevo enlace generado (demo):</p>
                <p className="mt-1 break-all text-sm">
                  <a className="text-[var(--rosa)] underline" href={reenviado.link}>
                    {reenviado.link}
                  </a>
                </p>
                <p className="mt-2">Código de verificación: <b className="font-mono text-xl">{reenviado.otp}</b></p>
                <p className="mt-2 text-sm text-slate-600">{reenviado.mensaje}</p>
              </div>
            ) : (
              <button className={`btn-primary w-full ${btnExtra}`} onClick={reenviar} disabled={busy}>
                {busy ? "Enviando…" : "Solicitar reenvío del enlace"}
              </button>
            )}
            {error && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</p>}
            <p className="text-sm text-slate-500">
              Si sigues sin acceso, acude a la sede EIRA más cercana con tu identificación.
            </p>
          </div>
        )}

        <p className={`mt-6 text-center text-xs ${textoGrande ? "text-slate-300" : "text-slate-400"}`}>
          EIRA Movimiento Rosa A.C. · Tus datos están protegidos conforme a la LFPDPPP
        </p>
      </div>
    </div>
  );
}
