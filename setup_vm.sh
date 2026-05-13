#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="homevault"
BACKEND_PORT="3000"
ENV_FILE="${PROJECT_ROOT}/.env"
EXPORTS_FILE="/etc/exports"
SHARE_DIR="${PROJECT_ROOT}/data/share"
RCLONE_RESTORE_SERVICE="homevault-rclone-restore.service"

log() {
  printf '[setup_vm] %s\n' "$1"
}

require_root() {
  if [ "${EUID}" -ne 0 ]; then
    log "Reejecutando con sudo..."
    exec sudo bash "$0" "$@"
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_apt_packages() {
  local missing=()
  for package_name in "$@"; do
    if ! dpkg -s "$package_name" >/dev/null 2>&1; then
      missing+=("$package_name")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    apt-get install -y --no-install-recommends "${missing[@]}"
  fi
}

upsert_env_var() {
  local key="$1"
  local value="$2"

  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

ensure_line_in_file() {
  local line="$1"
  local file_path="$2"

  touch "$file_path"
  if ! grep -Fqx "$line" "$file_path"; then
    printf '%s\n' "$line" >> "$file_path"
  fi
}

write_if_changed() {
  local target_file="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  cat > "$tmp_file"

  if [ ! -f "$target_file" ] || ! cmp -s "$tmp_file" "$target_file"; then
    cp "$tmp_file" "$target_file"
  fi

  rm -f "$tmp_file"
}

ensure_node_20() {
  if command_exists node; then
    local major
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$major" -ge 20 ]; then
      return 0
    fi
  fi

  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  ensure_apt_packages nodejs
}

ensure_docker() {
  if ! command_exists docker; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  fi

  if ! docker compose version >/dev/null 2>&1; then
    ensure_apt_packages docker-compose-plugin
  fi
}

ensure_runtime_dirs() {
  mkdir -p \
    "${PROJECT_ROOT}/data" \
    "${PROJECT_ROOT}/logs" \
    "${PROJECT_ROOT}/backups" \
    "${PROJECT_ROOT}/remote" \
    "${PROJECT_ROOT}/data/share" \
    "${PROJECT_ROOT}/data/media" \
    "${PROJECT_ROOT}/data/cloud" \
    "${PROJECT_ROOT}/data/sync" \
    "${PROJECT_ROOT}/data/downloads/watch" \
    "${PROJECT_ROOT}/data/adguard/work" \
    "${PROJECT_ROOT}/data/adguard/conf"
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ] && [ -f "${PROJECT_ROOT}/.env.example" ]; then
    cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
  fi

  local jwt_secret
  jwt_secret="$(grep '^JWT_SECRET=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d '=' -f 2- || true)"
  if [ -z "$jwt_secret" ]; then
    jwt_secret="$(openssl rand -hex 32)"
  fi

  upsert_env_var "JWT_SECRET" "$jwt_secret"
  upsert_env_var "DATABASE_URL" "\"file:${PROJECT_ROOT}/data/homevault.db\""
  upsert_env_var "DATA_DIR" "${PROJECT_ROOT}/data"
  upsert_env_var "STORAGE_BASE_PATH" "${PROJECT_ROOT}/data"
  upsert_env_var "HOMEVAULT_DATA_ROOT" "${PROJECT_ROOT}/data"
  upsert_env_var "HOMEVAULT_REMOTE_ROOT" "${PROJECT_ROOT}/remote"
  upsert_env_var "RCLONE_CONFIG_PATH" "\"/etc/homevault/rclone.conf\""
  upsert_env_var "HOMEVAULT_SERVICE_NAME" "${SERVICE_NAME}"
  upsert_env_var "HOMEVAULT_UPDATE_BRANCH" "main"
  upsert_env_var "PORT" "${BACKEND_PORT}"
  upsert_env_var "NODE_ENV" "production"
}

build_application() {
  log "Instalando dependencias del backend..."
  (cd "$PROJECT_ROOT" && npm install)

  log "Instalando dependencias del frontend..."
  (cd "$PROJECT_ROOT/frontend" && npm install && npm run build)

  log "Generando Prisma y compilando HomeVault..."
  (
      cd "$PROJECT_ROOT" && \
    npx prisma generate && \
    npx prisma db push && \
    npm run build
  )
}

install_systemd_service() {
  write_if_changed "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=HomeVault Dashboard (VM deployment)
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/env npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=${BACKEND_PORT}

[Install]
WantedBy=multi-user.target
EOF

  write_if_changed "/etc/systemd/system/${RCLONE_RESTORE_SERVICE}" <<EOF
[Unit]
Description=HomeVault RClone Restore Mounts
After=network-online.target ${SERVICE_NAME}.service
Wants=network-online.target ${SERVICE_NAME}.service

[Service]
Type=oneshot
User=root
WorkingDirectory=${PROJECT_ROOT}
ExecStart=/usr/bin/node ${PROJECT_ROOT}/scripts/restore-rclone-mounts.mjs
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}"
  systemctl enable --now "${RCLONE_RESTORE_SERVICE}"
}

setup_nfs() {
  local resolved_share_dir
  resolved_share_dir="$(realpath "${SHARE_DIR}")"
  ensure_line_in_file "${resolved_share_dir} *(rw,sync,no_subtree_check,no_root_squash)" "$EXPORTS_FILE"
  exportfs -ra
  systemctl enable --now nfs-kernel-server
}

start_containers() {
  (cd "$PROJECT_ROOT" && docker compose up -d adguardhome backup-cron)
}

wait_for_backend() {
  local attempt
  for attempt in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
      log "Backend disponible en http://127.0.0.1:${BACKEND_PORT}"
      return 0
    fi
    sleep 2
  done

  log "El backend no respondió a tiempo."
  return 1
}

main() {
  require_root "$@"

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  ensure_apt_packages \
    build-essential \
    curl \
    git \
    ca-certificates \
    python3 \
    make \
    g++ \
    pkg-config \
    nfs-kernel-server \
    nfs-common \
    openssl

  ensure_node_20
  ensure_docker
  ensure_runtime_dirs
  ensure_env_file
  build_application
  install_systemd_service
  setup_nfs
  start_containers
  wait_for_backend

  log "HomeVault listo."
  log "Dashboard: http://<IP-DE-LA-VM>:${BACKEND_PORT}"
  log "AdGuard Home: http://<IP-DE-LA-VM>:3001"
}

main "$@"
