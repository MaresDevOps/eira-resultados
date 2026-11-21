# CONTEXTO DE SESIÓN — EIRA Reto 4 (handoff actualizado)

## Estado: prototipo completo + RBAC + Valkey real + guía oficial EIRA. 67/67 tests E2E, build limpio, en GitHub.
Repo local: `C:\Users\mares\OneDrive\Escritorio\EIRA-resultados`
GitHub: https://github.com/MaresDevOps/eira-resultados (público, rama main)
Correr: `docker start eira-valkey` (Valkey real) + `npm run dev` → http://localhost:3000
Tests: `bash scripts/test-e2e.sh` · Video demo: `node scripts/record-demo.mjs` → `demo-video/*.webm`

## Stack y decisiones (NO revertir)
- Next.js 15 App Router + TS + **Tailwind v3** (v4 rompe en Windows)
- Prisma + **SQLite** (`prisma/dev.db`); Postgres en Docker vía `ARG DB_PROVIDER=postgresql`
- **Valkey REAL**: contenedor `eira-valkey` (valkey/valkey:8-alpine, puerto **6380**, el 6379 está ocupado por otro proyecto). `.env`: `VALKEY_URL="redis://localhost:6380"`. cache.ts usa `globalThis`; ioredis solo si VALKEY_URL existe; fallback memoria.
- Seed perezoso `src/lib/ensure-seed.ts` (NO instrumentation.ts). OJO: tras `db push --force-reset` hay que reiniciar el dev server (la promesa de seed queda cacheada).
- `next.config.ts`: `serverExternalPackages` prisma/ioredis + `devIndicators:false` (quita el badge "N")
- JWT `jose` cookie `eira_session` httpOnly 8h; bcrypt `bcryptjs`

## Auth / RBAC
- `/login` (Acceso Rápido 1-clic) + `/register`; usuarios: lab@ / dra.martinez@ / promotora@ / admin@eira.org.mx — `demo1234`
- Roles LABORATORIO/MEDICO/PROMOTORA/ADMIN; `requireSession(req,[roles])`; ADMIN opera todos los paneles; bitácora ADMIN+MEDICO
- AuditLog con userId+email reales

## Flujo + guía oficial
- Estados: CARGADO→EN_REVISION_CLINICA→AUTORIZADO_PARA_ENTREGA→NOTIFICADO→DESCARGADO_PACIENTE|ENTREGADO_ASISTIDO
  + `REQUIERE_CONTACTO_MEDICO` (bloquea descarga, alerta roja) + `REVOCADO_POR_CORRECCION`
- Revocación: POST `/api/studies/[id]/revoke` (MEDICO|ADMIN, motivo obligatorio identidad_incorrecta|fallo_envio|otro, `newPatientId` opcional → reasigna y vuelve a EN_REVISION). Modal "Revocar acceso" en MedicoPanel. Audit: ACCESO_REVOCADO/REASIGNACION_PACIENTE.
- Seed: 8 pacientes. **Ana Ejemplo** (EN_REVISION, lista para demo) y **Sofía Ejemplo** (REQUIERE_CONTACTO_MEDICO, nota interna no expuesta). `Patient.programa` default "Tamizaje Rosa"
- SHA-256 por PDF (sello "Documento íntegro"), folio `EIRA-AAAA-XXXX`, QR en notify-card + por mensaje en Bandeja SMS, A+ alto contraste en vista paciente, métricas dashboard

## Branding (eiraac.org)
Logo = wordmark texto "EIRA" `#e88d8d`. Paleta: --rosa #b7426c, --rosa-logo #e88d8d, --rosa-claro #ffebee, --rosa-oscuro #6a2b51. Footer + README: Tamizaje Rosa, fundada 2017, Ciudad Guzmán Jalisco, +51,000 beneficiadas sep-2026, disclaimer ficticios + revisión jurídica/clínica.

## Gotchas conocidos (Windows)
- `.next` se corrompe a veces → `rm -rf .next && npm run dev`
- `prisma generate` falla con EPERM si el dev server corre (DLL bloqueada) → matar server primero
- Git Bash transcodi­fica args UTF-8 a cp1252 → el mojibake en tests era eso; el server maneja UTF-8 perfecto (verificado con Node/FormData)
- `.env`, dev.db, demo-video/ no se commitean

## Tests: 67 aserciones verdes
Incl. auth 401/403, upload+sha256+folio, prioritario, token TTL/OTP/3-fallos/resend/un-solo-uso, entrega asistida, SMS bandeja, audit+email, CSV sin datos clínicos, seed oficial, revocación completa.

## Pendiente / ideas
- Deploy real a EC2 (`scripts/deploy-debian.sh` listo, no ejecutado en AWS)
- Postgres en local si quieren probar docker-compose completo
- S3/Twilio reales, SSO, firma digital de acuse, resultado en lenguaje llano en pantalla
- playwright quedó como devDependency (para record-demo.mjs) — quitar si no se quiere
