// Estados del ciclo de vida del resultado (texto plano: SQLite no soporta enums en Prisma).
export const ESTADOS = {
  CARGADO: "CARGADO",
  EN_REVISION_CLINICA: "EN_REVISION_CLINICA",
  AUTORIZADO_PARA_ENTREGA: "AUTORIZADO_PARA_ENTREGA",
  NOTIFICADO: "NOTIFICADO",
  REQUIERE_CONTACTO_MEDICO: "REQUIERE_CONTACTO_MEDICO",
  DESCARGADO_PACIENTE: "DESCARGADO_PACIENTE",
  ENTREGADO_ASISTIDO: "ENTREGADO_ASISTIDO",
  REVOCADO_POR_CORRECCION: "REVOCADO_POR_CORRECCION",
} as const;

export type Estado = (typeof ESTADOS)[keyof typeof ESTADOS];

export const ESTADO_LABELS: Record<string, string> = {
  CARGADO: "Cargado",
  EN_REVISION_CLINICA: "En revisión clínica",
  AUTORIZADO_PARA_ENTREGA: "Autorizado para entrega",
  NOTIFICADO: "Notificado",
  REQUIERE_CONTACTO_MEDICO: "Requiere contacto médico prioritario",
  DESCARGADO_PACIENTE: "Descargado por paciente",
  ENTREGADO_ASISTIDO: "Entregado asistido en sede",
  REVOCADO_POR_CORRECCION: "Revocado por corrección",
};

export const ROLES = {
  LABORATORIO: "LABORATORIO",
  MEDICO: "MEDICO",
  PROMOTORA: "PROMOTORA",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export const STAFF_ROLES: Role[] = ["LABORATORIO", "MEDICO", "PROMOTORA", "ADMIN"];

export const SESSION_COOKIE = "eira_session";
export const TOKEN_TTL_SEG = 15 * 60; // 15 minutos
export const OTP_INTENTOS_MAX = 3;
export const DOWNLOAD_TTL_SEG = 10 * 60;
export const SESSION_TTL_SEG = 8 * 60 * 60; // 8 horas
