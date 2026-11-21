# Devpost — Envío del proyecto (texto listo para pegar)

> Proyecto: **EIRA Tamizaje Rosa — Entrega digital segura de resultados de Papanicolaou**
> Reto 4 · EIRA Movimiento Rosa A.C. · Vibeathon Nerdearla México 2026

## Elevator pitch

Hoy EIRA escanea ~300 resultados de Papanicolaou al mes y los envía por WhatsApp: sin cifrado, sin control de quién lo abrió, y frágil ante bloqueos de cuenta. Construimos el reemplazo: un flujo completo — carga del PDF, revisión clínica, notificación privada, descarga con token de un solo uso, y **entrega asistida en sede para pacientes sin celular ni internet** — corriendo en AWS con PostgreSQL y **Valkey** como capa de tokens efímeros.

## Problema

- Los resultados llegan impresos del laboratorio; EIRA los escanea, los asocia *por nombre* y los envía por WhatsApp.
- Riesgo real de privacidad: PDFs con diagnósticos circulando por un canal sin auditoría.
- Sin alternativa para pacientes sin correo, sin teléfono propio o sin conectividad.
- Cuando WhatsApp bloquea la cuenta, las entregas se detienen.

## Solución implementada

1. **Laboratorio/Capturista**: sube el PDF escaneado y lo asocia al expediente con comprobación de identidad (nombre + fecha de nacimiento o CURP). El servidor calcula SHA-256 y asigna folio legible `EIRA-2026-XXXX`.
2. **Médico**: revisión clínica con dos caminos — autoriza entrega digital, o marca *"Seguimiento prioritario"* (estado `REQUIERE_CONTACTO_MEDICO`) que **bloquea el enlace automático** y avisa que una médica de EIRA llamará a la paciente.
3. **Notificación privada**: el SMS/correo nunca contiene diagnósticos — solo un enlace temporal + PIN de 4 dígitos + QR escaneable.
4. **Paciente**: link de 15 minutos, verificación por PIN **o** fecha de nacimiento (3 intentos), descarga de un solo uso con sello de integridad SHA-256. Interfaz con botón "A+ texto grande / alto contraste".
5. **Contingencias reales**: reenvío si el link expira, revocación del token si el PDF se asoció a la paciente equivocada (con reasignación auditada), y entrega asistida en sede con acuse de recibo imprimible.
6. **Gobernanza**: RBAC de 4 roles, bitácora inmutable con actor/email/IP, exportación CSV, métricas en vivo.

## Cómo cubre los criterios

| Criterio | Qué demostramos |
|---|---|
| **Usabilidad** | Mobile-first, alto contraste, español simple, login demo de 1 clic, QR para no teclear URLs |
| **Impacto** | Flujo crítico completo de punta a punta — reemplaza WhatsApp de verdad, incluye a quien no tiene conectividad |
| **Escalabilidad** | Misma arquitectura sirve para ultrasonido/mamografía/nutrición; Docker Compose + Postgres + Valkey, desplegado en EC2 |
| **Privacidad y confianza** | SMS sin datos clínicos, tokens efímeros en Valkey, descarga de un solo uso, RBAC + bitácora, PDFs nunca públicos |
| **Innovación** | SHA-256 de integridad, folio de jornada sin internet, estado de prioridad clínica que bloquea auto-descarga, revocación/reasignación auditada |

## Tecnologías

Next.js 15 + TypeScript + Tailwind · Prisma + PostgreSQL · **Valkey** (ioredis: tokens TTL 15min, rate-limit 3 intentos, tickets de descarga única) · JWT httpOnly + bcrypt · Docker Compose en AWS EC2 · qrcode.react · Suite E2E de 67 pruebas.

## Demo en vivo

- App: http://18.217.201.5:3000 (EC2 us-east-2)
- Repo: https://github.com/MaresDevOps/eira-resultados
- Pruebas: `bash scripts/test-e2e.sh` → **67/67 en verde**

## Implementado vs. simulado (honestidad ante el jurado)

- **Real**: todo el flujo, autenticación, RBAC, Valkey, PDFs privados, bitácora, QR, EC2.
- **Simulado**: el envío SMS (adapter `mock` — la bandeja muestra exactamente lo que saldría; la interfaz ya está lista para AWS SNS/Twilio) y el correo vía nodemailer (apagado sin SMTP).
- **Para piloto real**: HTTPS + dominio, firma electrónica del acuse, S3 cifrado para PDFs, SMS real, y revisión jurídica LFPDPPP.

---

# Guión de demo — 5 minutos (mapeado a criterios)

**0:00 — Impacto.** "300 resultados/mes por WhatsApp hoy. Esto es lo que lo reemplaza." Login 1-clic como Dra. Martínez → mostrar las 3 tarjetas de métricas en vivo.

**1:00 — Flujo completo.** Tab "Vista de admin" → Capturista: buscar `Ana|1990-01-01`, clic en su tarjeta, "Generar PDF de prueba" (el PDF trae datos reales de la paciente), cargar → pasa a revisión.

**2:00 — Privacidad + Innovación.** Vista Médico: mostrar el SHA-256 como sello de integridad, autorizar → tarjeta de notificación con **QR escaneable** + SMS sin datos clínicos + PIN. Mostrar también el botón de **Seguimiento Prioritario** y el de **Revocar/Desvincular** (contingencia de homónimos).

**3:00 — Usabilidad en celular.** Escanear el QR en vivo (o abrir el enlace) → pantalla paciente → mostrar botón **A+**, ingresar fecha de nacimiento `01/01/1990` → descarga con sello "Documento íntegro". Mostrar que un segundo intento de abrir el link ya está **bloqueado** (un solo uso).

**4:00 — Sin conectividad.** "¿Y si la paciente no tiene celular?" → Vista Promotora: buscar por folio `EIRA-2026-XXXX`, entrega asistida en sede → acuse imprimible. Cerrar con Bitácora: cada acción con actor real, email, IP — exportable a CSV.

**Frase de cierre**: "No es una maqueta — es un stack real en EC2 con Valkey gobernando cada token, y 67 pruebas E2E verdes."

## Checklist antes de las 16:00

- [ ] Subir a Devpost: descripción + link repo + video/screenshots (`demo-video/` y `.e2e-tmp/mobile-*.png`)
- [ ] Verificar que http://18.217.201.5:3000 responde antes del pitch
- [ ] Tener `eira-valkey` + instancia corriendo; screenshots de respaldo por si falla el WiFi del venue
- [ ] Practicar el guión una vez en el celular
