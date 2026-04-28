#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}${BOLD}"
echo "  _    _                      _____  _ _   _          _____ "
echo " | |  | |                    |  __ \(_) \ | |   /\    / ____|"
echo " | |__| | ___  _ __ ___   ___| |__) |_|  \| |  /  \  | (___  "
echo " |  __  |/ _ \| '_ \` _ \ / _ \  ___/| | . \` | / /\ \  \___ \ "
echo " | |  | | (_) | | | | | |  __/ |    | | |\  |/ ____ \ ____) |"
echo " |_|  |_|\___/|_| |_| |_|\___|_|    |_|_| \_/_/    \_\_____/ "
echo -e "${NC}"
echo -e "${BOLD}Iniciando instalación de HomeVault...${NC}\n"

INSTALL_DIR="/opt/homevault"
FRONTEND_DIR="$INSTALL_DIR/frontend"
FRONTEND_DIST="$FRONTEND_DIR/dist"
DATA_DIR="$INSTALL_DIR/data"
DB_FILE="$DATA_DIR/homevault.db"
BACKEND_PORT=3000
SERVICE_NAME="homevault"
NGINX_SITE="/etc/nginx/sites-available/homevault"

log_step() {
  echo -e "${CYAN}$1${NC}"
}

if [ "${EUID}" -ne 0 ]; then
  echo -e "${RED}Error: Este script debe ejecutarse con privilegios de ROOT.${NC}"
  exit 1
fi

if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [[ "${ID}" != "debian" && "${ID}" != "raspbian" && "${ID}" != "ubuntu" ]]; then
    echo -e "${YELLOW}Aviso: distribución no validada oficialmente. Continuando igualmente...${NC}"
  fi
else
  echo -e "${RED}Error: no se pudo determinar el sistema operativo.${NC}"
  exit 1
fi

log_step "[1/7] Actualizando sistema e instalando dependencias base..."
apt-get update -y
apt-get install -y build-essential curl git rsync util-linux python3-minimal nginx mergerfs snapraid smartmontools wireguard htop ufw --no-install-recommends || true

if ! command -v docker >/dev/null 2>&1; then
  log_step "[2/7] Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo -e "${GREEN}Docker ya está instalado.${NC}"
fi

if ! command -v node >/dev/null 2>&1; then
  log_step "[3/7] Instalando Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo -e "${GREEN}Node.js ya está instalado ($(node -v)).${NC}"
fi

log_step "[4/7] Desplegando archivos de la aplicación..."

if [ -d "./src" ] && [ -f "./package.json" ] && [ -d "./frontend" ]; then
  mkdir -p "$INSTALL_DIR"
  rsync -a --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "frontend/node_modules" \
    --exclude "dist" \
    --exclude "frontend/dist" \
    ./ "$INSTALL_DIR/"
else
  if [ ! -d "$INSTALL_DIR/.git" ]; then
    # Si la carpeta existe pero no tiene .git, la borramos para poder clonar
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
    fi
    git clone https://github.com/virtuspro28/homevault.git "$INSTALL_DIR"
  else
    echo -e "${BLUE}Actualizando código desde GitHub...${NC}"
    git -C "$INSTALL_DIR" fetch --all
    git -C "$INSTALL_DIR" reset --hard origin/main
  fi
fi

# AHORA creamos las carpetas de datos (después de clonar)
mkdir -p "$DATA_DIR"
cd "$INSTALL_DIR"
touch "$DB_FILE"


log_step "[5/7] Instalando dependencias, generando Prisma y compilando..."
# Limpiar instalaciones previas para asegurar frescura
rm -rf dist frontend/dist

npm install
cd "$FRONTEND_DIR"
npm install
npm run build
cd "$INSTALL_DIR"

npx prisma generate
npx prisma db push --accept-data-loss

# Compilación del backend con verificación estricta
echo -e "${CYAN}Compilando Backend...${NC}"
npm run build || { echo -e "${RED}Error crítico: la compilación del backend falló.${NC}"; exit 1; }


log_step "[6/7] Ajustando permisos y servicio del backend..."
chmod 755 /opt
chmod 755 "$INSTALL_DIR"
chmod 755 "$FRONTEND_DIR"
chmod 755 "$FRONTEND_DIST"
find "$FRONTEND_DIST" -type d -exec chmod 755 {} \;
find "$FRONTEND_DIST" -type f -exec chmod 644 {} \;
chown -R root:www-data "$FRONTEND_DIST"
chmod 775 "$DATA_DIR"
touch "$DB_FILE"
chown root:root "$DB_FILE"
chmod 664 "$DB_FILE"

cat <<EOF > "/etc/systemd/system/${SERVICE_NAME}.service"
[Unit]
Description=HomeVault Dashboard (Backend API)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$BACKEND_PORT

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo -e "${CYAN}Esperando al backend...${NC}"
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    echo -e "${GREEN}Backend operativo en puerto ${BACKEND_PORT}.${NC}"
    break
  fi
  sleep 1
done

log_step "[7/7] Configurando Nginx para SPA + proxy API..."
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default

cat <<EOF > "$NGINX_SITE"
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/homevault/frontend/dist;
    index index.html;
    server_tokens off;
    client_max_body_size 5G;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        font/woff2;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/homevault
nginx -t
systemctl enable nginx
systemctl restart nginx

LOCAL_IP="$(hostname -I | awk '{print $1}')"
echo ""
echo -e "${GREEN}${BOLD}HomeVault ha sido instalado correctamente.${NC}"
echo -e "Accede desde: ${BOLD}http://${LOCAL_IP}${NC}"
echo -e "Base de datos SQLite: ${BOLD}${DB_FILE}${NC}"
echo -e "Logs del backend: ${BOLD}journalctl -u ${SERVICE_NAME} -f${NC}"
