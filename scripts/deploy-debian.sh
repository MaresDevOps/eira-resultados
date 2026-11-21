#!/usr/bin/env bash
# Despliegue automático de EIRA Resultados en Debian 12 (AWS EC2 u otra VM).
#
#   chmod +x scripts/deploy-debian.sh
#   sudo bash scripts/deploy-debian.sh
#
# Requisitos: repo ya clonado o pasar URL del repo como argumento:
#   sudo bash scripts/deploy-debian.sh https://github.com/TU_ORG/eira-resultados.git

set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="/opt/eira-resultados"
PORT="${PORT:-3000}"

echo "==> Actualizando paquetes"
apt-get update -y && apt-get upgrade -y

echo "==> Instalando Docker + plugin compose"
if ! command -v docker >/dev/null; then
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> Configurando firewall UFW"
apt-get install -y ufw
ufw allow OpenSSH
ufw allow ${PORT}/tcp
# Para HTTPS futuro con reverse proxy: ufw allow 443/tcp
ufw --force enable

echo "==> Obteniendo el código"
if [ -n "$REPO_URL" ]; then
  apt-get install -y git
  if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR" && git pull --ff-only
  else
    git clone "$REPO_URL" "$APP_DIR"
  fi
else
  # Ejecutado desde dentro del repo: copiar a APP_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  mkdir -p "$APP_DIR"
  cp -r "$SCRIPT_DIR"/. "$APP_DIR"/
fi
cd "$APP_DIR"

echo "==> Generando .env de producción"
JWT_SECRET="$(openssl rand -base64 32)"
PUBLIC_IP="$(curl -s --max-time 5 http://checkip.amazonaws.com || echo localhost)"
cat > .env <<EOF
POSTGRES_USER=eira
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=eira
JWT_SECRET=${JWT_SECRET}
NEXT_PUBLIC_APP_URL=http://${PUBLIC_IP}:${PORT}
SMS_PROVIDER=mock
SMTP_ENABLED=false
COOKIE_SECURE=0
EOF
chmod 600 .env

echo "==> Construyendo y levantando el stack"
docker compose up -d --build

echo ""
echo "======================================================"
echo "  EIRA desplegado en: http://${PUBLIC_IP}:${PORT}"
echo "  Usuarios demo: ver README.md (seed automático)"
echo "  Logs: docker compose logs -f app"
echo "======================================================"
