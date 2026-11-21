#!/usr/bin/env bash
# Suite E2E para la demo EIRA (con autenticación RBAC). Ejecutar con el server corriendo:
#   bash scripts/test-e2e.sh
# (opcional) BASE=http://localhost:3000 bash scripts/test-e2e.sh

BASE="${BASE:-http://localhost:3000}"
CK=.e2e-tmp/cookies.txt
mkdir -p .e2e-tmp
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo "  PASS  $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL  $1 -> $2"; }
jget() { python -c "import json,sys;print(json.load(sys.stdin)$1)" 2>/dev/null; }

echo "==> 0. Auth: login de admin demo + control de acceso"
R=$(curl -s -c "$CK" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@eira.org.mx","password":"demo1234"}')
echo "$R" | grep -q '"email":"admin@eira.org.mx"' && ok "login admin@eira.org.mx" || fail "login admin" "$R"
R=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@eira.org.mx","password":"incorrecta"}')
echo "$R" | grep -q "incorrectos" && ok "rechaza contraseña incorrecta" || fail "login bad pass" "$R"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/patients?q=Ana")
[ "$CODE" = "401" ] && ok "sin sesión -> 401 en rutas de staff" || fail "401 sin sesión" "$CODE"
R=$(curl -s -b "$CK" "$BASE/api/auth/me")
echo "$R" | grep -q '"role":"ADMIN"' && ok "GET /api/auth/me devuelve sesión ADMIN" || fail "auth me" "$R"
R=$(curl -s -c .e2e-tmp/ck2.txt -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"promotora@eira.org.mx","password":"demo1234"}')
CODE=$(curl -s -b .e2e-tmp/ck2.txt -o /dev/null -w "%{http_code}" -X POST "$BASE/api/studies/x/authorize" -H "Content-Type: application/json" -d '{}')
[ "$CODE" = "403" ] && ok "PROMOTORA no puede autorizar -> 403 (RBAC)" || fail "rbac authorize" "$CODE"

echo "==> 1. Página principal"
BODY=$(curl -s "$BASE/")
echo "$BODY" | grep -q "EIRA Movimiento Rosa" && ok "GET / contiene EIRA Movimiento Rosa" || fail "GET /" "$BODY"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/login")
[ "$CODE" = "200" ] && ok "/login accesible" || fail "login page" "$CODE"

echo "==> 2. Búsqueda de pacientes (nombre|fecha y CURP)"
R=$(curl -s -b "$CK" "$BASE/api/patients?q=Ana%7C1988-07-22")
echo "$R" | grep -q "González Ruiz" && ok "búsqueda nombre|fecha encuentra a Ana" || fail "patients?q=Ana|1988" "$R"
R=$(curl -s -b "$CK" "$BASE/api/patients?q=LOHM940315")
echo "$R" | grep -q "López Hernández" && ok "búsqueda por CURP encuentra a María" || fail "patients?q=LOHM" "$R"

echo "==> 3. Listado de estudios"
R=$(curl -s -b "$CK" "$BASE/api/studies")
N=$(echo "$R" | python -c "import json,sys;print(len(json.load(sys.stdin)['studies']))" 2>/dev/null)
[ "$N" -ge 4 ] && ok "GET /api/studies devuelve $N estudios" || fail "studies" "$R"

echo "==> 4. Subida de PDF sintético (Laboratorio)"
curl -s "$BASE/api/utils/sample-pdf" -o .e2e-tmp/t.pdf
head -c 5 .e2e-tmp/t.pdf | grep -q "%PDF-" && ok "sample-pdf devuelve PDF válido" || fail "sample-pdf" "not pdf"
PID=$(curl -s -b "$CK" "$BASE/api/patients?q=Rosa%7C1983-02-26" | jget "['patients'][0]['id']")
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies" -F "file=@.e2e-tmp/t.pdf" -F "patientId=$PID" -F "fechaToma=2026-11-21" -F "sede=Clinica Movil Tecamac")
SID=$(echo "$R" | jget "['study']['id']")
SHA=$(echo "$R" | jget "['study']['pdfSha256']")
FOLIO=$(echo "$R" | jget "['study']['folio']")
echo "$R" | grep -q "EN_REVISION_CLINICA" && ok "upload -> EN_REVISION_CLINICA ($SID)" || fail "upload" "$R"
[ -n "$SHA" ] && [ "${#SHA}" = "64" ] && ok "SHA-256 calculado y guardado" || fail "sha256" "$SHA"
echo "$FOLIO" | grep -q "^EIRA-" && ok "folio corto generado: $FOLIO" || fail "folio" "$FOLIO"

echo "==> 5. PDF no se puede subir si no es PDF"
echo "no es pdf" > .e2e-tmp/x.pdf
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies" -F "file=@.e2e-tmp/x.pdf" -F "patientId=$PID" -F "fechaToma=2026-11-21" -F "sede=X")
echo "$R" | grep -q "no es un PDF" && ok "rechaza archivo no-PDF" || fail "upload no-pdf" "$R"

echo "==> 6. Autorización clínica y seguimiento prioritario (Médico)"
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SID/authorize" -H "Content-Type: application/json" -d '{"notaMedico":"nota test"}')
echo "$R" | grep -q "AUTORIZADO_PARA_ENTREGA" && ok "authorize -> AUTORIZADO_PARA_ENTREGA" || fail "authorize" "$R"
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SID/authorize" -H "Content-Type: application/json" -d '{}')
echo "$R" | grep -q "No se puede autorizar" && ok "rechaza doble autorización" || fail "re-authorize" "$R"
# Prioritario en un estudio separado
SIDS=$(curl -s -b "$CK" -X POST "$BASE/api/studies" -F "file=@.e2e-tmp/t.pdf" -F "patientId=$PID" -F "fechaToma=2026-11-21" -F "sede=Unidad EIRA Iztapalapa" | jget "['study']['id']")
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SIDS/authorize" -H "Content-Type: application/json" -d '{"prioritario":true}')
echo "$R" | grep -q "REQUIERE_CONTACTO_MEDICO" && ok "autorizar prioritario -> REQUIERE_CONTACTO_MEDICO" || fail "prioritario" "$R"

echo "==> 7. Notificación (token + OTP + SMS simulado)"
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SID/notify" -H "Content-Type: application/json" -d '{}')
TOKEN=$(echo "$R" | jget "['token']")
OTP=$(echo "$R" | jget "['otp']")
echo "$R" | grep -q "no incluye información clínica" && ok "mensaje SMS sin datos clínicos" || fail "notify msg" "$R"
[ -n "$TOKEN" ] && ok "token generado: ${TOKEN:0:12}…  OTP=$OTP" || fail "token" "$R"

echo "==> 8. Acceso paciente: GET token"
R=$(curl -s "$BASE/api/public/token/$TOKEN")
echo "$R" | grep -q '"ok":true' && ok "GET token ok (nombre, sede, intentos)" || fail "GET token" "$R"
R=$(curl -s "$BASE/api/public/token/TOKEN_FALSO_123")
echo "$R" | grep -q "expired_or_used" && ok "token falso -> expired_or_used" || fail "token falso" "$R"

echo "==> 9. Rate-limit (3 intentos fallidos)"
R=$(curl -s -X POST "$BASE/api/public/token/$TOKEN" -H "Content-Type: application/json" -d '{"pin":"9999"}')
echo "$R" | grep -q '"intentosRestantes":2' && ok "fallo 1 -> 2 restantes" || fail "fail1" "$R"
R=$(curl -s -X POST "$BASE/api/public/token/$TOKEN" -H "Content-Type: application/json" -d '{"pin":"9999"}')
echo "$R" | grep -q '"intentosRestantes":1' && ok "fallo 2 -> 1 restante" || fail "fail2" "$R"
R=$(curl -s -X POST "$BASE/api/public/token/$TOKEN" -H "Content-Type: application/json" -d '{"pin":"9999"}')
echo "$R" | grep -q '"reason":"blocked"' && ok "fallo 3 -> blocked" || fail "fail3" "$R"
R=$(curl -s "$BASE/api/public/token/$TOKEN")
echo "$R" | grep -q '"reason":"blocked"' && ok "GET muestra blocked tras 3 fallos" || fail "GET blocked" "$R"

echo "==> 10. Reenvío desde pantalla de bloqueo"
R=$(curl -s -X POST "$BASE/api/public/token/$TOKEN/resend")
TOKEN=$(echo "$R" | jget "['token']")
OTP=$(echo "$R" | jget "['otp']")
[ -n "$TOKEN" ] && ok "resend genera nuevo token/OTP" || fail "resend" "$R"
R=$(curl -s "$BASE/api/public/token/$TOKEN")
echo "$R" | grep -q '"ok":true' && ok "nuevo token vigente" || fail "nuevo token" "$R"

echo "==> 11. Verificación con PIN correcto y descarga de un solo uso"
R=$(curl -s -X POST "$BASE/api/public/token/$TOKEN" -H "Content-Type: application/json" -d "{\"pin\":\"$OTP\"}")
echo "$R" | grep -q '"ok":true' && ok "verify PIN correcto -> downloadUrl" || fail "verify" "$R"
echo "$R" | grep -q '"pdfSha256"' && ok "verify devuelve sello SHA-256 + folio" || fail "sello" "$R"
CODE=$(curl -s -o .e2e-tmp/res.pdf -w "%{http_code}" "$BASE/api/public/token/$TOKEN/pdf")
T=$(head -c 5 .e2e-tmp/res.pdf)
[ "$CODE" = "200" ] && [ "$T" = "%PDF-" ] && ok "descarga PDF 200 + bytes válidos" || fail "pdf download" "$CODE $T"
R=$(curl -s "$BASE/api/public/token/$TOKEN/pdf")
echo "$R" | grep -q "Sesión no verificada" && ok "segundo intento -> bloqueado (un solo uso)" || fail "second download" "$R"
R=$(curl -s -b "$CK" "$BASE/api/studies" | python -c "import json,sys;print([s['estado'] for s in json.load(sys.stdin)['studies'] if s['id']=='$SID'][0])")
[ "$R" = "DESCARGADO_PACIENTE" ] && ok "estado -> DESCARGADO_PACIENTE tras descarga" || fail "estado final" "$R"

echo "==> 12. Entrega asistida (Promotora, incluye seguimiento prioritario)"
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SIDS/deliver" -H "Content-Type: application/json" -d '{"sede":"Clinica Movil Tecamac","observations":"test"}')
echo "$R" | grep -q "ENTREGADO_ASISTIDO" && ok "deliver prioritario -> ENTREGADO_ASISTIDO" || fail "deliver" "$R"
R=$(curl -s -b "$CK" "$BASE/api/studies/$SIDS/receipt")
echo "$R" | grep -q "Administradora EIRA" && ok "acuse registra al usuario logueado" || fail "receipt actor" "$R"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/acuse/$SIDS")
[ "$CODE" = "200" ] && ok "/acuse/[id] imprimible 200" || fail "acuse page" "$CODE"

echo "==> 13. Bandeja SMS simulada"
R=$(curl -s -b "$CK" "$BASE/api/notifications")
N=$(echo "$R" | python -c "import json,sys;print(len(json.load(sys.stdin)['messages']))" 2>/dev/null)
[ "$N" -ge 1 ] && ok "bandeja SMS con $N mensajes" || fail "notifications" "$R"

echo "==> 14. Bitácora de auditoría"
R=$(curl -s -b "$CK" "$BASE/api/audit")
for A in ESTUDIO_CARGADO AUTORIZACION_CLINICA NOTIFICACION_ENVIADA ACCESO_VERIFICADO ACCESO_FALLIDO RESULTADO_DESCARGADO ENTREGA_ASISTIDA_SEDE REENVIO_SOLICITADO LOGIN AUTORIZACION_PRIORITARIA; do
  echo "$R" | grep -q "$A" && ok "audit contiene $A" || fail "audit $A" "$R"
done
echo "$R" | grep -q "admin@eira.org.mx" && ok "audit registra email del usuario logueado" || fail "audit email" "$R"

echo "==> 15. Export CSV"
R=$(curl -s -b "$CK" "$BASE/api/audit/export.csv")
echo "$R" | head -1 | grep -q "estudio_id,paciente" && ok "CSV con cabecera" || fail "csv header" "$R"
echo "$R" | grep -q "DESCARGADO_PACIENTE" && ok "CSV con estados" || fail "csv estados" "$R"
echo "$R" | grep -q "nota test" && fail "CSV NO debe contener notas clínicas" "$R" || ok "CSV sin notas clínicas (LFPDPPP)"

echo "==> 16. PDF mediado por backend (staff)"
CODE=$(curl -s -b "$CK" -o /dev/null -w "%{http_code}" "$BASE/api/studies/$SID/pdf")
CT=$(curl -s -b "$CK" -o /dev/null -w "%{content_type}" "$BASE/api/studies/$SID/pdf")
[ "$CODE" = "200" ] && [ "$CT" = "application/pdf" ] && ok "PDF servido por backend autenticado ($CT)" || fail "pdf staff" "$CODE $CT"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/studies/$SID/pdf")
[ "$CODE" = "401" ] && ok "PDF de staff exige sesión -> 401" || fail "pdf sin sesión" "$CODE"

echo "==> 17. Seed oficial Tamizaje Rosa (Ana y Sofía Ejemplo)"
R=$(curl -s -b "$CK" "$BASE/api/patients?q=Ana%20Ejemplo")
echo "$R" | grep -q '"nombreCompleto":"Ana Ejemplo"' && ok "seed contiene a Ana Ejemplo" || fail "ana ejemplo" "$R"
echo "$R" | grep -q "Tamizaje Rosa" && ok "programa 'Tamizaje Rosa' en expediente" || fail "programa" "$R"
R=$(curl -s -b "$CK" "$BASE/api/studies")
echo "$R" | python -c "import json,sys;sts=json.load(sys.stdin)['studies'];assert any(s['estado']=='REQUIERE_CONTACTO_MEDICO' and s['patient']['nombreCompleto'].startswith('Sof') and s['patient']['nombreCompleto'].endswith('Ejemplo') for s in sts)" 2>/dev/null && ok "Sofia Ejemplo -> REQUIERE_CONTACTO_MEDICO" || fail "sofia prioritaria" "$R"
echo "$R" | python -c "import json,sys;sts=json.load(sys.stdin)['studies'];assert any(s['estado']=='EN_REVISION_CLINICA' and s['patient']['nombreCompleto']=='Ana Ejemplo' for s in sts)" 2>/dev/null && ok "Ana Ejemplo -> EN_REVISION_CLINICA (lista p/ demo)" || fail "ana lista" "$R"

echo "==> 18. Revocación de acceso / desvincular PDF (contingencia)"
# Estudio propio: autoriza + notifica para tener token vivo
SRV=$(curl -s -b "$CK" -X POST "$BASE/api/studies" -F "file=@.e2e-tmp/t.pdf" -F "patientId=$PID" -F "fechaToma=2026-11-22" -F "sede=Unidad EIRA Iztapalapa" | jget "['study']['id']")
curl -s -b "$CK" -X POST "$BASE/api/studies/$SRV/authorize" -H "Content-Type: application/json" -d '{}' > /dev/null
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SRV/notify" -H "Content-Type: application/json" -d '{}')
TRV=$(echo "$R" | jget "['token']")
R=$(curl -s "$BASE/api/public/token/$TRV")
echo "$R" | grep -q '"ok":true' && ok "token vigente antes de revocar" || fail "token previo" "$R"
# Motivo obligatorio
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SRV/revoke" -H "Content-Type: application/json" -d '{}')
echo "$R" | grep -q "Motivo inválido" && ok "revocar sin motivo -> 400" || fail "revoke sin motivo" "$R"
# RBAC: PROMOTORA no puede revocar
CODE=$(curl -s -b .e2e-tmp/ck2.txt -o /dev/null -w "%{http_code}" -X POST "$BASE/api/studies/$SRV/revoke" -H "Content-Type: application/json" -d '{"reason":"fallo_envio"}')
[ "$CODE" = "403" ] && ok "PROMOTORA no puede revocar -> 403" || fail "rbac revoke" "$CODE"
# Revocar (ADMIN/MEDICO)
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SRV/revoke" -H "Content-Type: application/json" -d '{"reason":"identidad_incorrecta","reasonDetail":"homónimo"}')
echo "$R" | grep -q "REVOCADO_POR_CORRECCION" && ok "revocar -> REVOCADO_POR_CORRECCION" || fail "revoke" "$R"
R=$(curl -s "$BASE/api/public/token/$TRV")
echo "$R" | grep -q "expired_or_used" && ok "token invalidado de inmediato" || fail "token revocado" "$R"
# Reasignación del PDF al expediente correcto
PID2=$(curl -s -b "$CK" "$BASE/api/patients?q=Carmen%7C1991-05-12" | jget "['patients'][0]['id']")
R=$(curl -s -b "$CK" -X POST "$BASE/api/studies/$SRV/revoke" -H "Content-Type: application/json" -d "{\"reason\":\"identidad_incorrecta\",\"newPatientId\":\"$PID2\"}")
echo "$R" | grep -q "EN_REVISION_CLINICA" && ok "reasignación -> EN_REVISION_CLINICA" || fail "reasignar" "$R"
echo "$R" | grep -q "\"patientId\":\"$PID2\"" && ok "PDF reasignado al expediente correcto" || fail "nuevo expediente" "$R"
# Audit inmutable
R=$(curl -s -b "$CK" "$BASE/api/audit")
echo "$R" | grep -q "ACCESO_REVOCADO" && ok "bitácora registra ACCESO_REVOCADO" || fail "audit revoke" "$R"
echo "$R" | grep -q "REASIGNACION_PACIENTE" && ok "bitácora registra REASIGNACION_PACIENTE" || fail "audit reasign" "$R"
echo "$R" | grep -q "identidad_incorrecta" && ok "audit incluye motivo de corrección" || fail "audit motivo" "$R"

echo
echo "==============================================="
echo "  RESULTADO: $PASS passed / $FAIL failed"
echo "==============================================="
exit $FAIL
