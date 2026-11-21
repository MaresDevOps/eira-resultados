"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditLog, Patient, Role, SimulatedMessage, Study } from "./types";
import { ESTADO_BADGE, ESTADO_LABEL } from "./types";
import { QRCodeSVG } from "qrcode.react";

const SEDES = [
  "Clínica Móvil Tecámac",
  "Unidad EIRA Iztapalapa",
  "Unidad EIRA Cuernavaca",
  "Campaña Cuautitlán",
  "Otro",
];

function Badge({ estado }: { estado: string }) {
  return <span className={`badge ${ESTADO_BADGE[estado] ?? "bg-slate-200"}`}>{ESTADO_LABEL[estado] ?? estado}</span>;
}

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

// ---------- PDF de prueba generado en el navegador (sin dependencias) ----------
function makeSamplePdfBlob(): Blob {
  const lines = [
    "Estudio: Citologia cervical (Papanicolaou) - DEMO",
    "Paciente: PACIENTE DE PRUEBA",
    "Resultado: muestra satisfactoria para evaluacion",
    "Este PDF es SINTETICO, generado para la demo de la hackathon.",
  ];
  const content = [
    "BT", "/F1 16 Tf", "50 780 Td",
    "(EIRA Movimiento Rosa A.C. - Resultado de Estudio) Tj",
    "0 -28 Td", "/F1 11 Tf",
    ...lines.map((l, i) => `${i === 0 ? "" : "0 -18 Td"}(${l.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function useStudies() {
  const [studies, setStudies] = useState<Study[]>([]);
  const load = useCallback(async () => {
    const r = await fetch("/api/studies");
    const d = await r.json();
    setStudies(d.studies ?? []);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);
  return { studies, reload: load };
}

// ============================ LABORATORIO ============================
export function LaboratorioPanel({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [fechaToma, setFechaToma] = useState(new Date().toISOString().slice(0, 10));
  const [sede, setSede] = useState(SEDES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { studies } = useStudies();

  async function buscar() {
    const r = await fetch(`/api/patients?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setResults(d.patients ?? []);
  }

  function generarPdf() {
    const blob = makeSamplePdfBlob();
    const f = new File([blob], "resultado-prueba.pdf", { type: "application/pdf" });
    setFile(f);
    if (fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      fileRef.current.files = dt.files;
    }
    setMsg("PDF de prueba generado. Ya puedes subirlo.");
  }

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!patient || !file) {
      setErr("Selecciona una paciente y un archivo PDF.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("patientId", patient.id);
    fd.append("fechaToma", fechaToma);
    fd.append("sede", sede);
    fd.append("actorName", "Capturista EIRA (demo)");
    fd.append("role", "LABORATORIO");
    const r = await fetch("/api/studies", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErr(d.error ?? "Error al subir.");
      return;
    }
    setMsg(`Estudio cargado para ${patient.nombreCompleto}. Pasa a revisión del médico.`);
    setPatient(null);
    setResults([]);
    setQ("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    onChanged();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={subir} className="card space-y-4">
        <h2 className="text-xl font-black text-slate-900">1 · Cargar resultado (PDF)</h2>

        <div>
          <label className="label">Buscar paciente (nombre + fecha de nacimiento o CURP)</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Ej. María|1994-03-15  o  LOHM940315"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={buscar}>
              Buscar
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-500">Formato: <b>Nombre|AAAAMMDD</b> o CURP. Verifica identidad para evitar homónimos.</p>
        </div>

        {results.length > 0 && (
          <ul className="space-y-2">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { setPatient(p); setResults([]); }}
                  className={`w-full rounded-xl border-2 p-3 text-left ${
                    patient?.id === p.id ? "border-[var(--rosa)] bg-[var(--rosa-claro)]" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <p className="font-bold">{p.nombreCompleto}</p>
                  <p className="text-sm text-slate-600">
                    Nac. {p.fechaNacimiento} · {p.municipio} · {p.telefono}
                  </p>
                  {p.posibleHomónimo && (
                    <p className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-sm font-bold text-amber-800">
                      ⚠ Posible homónimo: confirma fecha de nacimiento o CURP antes de continuar.
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {patient && (
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3">
            <p className="font-bold text-emerald-900">✓ Paciente seleccionada: {patient.nombreCompleto}</p>
            <p className="text-sm text-emerald-800">CURP {patient.curp} · Nac. {patient.fechaNacimiento}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Fecha de toma de muestra</label>
            <input type="date" className="input" value={fechaToma} onChange={(e) => setFechaToma(e.target.value)} />
          </div>
          <div>
            <label className="label">Sede / Municipio</label>
            <select className="input" value={sede} onChange={(e) => setSede(e.target.value)}>
              {SEDES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Archivo PDF del resultado</label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="input file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--rosa)] file:px-4 file:py-2 file:font-bold file:text-white"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn-ghost mt-2 w-full" onClick={generarPdf}>
            Generar PDF de prueba
          </button>
        </div>

        {err && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{err}</p>}
        {msg && <p className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">{msg}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Subiendo…" : "Cargar y enviar a revisión clínica"}
        </button>
      </form>

      <div className="card">
        <h2 className="mb-3 text-xl font-black">Estudios recientes</h2>
        <ul className="space-y-2">
          {studies.slice(0, 8).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
              <div>
                <p className="font-bold">{s.patient?.nombreCompleto}</p>
                <p className="text-sm text-slate-500">Muestra {s.fechaToma} · {s.sede}</p>
              </div>
              <Badge estado={s.estado} />
            </li>
          ))}
          {studies.length === 0 && <p className="text-slate-500">Sin estudios todavía.</p>}
        </ul>
      </div>
    </div>
  );
}

// ============================ MÉDICO ============================
export function MedicoPanel({ onChanged }: { onChanged: () => void }) {
  const { studies, reload } = useStudies();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [lastNotify, setLastNotify] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [revocando, setRevocando] = useState<Study | null>(null);
  const [razon, setRazon] = useState("identidad_incorrecta");
  const [razonDetalle, setRazonDetalle] = useState("");
  const [qReasignar, setQReasignar] = useState("");
  const [candidatos, setCandidatos] = useState<Patient[]>([]);
  const [reasignarId, setReasignarId] = useState("");

  const pendientes = studies.filter((s) => s.estado === "EN_REVISION_CLINICA" || s.estado === "CARGADO");
  const autorizados = studies.filter((s) => s.estado === "AUTORIZADO_PARA_ENTREGA");
  const prioritarios = studies.filter((s) => s.estado === "REQUIERE_CONTACTO_MEDICO");
  const revocados = studies.filter((s) => s.estado === "REVOCADO_POR_CORRECCION");
  const [copiado, setCopiado] = useState(false);

  async function autorizar(s: Study, prioritario = false) {
    setErr(null);
    const r = await fetch(`/api/studies/${s.id}/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notaMedico: notas[s.id] ?? "", prioritario }),
    });
    const d = await r.json();
    if (!r.ok) setErr(d.error ?? "Error");
    reload();
    onChanged();
  }

  async function notificar(s: Study) {
    setErr(null);
    setCopiado(false);
    const r = await fetch(`/api/studies/${s.id}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const d = await r.json();
    if (!r.ok) setErr(d.error ?? "Error");
    else setLastNotify(d);
    reload();
    onChanged();
  }

  async function copiarEnlace() {
    if (!lastNotify?.link) return;
    await navigator.clipboard.writeText(lastNotify.link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function buscarReasignacion() {
    if (!qReasignar.trim()) return;
    const r = await fetch(`/api/patients?q=${encodeURIComponent(qReasignar)}`);
    setCandidatos(await r.json());
  }

  async function ejecutarRevocacion() {
    if (!revocando) return;
    setErr(null);
    const r = await fetch(`/api/studies/${revocando.id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: razon,
        reasonDetail: razonDetalle,
        newPatientId: reasignarId || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) setErr(d.error ?? "Error");
    else { setRevocando(null); setRazonDetalle(""); setReasignarId(""); setCandidatos([]); setQReasignar(""); }
    reload();
    onChanged();
  }

  const btnRevocar = (s: Study) => (
    <button
      className="btn mt-1 border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
      onClick={() => { setRevocando(s); setRazon("identidad_incorrecta"); setReasignarId(""); setCandidatos([]); }}
    >
      Revocar acceso
    </button>
  );

  return (
    <div className="space-y-5">
      {err && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{err}</p>}

      {lastNotify && (
        <div className="card border-2 border-[var(--rosa)]">
          <h3 className="text-lg font-black text-[var(--rosa)]">Simulador de Bandeja SMS / Correo</h3>
          <p className="mt-1 text-sm text-slate-500">Mensaje exacto que recibiría la paciente (nunca incluye datos clínicos):</p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            {/* Tarjeta estilo pantalla de móvil */}
            <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-8 border-slate-800 bg-slate-50 p-4 shadow-xl">
              <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-300" />
              <p className="text-center text-xs font-bold text-slate-400">SMS · {lastNotify.resultados?.[0]?.channel ?? "SMS_SIMULADO"}</p>
              <div className="mt-2 rounded-2xl rounded-tl-sm bg-emerald-100 p-3 text-sm leading-relaxed">
                {lastNotify.mensaje}
              </div>
              <div className="mt-3 flex justify-center">
                <QRCodeSVG value={lastNotify.link} size={120} fgColor="#b7426c" />
              </div>
              <p className="mt-1 text-center text-xs text-slate-400">Escanea el QR con el celular de la paciente</p>
            </div>

            <div className="flex-1 space-y-2 text-sm">
              <p><b>Link temporal (15 min, un solo uso):</b></p>
              <a className="block break-all rounded-xl bg-slate-100 p-2 text-[var(--rosa)] underline" href={lastNotify.link} target="_blank">
                {lastNotify.link}
              </a>
              <p><b>PIN de verificación:</b> <span className="font-mono text-2xl font-black">{lastNotify.otp}</span></p>
              <p><b>Proveedor:</b> {lastNotify.proveedor} · <b>Caché:</b> {lastNotify.backend} · <b>Vigencia:</b> {lastNotify.expiraEn}</p>
              <button className="btn-secondary w-full" onClick={copiarEnlace}>
                {copiado ? "✓ Enlace copiado" : "Copiar enlace"}
              </button>
            </div>
          </div>
        </div>
      )}

      {prioritarios.length > 0 && (
        <div className="card border-2 border-red-300 bg-red-50">
          <h2 className="mb-2 text-xl font-black text-red-800">⚠ Seguimiento clínico prioritario ({prioritarios.length})</h2>
          <p className="text-sm text-red-700">Estas pacientes requieren llamada médica antes de recibir el enlace. Su descarga automática está bloqueada.</p>
          <ul className="mt-3 space-y-2">
            {prioritarios.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                <div>
                  <p className="font-bold">{s.patient?.nombreCompleto} · {s.patient?.telefono}</p>
                  <p className="text-sm text-slate-600">Folio {s.folio} · muestra {s.fechaToma}</p>
                  {s.notaMedico && <p className="text-sm italic text-slate-500">Nota interna: {s.notaMedico}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge estado={s.estado} />
                  {btnRevocar(s)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {revocados.length > 0 && (
        <div className="card border-2 border-rose-300 bg-rose-50">
          <h2 className="mb-2 text-xl font-black text-rose-800">Estudios revocados por corrección ({revocados.length})</h2>
          <p className="text-sm text-rose-700">El token se invalidó de inmediato. Puedes reasignar el PDF al expediente correcto con "Revocar acceso" → "Reasignar a otro expediente".</p>
          <ul className="mt-3 space-y-2">
            {revocados.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                <div>
                  <p className="font-bold">{s.patient?.nombreCompleto}</p>
                  <p className="text-sm text-slate-600">Folio {s.folio} · muestra {s.fechaToma}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge estado={s.estado} />
                  {btnRevocar(s)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 text-xl font-black">Bandeja de estudios pendientes de autorización ({pendientes.length})</h2>
        {pendientes.length === 0 && <p className="text-slate-500">No hay estudios pendientes. 🎉</p>}
        <div className="space-y-4">
          {pendientes.map((s) => (
            <div key={s.id} className="rounded-2xl border-2 border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-black">{s.patient?.nombreCompleto}</p>
                  <p className="text-sm text-slate-600">
                    Folio <b>{s.folio}</b> · Nac. {s.patient?.fechaNacimiento} · Muestra {s.fechaToma} · {s.sede} · {s.patient?.municipio}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge estado={s.estado} />
                  {btnRevocar(s)}
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <iframe src={`/api/studies/${s.id}/pdf`} title="PDF" className="h-80 w-full rounded-xl border border-slate-300 bg-slate-50" />
                  {s.pdfSha256 && (
                    <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-800" title={s.pdfSha256}>
                      🔒 SHA-256: {s.pdfSha256.slice(0, 24)}… — Documento íntegro y sin alteraciones
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Nota interna (NO visible para la paciente ni en SMS)</label>
                    <textarea
                      className="input min-h-24"
                      placeholder="Observaciones clínicas opcionales…"
                      value={notas[s.id] ?? ""}
                      onChange={(e) => setNotas({ ...notas, [s.id]: e.target.value })}
                    />
                  </div>
                  <button className="btn-primary w-full" onClick={() => autorizar(s, false)}>
                    Autorizar Entrega Digital
                  </button>
                  <button
                    className="btn w-full border-2 border-red-600 bg-red-50 font-bold text-red-700 hover:bg-red-100"
                    onClick={() => {
                      if (confirm("Esto bloqueará la descarga automática y marcará el estudio como SEGUIMIENTO PRIORITARIO (requiere llamada médica). ¿Continuar?")) {
                        autorizar(s, true);
                      }
                    }}
                  >
                    ⚠ Autorizar con Seguimiento Prioritario
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {autorizados.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-xl font-black">Autorizados listos para notificar ({autorizados.length})</h2>
          <ul className="space-y-2">
            {autorizados.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="font-bold">{s.patient?.nombreCompleto}</p>
                  <p className="text-sm text-slate-500">Tel. {s.patient?.telefono} · autorizado {fmtFecha(s.autorizadoAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button className="btn-primary" onClick={() => notificar(s)}>
                    Enviar notificación (simulada)
                  </button>
                  {btnRevocar(s)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {revocando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRevocando(null)}>
          <div className="card w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-rose-700">Revocar acceso / Desvincular PDF</h2>
            <p className="text-sm text-slate-600">
              Estudio <b>{revocando.folio}</b> de <b>{revocando.patient?.nombreCompleto}</b>.
              Se invalidará el token de inmediato y quedará registro inmutable en la bitácora.
            </p>
            <div>
              <label className="label">Motivo de la corrección (obligatorio)</label>
              <select className="input" value={razon} onChange={(e) => setRazon(e.target.value)}>
                <option value="identidad_incorrecta">Error de asociación de identidad</option>
                <option value="fallo_envio">Fallo en envío</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">Detalle (opcional)</label>
              <input className="input" value={razonDetalle} onChange={(e) => setRazonDetalle(e.target.value)} placeholder="Ej. confusión de homónimos…" />
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-bold">Reasignar el PDF a otro expediente (opcional)</p>
              <div className="mt-2 flex gap-2">
                <input className="input flex-1" value={qReasignar} onChange={(e) => setQReasignar(e.target.value)} placeholder="Nombre|fechaNac o CURP" />
                <button className="btn-secondary" onClick={buscarReasignacion}>Buscar</button>
              </div>
              {candidatos.length > 0 && (
                <select className="input mt-2" value={reasignarId} onChange={(e) => setReasignarId(e.target.value)}>
                  <option value="">— Sin reasignación (solo revocar) —</option>
                  {candidatos.filter((p) => p.id !== revocando.patientId).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombreCompleto} · {p.fechaNacimiento} · {p.curp}</option>
                  ))}
                </select>
              )}
              <p className="mt-2 text-xs text-slate-500">Con reasignación, el estudio vuelve a <b>En revisión clínica</b> (exige nueva revisión por el cambio de paciente). Sin reasignación queda <b>Revocado por corrección</b>.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn w-full border-2 border-rose-600 bg-rose-50 font-bold text-rose-700 hover:bg-rose-100" onClick={ejecutarRevocacion}>
                Confirmar revocación
              </button>
              <button className="btn-secondary w-full" onClick={() => setRevocando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ PROMOTORA ============================
export function PromotoraPanel({ onChanged }: { onChanged: () => void }) {
  const { studies, reload } = useStudies();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Study | null>(null);
  const [sede, setSede] = useState(SEDES[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const elegibles = studies.filter((s) =>
    ["AUTORIZADO_PARA_ENTREGA", "NOTIFICADO", "EN_REVISION_CLINICA", "REQUIERE_CONTACTO_MEDICO"].includes(s.estado)
  );
  const filtrados = elegibles.filter((s) =>
    !q ||
    s.patient?.nombreCompleto.toLowerCase().includes(q.toLowerCase()) ||
    (s.folio ?? "").toLowerCase().includes(q.toLowerCase())
  );
  const prioritarios = filtrados.filter((s) => s.estado === "REQUIERE_CONTACTO_MEDICO");

  async function entregar() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await fetch(`/api/studies/${selected.id}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sede, deliveredBy: "Promotora EIRA (demo)", role: "PROMOTORA", observations: "Entrega física con lectura asistida en sede." }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErr(d.error ?? "Error");
      return;
    }
    setMsg(`Entrega registrada en ${sede}. Acuse: /acuse/${selected.id}`);
    setSelected(null);
    reload();
    onChanged();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card">
        <h2 className="mb-3 text-xl font-black">Entrega asistida en sede</h2>
        <p className="mb-3 text-sm text-slate-600">
          Para pacientes sin celular, correo o internet. Valida la identidad de forma presencial
          (nombre + fecha de nacimiento o folio) antes de entregar.
        </p>
        <input className="input" placeholder="Buscar por nombre o folio (ej. EIRA-2026-…)" value={q} onChange={(e) => setQ(e.target.value)} />

        {prioritarios.length > 0 && (
          <div className="mt-3 rounded-xl border-2 border-red-300 bg-red-50 p-3">
            <p className="font-black text-red-800">⚠ {prioritarios.length} paciente(s) con seguimiento prioritario:</p>
            <p className="text-sm text-red-700">Confirma que la médica de EIRA ya las contactó antes de entregar.</p>
          </div>
        )}

        <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
          {filtrados.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setSelected(s)}
                className={`w-full rounded-xl border-2 p-3 text-left ${
                  selected?.id === s.id ? "border-[var(--rosa)] bg-[var(--rosa-claro)]" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-bold">{s.patient?.nombreCompleto} {s.estado === "REQUIERE_CONTACTO_MEDICO" && "⚠"}</p>
                <p className="text-sm text-slate-600">
                  Folio <b>{s.folio}</b> · Nac. {s.patient?.fechaNacimiento} · CURP {s.patient?.curp}
                </p>
                <div className="mt-1"><Badge estado={s.estado} /></div>
              </button>
            </li>
          ))}
          {filtrados.length === 0 && <p className="text-slate-500">No hay estudios elegibles.</p>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 text-xl font-black">Validación presencial y acuse</h2>
        {!selected ? (
          <p className="text-slate-500">Selecciona a la paciente de la lista.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-lg font-black">{selected.patient?.nombreCompleto}</p>
              <p>Fecha de nacimiento: <b>{selected.patient?.fechaNacimiento}</b></p>
              <p>CURP: <b>{selected.patient?.curp}</b></p>
              <p>Municipio: <b>{selected.patient?.municipio}</b></p>
            </div>
            <div>
              <label className="label">Sede donde se realiza la entrega</label>
              <select className="input" value={sede} onChange={(e) => setSede(e.target.value)}>
                {SEDES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <iframe src={`/api/studies/${selected.id}/pdf`} title="PDF" className="h-72 w-full rounded-xl border border-slate-300 bg-slate-50" />
            {err && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{err}</p>}
            {msg && (
              <p className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">
                {msg} — <a className="underline" href={`/acuse/${selected.id}`}>Ver acuse descargable</a>
              </p>
            )}
            <button className="btn-primary w-full" onClick={entregar} disabled={busy}>
              {busy ? "Registrando…" : "Confirmar Entrega Física / Lectura Asistida en Sede"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================ BANDEJA SMS ============================
export function BandejaPanel() {
  const [msgs, setMsgs] = useState<SimulatedMessage[]>([]);
  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/notifications");
      const d = await r.json();
      setMsgs(d.messages ?? []);
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="card">
        <h2 className="text-xl font-black">Simulador de Bandeja SMS / Correo</h2>
        <p className="text-sm text-slate-600">
          En producción esto sería Twilio/AWS SNS. Aquí se simula para la demo: los mensajes
          <b> nunca contienen datos médicos</b>, solo un link temporal y un código de verificación.
        </p>
      </div>
      {msgs.length === 0 && <p className="card text-slate-500">Aún no hay notificaciones simuladas.</p>}
      {msgs.map((m) => {
        const abs = (m.body.match(/https?:\/\/[^\s]+\/acceso\/[A-Za-z0-9_-]+/) ?? [null])[0];
        const rel = (m.body.match(/\/acceso\/[A-Za-z0-9_-]+/) ?? [null])[0];
        const urlAbs = abs ?? (rel ? `${window.location.origin}${rel}` : null);
        return (
          <div key={m.id} className="card">
            <p className="text-sm font-bold text-slate-500">Para: {m.toPhone} · {m.channel} · {fmtFecha(m.createdAt)}</p>
            <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row">
              <div className="flex-1 rounded-2xl rounded-tl-sm bg-[var(--rosa-claro)] p-4 text-base">
                {m.body}
              </div>
              {urlAbs && (
                <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-center">
                  <QRCodeSVG value={urlAbs} size={110} fgColor="#b7426c" />
                  <p className="mt-1 text-xs text-slate-400">Escanear con celular</p>
                </div>
              )}
            </div>
            {m.otpCode && (
              <p className="mt-2 text-sm text-slate-500">Código de verificación (solo visible en este simulador): <b className="font-mono">{m.otpCode}</b></p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================ MÉTRICAS RÁPIDAS ============================
export function MetricasPanel() {
  const { studies } = useStudies();
  const pendientes = studies.filter((s) => ["CARGADO", "EN_REVISION_CLINICA"].includes(s.estado)).length;
  const sinDescargar = studies.filter((s) => ["NOTIFICADO", "REQUIERE_CONTACTO_MEDICO", "AUTORIZADO_PARA_ENTREGA"].includes(s.estado)).length;
  const completados = studies.filter((s) => ["DESCARGADO_PACIENTE", "ENTREGADO_ASISTIDO"].includes(s.estado)).length;

  const cards = [
    { titulo: "Pendientes de Revisión Médica", valor: pendientes, color: "border-amber-400 bg-amber-50 text-amber-800", icono: "🩺" },
    { titulo: "Notificados sin Descargar (Seguimiento)", valor: sinDescargar, color: "border-violet-400 bg-violet-50 text-violet-800", icono: "📱" },
    { titulo: "Entregados / Completados", valor: completados, color: "border-emerald-400 bg-emerald-50 text-emerald-800", icono: "✅" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.titulo} className={`rounded-2xl border-2 p-4 ${c.color}`}>
          <p className="text-4xl font-black">{c.icono} {c.valor}</p>
          <p className="mt-1 font-bold">{c.titulo}</p>
        </div>
      ))}
    </div>
  );
}

// ============================ AUDITORÍA ============================
const ACTION_LABELS: Record<string, string> = {
  ESTUDIO_CARGADO: "Estudio cargado",
  AUTORIZACION_CLINICA: "Autorización clínica",
  NOTIFICACION_ENVIADA: "Notificación enviada",
  ACCESO_VERIFICADO: "Acceso verificado (paciente)",
  ACCESO_FALLIDO: "Acceso fallido (paciente)",
  RESULTADO_DESCARGADO: "Resultado descargado",
  ENTREGA_ASISTIDA_SEDE: "Entrega asistida en sede",
  REENVIO_SOLICITADO: "Reenvío solicitado",
  AUTORIZACION_PRIORITARIA: "Autorización con seguimiento prioritario",
  ACCESO_REVOCADO: "Acceso revocado / PDF desvinculado",
  REASIGNACION_PACIENTE: "PDF reasignado a otro expediente",
  LOGIN: "Inicio de sesión",
};

export function AuditoriaPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const load = useCallback(async () => {
    const r = await fetch("/api/audit?limit=200");
    const d = await r.json();
    setLogs(d.logs ?? []);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Bitácora de Auditoría</h2>
          <p className="text-sm text-slate-600">Quién, rol, acción, paciente, timestamp e IP/origen de cada evento. Se actualiza en tiempo real.</p>
        </div>
        <a href="/api/audit/export.csv" className="btn-primary" download>
          Exportar Reporte CSV
        </a>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Quién</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Acción</th>
              <th className="p-3">Detalle</th>
              <th className="p-3">IP / Origen</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap p-3">{fmtFecha(l.createdAt)}</td>
                <td className="p-3">
                  <span className="font-bold">{l.actorName}</span>
                  {(l as any).email && <span className="block text-xs font-normal text-slate-500">{(l as any).email}</span>}
                </td>
                <td className="p-3"><span className="badge bg-slate-200">{l.role}</span></td>
                <td className="p-3 font-semibold">{ACTION_LABELS[l.action] ?? l.action}</td>
                <td className="max-w-xs truncate p-3 text-slate-600" title={l.detail ?? ""}>{l.detail}</td>
                <td className="p-3 font-mono text-xs">{l.ip}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">Sin eventos todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
