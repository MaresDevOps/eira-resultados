# EIRA Movimiento Rosa A.C. — Entrega digital segura de resultados de Papanicolaou

**Reto 4 · Vibeathon Nerdearla 2026 · Prototipo funcional**

🔗 **Demo en vivo:** https://18.217.201.5.sslip.io (AWS EC2 · HTTPS con Let's Encrypt · Docker: app + PostgreSQL + Valkey + Caddy)
Usuarios demo en la sección 1 — contraseña `demo1234` o acceso rápido de 1 clic.

Desarrollado para el **Programa Tamizaje Rosa** de **EIRA, Movimiento Rosa A.C.**
(fundada en 2017, Ciudad Guzmán, Jalisco; más de **51,000 personas beneficiadas**
acumuladas a septiembre de 2026).

Plataforma web que sustituye el envío manual de PDFs de resultados médicos por WhatsApp:
entrega segura, auditable y accesible para pacientes con habilidades digitales limitadas
o sin conectividad propia.

> ⚠️ **Aviso:** Todos los registros del repositorio son **ficticios** (pacientes, usuarios,
> estudios y PDFs). Cualquier despliegue con pacientes reales requiere **revisión
> jurídica y clínica previa** (LFPDPPP y normativa de salud vigente).

---


## 1. Instalación y ejecución (2 comandos)

```bash
npm install
npm run dev
```

Abrir http://localhost:3000 — el seed corre automáticamente en el primer request
(8 pacientes —incluyendo el caso oficial **Ana Ejemplo** con un estudio listo para
autorizar y **Sofía Ejemplo** con hallazgo que requiere contacto médico prioritario—,
7 estudios en distintos estados, 2 PDFs sintéticos, 4 usuarios demo y bitácora inicial).

### Usuarios de demostración (contraseña: `demo1234`)

| Email | Rol | Acceso |
|---|---|---|
| `lab@eira.org.mx` | LABORATORIO | Carga de PDFs y validación de identidad |
| `dra.martinez@eira.org.mx` | MEDICO | Revisión clínica, autorización, seguimiento prioritario |
| `promotora@eira.org.mx` | PROMOTORA | Entrega asistida en sede/clínica móvil |
| `admin@eira.org.mx` | ADMIN | Acceso total + bitácora + métricas |

En `/login` hay un panel **"Acceso Rápido de Demostración (1 clic)"** con esos 4 usuarios.
En `/register` se puede dar de alta personal nuevo (demo abierta; en producción lo haría solo un ADMIN).

### Verificación end-to-end

```bash
bash scripts/test-e2e.sh   # 53 aserciones contra el server corriendo
```

---

## 2. Arquitectura técnica

```
┌────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router) · TypeScript · Tailwind CSS       │
│  ├─ /login + /register (bcryptjs + JWT cookie httpOnly)    │
│  ├─ Dashboard staff por rol (RBAC server-side en cada API) │
│  └─ /acceso/[token] móvil, alto contraste, "A+ Texto grande"│
├────────────────────────────────────────────────────────────┤
│  Route Handlers (API) — todas las rutas de staff verifican │
│  sesión JWT + rol (requireSession). Públicas: solo          │
│  /api/public/token/* (flujo paciente) y /api/auth/*        │
├──────────────┬──────────────────┬──────────────────────────┤
│  Prisma +    │  Valkey/Redis    │  /storage/pdfs           │
│  SQLite o    │  (ioredis) o     │  (bucket S3 privado      │
│  PostgreSQL  │  fallback en     │  simulado; acceso solo   │
│  (estudios,  │  memoria         │  vía backend autenticado │
│  usuarios,   │  TTL 15 min ·    │  o token+OTP verificado) │
│  bitácora)   │  OTP · 3 intentos│                          │
└──────────────┴──────────────────┴──────────────────────────┘
```

- **RBAC real:** contraseñas con `bcryptjs`, sesión JWT (`jose`) en cookie
  `httpOnly` + `sameSite=lax`. `src/lib/auth.ts` exporta `requireSession(req, roles)`.
  La bitácora registra `userId` y `email` del usuario autenticado en cada evento.
- **Integridad:** SHA-256 de cada PDF al subirlo; se muestra como sello
  "Documento íntegro" en revisión médica y descarga de paciente.
- **Folio corto:** `EIRA-AAAA-XXXX` por estudio, para búsqueda en entrega asistida sin internet.
- **Seguimiento clínico prioritario:** el médico puede marcar `REQUIERE_CONTACTO_MEDICO`
  → bloquea el enlace de la paciente (mensaje empático) y alerta a PROMOTORA/MEDICO.
- **Revocación y corrección de asociación:** ADMIN y MEDICO pueden pulsar
  **"Revocar acceso"** en cualquier estudio (motivo obligatorio: *error de asociación
  de identidad*, *fallo en envío* u otro). Invalida el token en Valkey al instante,
  marca `REVOCADO_POR_CORRECCION` (o `EN_REVISION_CLINICA` si se reasigna el PDF al
  expediente correcto) y deja registro inmutable en la bitácora.
- **Notificaciones (Adapter):** `src/services/notificationService.ts` con
  `SMS_PROVIDER=mock|sns|twilio` y `SMTP_ENABLED` + nodemailer para correo real.
  SMS **nunca** contiene datos clínicos. El panel muestra el mensaje en formato
  de pantalla móvil + QR escaneable (`NEXT_PUBLIC_APP_URL` permite abrirlo desde
  un celular real en la misma red/EC2).
- **Valkey:** tokens de un solo uso (15 min), OTP 4 dígitos, rate-limit 3 intentos,
  ticket de descarga (10 min). Si no hay `VALKEY_URL` → fallback en memoria
  (`globalThis`), la demo nunca falla.
- **PDFs:** `storage/pdfs` simula bucket privado S3; solo se sirven por Route
  Handlers con sesión de staff o ticket de paciente verificado.

### Flujo de estados

`CARGADO → EN_REVISION_CLINICA → AUTORIZADO_PARA_ENTREGA → NOTIFICADO →
DESCARGADO_PACIENTE | ENTREGADO_ASISTIDO`
 └─ alternativa clínica: `REQUIERE_CONTACTO_MEDICO` (bloquea descarga,
  exige llamada médica; la promotora puede entregar asistida tras contacto)
 └─ contingencia: `REVOCADO_POR_CORRECCION` (token invalidado; el PDF puede
  reasignarse al expediente correcto y volver a revisión clínica)

---

## 3. Lo implementado vs. lo simulado

| Implementado (funciona de verdad) | Simulado (para la demo) |
|---|---|
| Login + registro con bcrypt y JWT httpOnly | Usuarios demo del seed con contraseña común |
| RBAC server-side en todas las rutas de staff | Registro abierto (en prod: solo ADMIN) |
| Tokens 15 min, un solo uso, OTP 4 díg., 3 intentos | OTP = últimos 4 dígitos del teléfono |
| SMS/correo vía Adapter (`notificationService`) | Envío real Twilio/SNS → bandeja visual + QR |
| SHA-256 por PDF + sello de integridad | Bucket S3 → carpeta local `storage/pdfs` |
| Folio corto EIRA-AAAA-XXXX | Certificado de firmado de acuse → impresión |
| Estado REQUIERE_CONTACTO_MEDICO con bloqueo | — |
| Revocación de acceso + reasignación de PDF al expediente correcto | — |
| Bitácora con userId + email + IP + timestamp | IP real → x-forwarded-for/local |
| Acuse de entrega imprimible + CSV de métricas | Datos 100% ficticios |
| Botón "A+ Texto grande / Alto contraste" en paciente | — |

---

## 4. Despliegue en AWS EC2 (Debian)

```bash
git clone https://github.com/MaresDevOps/eira-resultados.git && cd eira-resultados
sudo bash scripts/deploy-debian.sh https://github.com/MaresDevOps/eira-resultados.git
```

El script instala Docker, abre UFW (22 + 3000), genera `.env` con
`JWT_SECRET` aleatorio y `NEXT_PUBLIC_APP_URL` con la IP pública, y levanta
`docker compose` (app + PostgreSQL + Valkey).

Variables relevantes: ver `.env.example`. Para HTTPS detrás de un proxy con
dominio: `COOKIE_SECURE=1`, `NEXT_PUBLIC_APP_URL=https://midominio` y abrir 443.

> Nota Prisma: el `schema.prisma` por defecto usa SQLite. El `Dockerfile`
> acepta `ARG DB_PROVIDER=postgresql` (docker-compose ya lo pasa) para
> reescribir el provider antes de compilar.

---

## 5. Matriz de riesgos, privacidad y operación

### Privacidad — LFPDPPP / datos sensibles de salud

| Riesgo | Mitigación implementada | Pendiente para producción |
|---|---|---|
| Datos de salud = datos sensibles (LFPDPPP) | Consentimiento + aviso de privacidad pendientes | Redactar aviso de privacidad con EIRA |
| Filtración del link | Token 192 bits, 15 min, un solo uso, 3 intentos | Rotación + alerta de IP nueva |
| Exposición de PDFs | Solo backend autenticado o token+OTP verificado | S3 privado + SSE-KMS + signed URLs |
| Mensajes con datos clínicos | Texto regulado en `buildSmsBody()` (sin diagnósticos) | Revisión legal de la plantilla |
| Acceso interno no autorizado | RBAC por rol + bitácora con userId/email | SSO/OIDC corporativo, MFA médicos |
| Homónimos | Búsqueda exige nombre + fecha/CURP + alerta | Verificación biométrica o doble check |
| Integridad del documento | SHA-256 calculado y mostrado en 2 pantallas | Firma digital / notarización |
| Pérdida de evidencia | Acuse + bitácora | WORM / append-only storage |
| Asociación errónea de PDF (homónimo) | Revocación 1-clic: invalida token al instante + reasignación auditada | Doble confirmación de identidad al cargar |

### Operación por personal no técnico

- UI mobile-first, botones grandes, alto contraste, español llano.
- Login de 1 clic para la demo; flujo lineal guiado por estados.
- "A+ Texto grande / Alto contraste" en la vista de la paciente.
- Seguimiento prioritario: alerta roja en paneles de MEDICO y PROMOTORA.

### Costos mensuales AWS (piloto 300–500 estudios/mes)

| Servicio | Configuración | ~USD/mes |
|---|---|---|
| ECS Fargate / App Runner (Next.js) | 1 vCPU / 2 GB | $30–45 |
| RDS PostgreSQL | db.t4g.micro, 20 GB | $15 |
| ElastiCache (Valkey) | cache.t4g.micro | $12 |
| S3 privado | <1 GB | <$1 |
| SNS / Twilio SMS | 500 SMS | $10–15 |
| CloudWatch | 30 días retención | $5 |
| Route53 + ALB/CloudFront | dominio + TLS | $5–10 |
| **Total** | | **~$80–100** |

---

## 6. Preguntas abiertas para EIRA

1. ¿Resultado en pantalla con lenguaje llano además del PDF?
2. ¿Contenido mínimo permitido del SMS según normativa interna?
3. ¿Quién autoriza: médico tratante, patóloga o doble firma para hallazgos?
4. ¿Paciente sin celular propio (usa el de un familiar): consentimiento adicional?
5. ¿Flujo diferenciado para resultados positivos (cita obligatoria)?
6. ¿Retención de nota médica interna (años, NOM/LFPDPPP)?
7. ¿Acuse requiere firma autógrafa digitalizada?
8. ¿Volumen real del piloto? (300–500/mes es supuesto de la rúbrica)

---

## Estructura del repo

```
prisma/            schema + seed (8 pacientes incl. Ana/Sofía Ejemplo, 7 estudios, 4 usuarios demo)
src/app/           páginas (/login, /register, /, /acceso/[token], /acuse/[id])
src/app/api/       Route Handlers (staff protegidos por RBAC; /public solo paciente)
src/components/    paneles por rol, header con usuario activo, métricas
src/lib/           auth (bcrypt+jose), db, cache (Valkey/memoria), audit, pdf, seed
src/services/      notificationService (Adapter: mock / SNS / Twilio / SMTP)
storage/pdfs/      "bucket privado" local
scripts/           test-e2e.sh (53 pruebas), deploy-debian.sh
Dockerfile, docker-compose.yml, .env.example, LICENSE (MIT)
```
