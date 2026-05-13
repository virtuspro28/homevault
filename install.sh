#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

INSTALL_DIR="/opt/homevault"
FRONTEND_DIR="$INSTALL_DIR/frontend"
FRONTEND_DIST="$FRONTEND_DIR/dist"
DATA_DIR="$INSTALL_DIR/data"
REMOTE_MOUNT_DIR="$INSTALL_DIR/remote"
DB_FILE="$DATA_DIR/homevault.db"
ENV_FILE="$INSTALL_DIR/.env"
BACKEND_PORT=3000
SERVICE_NAME="homevault"
NGINX_SITE="/etc/nginx/sites-available/homevault"
SYSTEMD_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
RCLONE_RESTORE_SYSTEMD_FILE="/etc/systemd/system/homevault-rclone-restore.service"
DEFAULT_REPO_URL="https://github.com/virtuspro28/homevault.git"

ARCH="$(uname -m)"
IS_PI_ARCH=0
OPTIONAL_PI_PACKAGES=()

case "$ARCH" in
  aarch64|arm64|armv7l|armv6l)
    IS_PI_ARCH=1
    OPTIONAL_PI_PACKAGES=(i2c-tools libraspberrypi-bin)
    ;;
  x86_64|amd64)
    IS_PI_ARCH=0
    ;;
  *)
    IS_PI_ARCH=0
    ;;
esac

echo -e "${BLUE}${BOLD}"
echo "  _    _                      __      __         _ _   "
echo " | |  | |                     \ \    / /        | | |  "
echo " | |__| | ___  _ __ ___   ___  \ \  / /_ _ _   _| | |_ "
echo " |  __  |/ _ \| '_ \` _ \ / _ \  \ \/ / _\` | | | | | __|"
echo " | |  | | (_) | | | | | |  __/   \  / (_| | |_| | | |_ "
echo " |_|  |_|\___/|_| |_| |_|\___|    \/ \__,_|\__,_|_|\__|"
echo -e "${NC}"
echo -e "${BOLD}Iniciando instalación de HomeVault...${NC}\n"

log_step() {
  echo -e "${CYAN}${BOLD}$1${NC}"
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

detect_local_ip() {
  local detected_ip
  detected_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"

  if [ -z "$detected_ip" ]; then
    detected_ip="127.0.0.1"
  fi

  echo "$detected_ip"
}

disable_nginx_conflict_site() {
  local site_path="$1"
  local site_name
  site_name="$(basename "$site_path")"

  if [ "$site_name" = "homevault" ]; then
    return 0
  fi

  if [ -L "$site_path" ] || [ -f "$site_path" ]; then
    log_warn "Desactivando sitio Nginx en conflicto: ${site_name}"
    rm -f "$site_path"
  fi
}

ensure_package_installed() {
  local package_name="$1"

  if dpkg -s "$package_name" >/dev/null 2>&1; then
    log_info "Paquete ya instalado: ${package_name}"
    return 0
  fi

  apt-get install -y --no-install-recommends "$package_name"
}

ensure_packages_installed() {
  local packages=("$@")
  local missing=()

  for package_name in "${packages[@]}"; do
    if ! dpkg -s "$package_name" >/dev/null 2>&1; then
      missing+=("$package_name")
    fi
  done

  if [ "${#missing[@]}" -eq 0 ]; then
    log_success "Dependencias base ya presentes."
    return 0
  fi

  apt-get install -y --no-install-recommends "${missing[@]}"
}

ensure_line_in_file() {
  local line="$1"
  local file_path="$2"

  touch "$file_path"

  if ! grep -Fqx "$line" "$file_path"; then
    echo "$line" >> "$file_path"
  fi
}

upsert_env_var() {
  local key="$1"
  local value="$2"

  touch "$ENV_FILE"

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

write_if_changed() {
  local target_file="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  cat > "$tmp_file"

  if [ ! -f "$target_file" ] || ! cmp -s "$tmp_file" "$target_file"; then
    mkdir -p "$(dirname "$target_file")"
    cp "$tmp_file" "$target_file"
  fi

  rm -f "$tmp_file"
}

ensure_service_restarted_if_needed() {
  local service_name="$1"
  systemctl daemon-reload
  systemctl enable "$service_name" >/dev/null 2>&1 || true
  systemctl restart "$service_name"
}

print_success_banner() {
  local ip_address="$1"
  echo ""
  echo -e "${GREEN}${BOLD}HomeVault instalado correctamente${NC}"
  echo -e "${GREEN}${BOLD}Panel:${NC} http://${ip_address}:3000"
  echo -e "${BLUE}${BOLD}Nginx:${NC} http://${ip_address}"
  echo -e "${CYAN}${BOLD}Datos:${NC} ${DATA_DIR}"
  echo -e "${CYAN}${BOLD}Remotas:${NC} ${REMOTE_MOUNT_DIR}"
  echo -e "${CYAN}${BOLD}Arquitectura:${NC} ${ARCH}"
  echo ""
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ] && [ -f "$INSTALL_DIR/.env.example" ]; then
    cp "$INSTALL_DIR/.env.example" "$ENV_FILE"
  fi

  local jwt_secret
  jwt_secret="$(grep '^JWT_SECRET=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d '=' -f 2- || true)"
  if [ -z "$jwt_secret" ] || [ "$jwt_secret" = "\"change-me-in-production-use-openssl-rand-base64-32\"" ]; then
    jwt_secret="\"$(openssl rand -hex 32)\""
  fi

  upsert_env_var "JWT_SECRET" "$jwt_secret"
  upsert_env_var "NODE_ENV" "production"
  upsert_env_var "PORT" "$BACKEND_PORT"
  upsert_env_var "DATA_DIR" "$DATA_DIR"
  upsert_env_var "STORAGE_BASE_PATH" "$DATA_DIR"
  upsert_env_var "HOMEVAULT_DATA_ROOT" "$DATA_DIR"
  upsert_env_var "HOMEVAULT_REMOTE_ROOT" "$REMOTE_MOUNT_DIR"
  upsert_env_var "HOMEVAULT_SERVICE_NAME" "$SERVICE_NAME"
  upsert_env_var "HOMEVAULT_UPDATE_BRANCH" "main"
  upsert_env_var "DATABASE_URL" "\"file:${DB_FILE}\""
  upsert_env_var "RCLONE_CONFIG_PATH" "\"/etc/homevault/rclone.conf\""
}

if [ "${EUID}" -ne 0 ]; then
  log_error "Este script debe ejecutarse con privilegios de root."
  exit 1
fi

if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [[ "${ID}" != "debian" && "${ID}" != "raspbian" && "${ID}" != "ubuntu" ]]; then
    log_warn "Distribución no validada oficialmente. Continuando."
  fi
else
  log_error "No se pudo determinar el sistema operativo."
  exit 1
fi

log_step "[1/8] Detectando plataforma"
if [ "$IS_PI_ARCH" -eq 1 ]; then
  log_info "Modo Raspberry Pi habilitado para ${ARCH}."
else
  log_info "Modo servidor genérico habilitado para ${ARCH}. Se omiten dependencias específicas de Raspberry Pi."
fi

log_step "[2/8] Actualizando índice APT e instalando dependencias base"
apt-get update -y
ensure_packages_installed \
  build-essential \
  curl \
  git \
  rsync \
  util-linux \
  python3-minimal \
  nginx \
  mergerfs \
  snapraid \
  smartmontools \
  wireguard \
  htop \
  ufw \
  openssl \
  rclone \
  fuse3 \
  nfs-kernel-server \
  nfs-common

if [ "${#OPTIONAL_PI_PACKAGES[@]}" -gt 0 ]; then
  log_info "Instalando módulos opcionales Raspberry Pi: ${OPTIONAL_PI_PACKAGES[*]}"
  ensure_packages_installed "${OPTIONAL_PI_PACKAGES[@]}"
fi

log_step "[3/8] Asegurando Docker Engine"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  log_success "Docker ya está instalado."
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  ensure_package_installed docker-compose-plugin
fi

log_step "[4/8] Asegurando Node.js 20"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  ensure_package_installed nodejs
else
  log_success "Node.js ya está instalado ($(node -v))."
fi

log_step "[5/8] Desplegando código de la aplicación"
mkdir -p "$INSTALL_DIR"

if [ -d "./src" ] && [ -f "./package.json" ] && [ -d "./frontend" ]; then
  rsync -a \
    --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "frontend/node_modules" \
    --exclude "dist" \
    --exclude "frontend/dist" \
    ./ "$INSTALL_DIR/"
else
  if [ ! -d "$INSTALL_DIR/.git" ]; then
    if [ -d "$INSTALL_DIR" ] && [ -n "$(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
      log_warn "Se reutiliza ${INSTALL_DIR}; no se elimina contenido ajeno."
    fi
    git clone "$DEFAULT_REPO_URL" "$INSTALL_DIR"
  else
    log_info "Repositorio ya presente en ${INSTALL_DIR}; se mantiene sin reset destructivo."
    git -C "$INSTALL_DIR" fetch --all --prune
  fi
fi

mkdir -p \
  "$DATA_DIR" \
  "$REMOTE_MOUNT_DIR" \
  "$DATA_DIR/media" \
  "$DATA_DIR/downloads" \
  "$DATA_DIR/downloads/watch" \
  "$DATA_DIR/share" \
  "$DATA_DIR/cloud" \
  "$DATA_DIR/sync" \
  "$DATA_DIR/adguard/work" \
  "$DATA_DIR/adguard/conf"

cd "$INSTALL_DIR"
ensure_env_file

log_step "[6/8] Instalando dependencias y compilando"
rm -rf dist frontend/dist
npm install
( cd "$FRONTEND_DIR" && npm install && npm run build )
npx prisma generate
npx prisma db push
npm run build

log_step "[7/8] Configurando systemd y NFS"
chmod 755 /opt "$INSTALL_DIR" "$FRONTEND_DIR"
chmod 775 "$DATA_DIR"

if [ -d "$FRONTEND_DIST" ]; then
  find "$FRONTEND_DIST" -type d -exec chmod 755 {} \;
  find "$FRONTEND_DIST" -type f -exec chmod 644 {} \;
  chown -R root:www-data "$FRONTEND_DIST"
fi

write_if_changed "$SYSTEMD_FILE" <<EOF
[Unit]
Description=HomeVault Dashboard (Backend API)
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$BACKEND_PORT

[Install]
WantedBy=multi-user.target
EOF

write_if_changed "$RCLONE_RESTORE_SYSTEMD_FILE" <<EOF
[Unit]
Description=HomeVault RClone Restore Mounts
After=network-online.target ${SERVICE_NAME}.service
Wants=network-online.target ${SERVICE_NAME}.service

[Service]
Type=oneshot
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/scripts/restore-rclone-mounts.mjs
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

ensure_line_in_file "$DATA_DIR/share *(rw,sync,no_subtree_check,no_root_squash)" "/etc/exports"
exportfs -ra
systemctl enable nfs-kernel-server >/dev/null 2>&1 || true
systemctl restart nfs-kernel-server
ensure_service_restarted_if_needed "$SERVICE_NAME"
ensure_service_restarted_if_needed "homevault-rclone-restore"

log_info "Esperando al backend..."
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    log_success "Backend operativo en puerto ${BACKEND_PORT}."
    break
  fi
  sleep 1
done

log_step "[8/8] Configurando Nginx"
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default

if [ -d /etc/nginx/sites-enabled ]; then
  while IFS= read -r enabled_site; do
    [ -n "$enabled_site" ] || continue
    if grep -Eq 'default_server|server_name[[:space:]]+_;' "$enabled_site"; then
      disable_nginx_conflict_site "$enabled_site"
    fi
  done < <(find /etc/nginx/sites-enabled -maxdepth 1 \( -type l -o -type f \))
fi

write_if_changed "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
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

LOCAL_IP="$(detect_local_ip)"
print_success_banner "$LOCAL_IP"
echo -e "${CYAN}Base de datos SQLite:${NC} ${DB_FILE}"
echo -e "${CYAN}Logs del backend:${NC} journalctl -u ${SERVICE_NAME} -f"
