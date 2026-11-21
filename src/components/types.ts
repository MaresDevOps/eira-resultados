export type Role = "LABORATORIO" | "MEDICO" | "PROMOTORA" | "ADMIN";

export interface Patient {
  id: string;
  nombreCompleto: string;
  curp: string;
  fechaNacimiento: string;
  telefono: string;
  municipio: string;
  email?: string | null;
  posibleHomónimo?: boolean;
  folio?: string;
}

export interface Study {
  id: string;
  patientId: string;
  estado: string;
  fechaToma: string;
  sede: string;
  pdfPath: string;
  pdfSha256?: string;
  folio?: string;
  notaMedico?: string | null;
  tokenId?: string | null;
  createdAt: string;
  autorizadoAt?: string | null;
  notificadoAt?: string | null;
  entregadoAt?: string | null;
  entregadoModo?: string | null;
  sedeEntrega?: string | null;
  entregadoPor?: string | null;
  patient?: Patient;
}

export interface AuditLog {
  id: string;
  actorName: string;
  role: string;
  action: string;
  patientId?: string | null;
  studyId?: string | null;
  detail?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface SimulatedMessage {
  id: string;
  studyId: string;
  toPhone: string;
  channel: string;
  body: string;
  otpCode?: string | null;
  createdAt: string;
}

export const ROLE_INFO: Record<Role, { label: string; short: string; descripcion: string }> = {
  LABORATORIO: {
    label: "Laboratorio / Capturista EIRA",
    short: "Capturista",
    descripcion: "Carga de PDFs y asociación a pacientes",
  },
  MEDICO: {
    label: "Médico / Revisión Clínica",
    short: "Médico",
    descripcion: "Autorización clínica antes de cualquier entrega",
  },
  PROMOTORA: {
    label: "Promotora en Sede (Entrega Asistida)",
    short: "Promotora",
    descripcion: "Entrega física y lectura asistida en sedes",
  },
  ADMIN: {
    label: "Administradora",
    short: "Admin",
    descripcion: "Acceso total: operación, bitácora y métricas",
  },
};

export const ESTADO_BADGE: Record<string, string> = {
  CARGADO: "bg-slate-200 text-slate-700",
  EN_REVISION_CLINICA: "bg-amber-100 text-amber-800",
  AUTORIZADO_PARA_ENTREGA: "bg-sky-100 text-sky-800",
  NOTIFICADO: "bg-violet-100 text-violet-800",
  REQUIERE_CONTACTO_MEDICO: "bg-red-100 text-red-800",
  DESCARGADO_PACIENTE: "bg-emerald-100 text-emerald-800",
  ENTREGADO_ASISTIDO: "bg-teal-100 text-teal-800",
  REVOCADO_POR_CORRECCION: "bg-rose-100 text-rose-800",
};

export const ESTADO_LABEL: Record<string, string> = {
  CARGADO: "Cargado",
  EN_REVISION_CLINICA: "En revisión clínica",
  AUTORIZADO_PARA_ENTREGA: "Autorizado p/ entrega",
  NOTIFICADO: "Notificado",
  REQUIERE_CONTACTO_MEDICO: "Seguimiento prioritario",
  DESCARGADO_PACIENTE: "Descargado",
  ENTREGADO_ASISTIDO: "Entregado asistido",
  REVOCADO_POR_CORRECCION: "Revocado p/ corrección",
};
