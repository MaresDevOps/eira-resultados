# CONTEXTO DE SESIÓN — EIRA Reto 4 (handoff, actualizado tras mejoras v2)

## Estado: prototipo completo + RBAC + despliegue AWS, 53/53 tests E2E en verde
Repo: `C:\Users\mares\OneDrive\Escritorio\EIRA-resultados`
Correr: `npm install && npm run dev` → http://localhost:3000 (seed auto al primer request).
Tests: `bash scripts/test-e2e.sh`. Build `npm run build` limpio.

## Stack y decisiones (NO revertir)
- Next.js 15 App Router + TS + **Tailwind v3** (v4 rompe en Windows por magic-string ESM)
- Prisma + **SQLite** (`prisma/dev.db`); Postgres en Docker vía `ARG DB_PROVIDER=postgresql` en Dockerfile (reescribe provider al compilar)
- **Valkey/ioredis con fallback en memoria**: cache.ts usa `globalThis` (Next instancia módulos por ruta); ioredis solo se importa dinámicamente si `VALKEY_URL` existe
- **Valkey REAL en local**: contenedor Docker `eira-valkey` (valkey/valkey:8-alpine, puerto 6380), `.env` tiene `VALKEY_URL="redis://localhost:6380"`. Claves verificadas: `eira:token:*` (TTL ~900s), `eira:otptry:*`, `eira:dl:*`. Los 67 tests pasan contra Valkey real.
- Seed perezoso `src/lib/ensure-seed.ts` llamado desde rutas API (NO instrumentation.ts — se bundlea a edge y rompe)
- `next.config.ts`: `serverExternalPackages: ["@prisma/client","prisma","ioredis"]`
- JWT: `jose`, cookie `eira_session` httpOnly 8h, secreto `JWT_SECRET`

## Auth / RBAC (nuevo)
- `/login` (con "Acceso Rápido de Demostración" 1-clic) y `/register`
- Usuarios seed: lab@ / dra.martinez@ / promotora@ / admin@eira.org.mx — password `demo1234`
- Roles: LABORATORIO, MEDICO, PROMOTORA, ADMIN. `requireSession(req,[roles])` en cada ruta staff
- ADMIN ve todos los paneles (sub-selector en dashboard); bitácora solo ADMIN+MEDICO
- AuditLog registra userId+email reales (audit() extrae sesión del req)

## Flujo clínico (nuevo)
- Estados + `REQUIERE_CONTACTO_MEDICO`: médico "Autorizar con Seguimiento Prioritario" → bloquea enlace paciente (pantalla empática "una médica te contactará") + alerta roja en paneles MEDICO/PROMOTORA; promotora puede entregar tras contacto
- SHA-256 del PDF en `study.pdfSha256` (sello en revisión y descarga); `folio` EIRA-AAAA-XXXX en cada estudio (búsqueda en promotora)
- Estado REVOCADO_POR_CORRECCION implementado: POST /api/studies/[id]/revoke (MEDICO|ADMIN,
  motivo obligatorio: identidad_incorrecta|fallo_envio|otro, newPatientId opcional) — invalida
  token en caché al instante; sin reasignación queda REVOCADO_POR_CORRECCION, con reasignación
  cambia patientId y vuelve a EN_REVISION_CLINICA. Audit: ACCESO_REVOCADO / REASIGNACION_PACIENTE.
  UI: botón "Revocar acceso" + modal en MedicoPanel (pendientes, autorizados, prioritarios, revocados).

## Notificaciones
- `src/services/notificationService.ts`: `notifyResultAvailable()` texto exacto sin datos clínicos; SimulatedMessage en BD; email si paciente tiene email
- Panel médico tras notify: tarjeta móvil + QR (`qrcode.react`) + "Copiar enlace" + PIN
- Links usan `NEXT_PUBLIC_APP_URL` (para celular real vía IP EC2)

## Guía oficial EIRA (Tamizaje Rosa)
- Seed: 8 pacientes — "Ana Ejemplo" (EN_REVISION_CLINICA, lista para demo) y "Sofía Ejemplo"
  (REQUIERE_CONTACTO_MEDICO, nota interna no expuesta). Patient.programa default "Tamizaje Rosa".
- Footer institucional en `/` + aviso en README: fundada 2017, Ciudad Guzmán Jalisco,
  +51,000 beneficiadas a sep-2026, registros ficticios, requiere revisión jurídica/clínica.

## Tests
`bash scripts/test-e2e.sh` → 67 aserciones (53 anteriores + seed oficial + revocación RBAC/motivo/
invalidación/reasignación/audit). Todo verde. `npm run build` limpio.

## Deploy
`scripts/deploy-debian.sh` (Docker+UFW+compose en EC2 Debian), Dockerfile con `ARG DB_PROVIDER=postgresql`, docker-compose con healthchecks y volúmenes.

## Pendiente / ideas
- Botón "Revocar Acceso / Desvincular PDF" (REVOCADO_POR_CORRECCION + reasignación) — era la petición 2 pendiente del usuario
- S3 real, Twilio real, firma digital de acuse, tests unitarios
