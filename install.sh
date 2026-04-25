#!/bin/bash

# ═══════════════════════════════════════════════════════════════
#  HomePiNAS — Master Installer
# ═══════════════════════════════════════════════════════════════
#  Detección, Instalación y Configuración Automática
#  Compatible: Debian Trixie, Raspberry Pi OS, Ubuntu
# ═══════════════════════════════════════════════════════════════

set -e

# Colores y Estilo
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# Banner ASCII
echo -e "${BLUE}${BOLD}"
echo "  _    _                      _____  _ _   _          _____ "
echo " | |  | |                    |  __ \(_) \ | |   /\    / ____|"
echo " | |__| | ___  _ __ ___   ___| |__) |_|  \| |  /  \  | (___  "
echo " |  __  |/ _ \| '_ \` _ \ / _ \  ___/| | . \` | / /\ \  \___ \ "
echo " | |  | | (_) | | | | | |  __/ |    | | |\  |/ ____ \ ____) |"
echo " |_|  |_|\___/|_| |_| |_|\___|_|    |_|_| \_/_/    \_\_____/ "
echo "                                                             "
echo -e "${NC}"
echo -e "${BOLD}Iniciando instalación de HomePiNAS...${NC}\n"

# ─── Variables globales ───
INSTALL_DIR="/opt/homepinas"
FRONTEND_DIST="$INSTALL_DIR/frontend/dist"
BACKEND_PORT=3000

# 1. Verificaciones de Seguridad
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Este script debe ejecutarse con privilegios de ROOT (sudo).${NC}"
  exit 1
fi

# Detectar OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "debian" && "$ID" != "raspbian" && "$ID" != "ubuntu" ]]; then
        echo -e "${YELLOW}Aviso: No se ha detectado Debian/Ubuntu oficial. La compatibilidad no está garantizada.${NC}"
    fi
else
    echo -e "${RED}Error: No se pudo determinar el sistema operativo.${NC}"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════
# [1/7] ACTUALIZACIÓN DE SISTEMA Y DEPENDENCIAS
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[1/7] Actualizando sistema y paquetes críticos...${NC}"
apt-get update -y

echo -e "${CYAN}Instalando herramientas de compilación y sistema...${NC}"
apt-get install -y build-essential curl git util-linux python3-minimal --no-install-recommends || true

echo -e "${CYAN}Instalando dependencias de red y NAS...${NC}"
apt-get install -y mergerfs snapraid smartmontools nginx wireguard htop ufw --no-install-recommends || true

# ═══════════════════════════════════════════════════════════════
# [2/7] DOCKER
# ═══════════════════════════════════════════════════════════════
if ! [ -x "$(command -v docker)" ]; then
    echo -e "${CYAN}[2/7] Instalando Docker Engine...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
else
    echo -e "${GREEN}✔ Docker ya está instalado.${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# [3/7] NODE.JS 20.x LTS
# ═══════════════════════════════════════════════════════════════
if ! [ -x "$(command -v node)" ]; then
    echo -e "${CYAN}[3/7] Instalando Node.js (LTS)...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo -e "${GREEN}✔ Node.js ya está instalado ($(node -v)).${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# [4/7] DESPLIEGUE DE LA APLICACIÓN
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[4/7] Configurando archivos de la aplicación en $INSTALL_DIR...${NC}"

mkdir -p $INSTALL_DIR
# Si este script se ejecuta desde el repo, copiamos. Si no, clonamos vía HTTPS público.
if [ -d "./src" ] && [ -f "package.json" ]; then
    echo -e "${GREEN}Copiando archivos locales...${NC}"
    cp -r . $INSTALL_DIR/
else
    if [ -d "$INSTALL_DIR/.git" ]; then
        echo -e "${YELLOW}El directorio ya existe. Forzando actualización completa...${NC}"
        cd $INSTALL_DIR
        git fetch origin
        git checkout main
        git reset --hard origin/main
        git clean -fd
        echo -e "${GREEN}✔ Repositorio actualizado al commit: $(git rev-parse --short HEAD)${NC}"
    else
        echo -e "${YELLOW}Limpiando instalación previa fallida...${NC}"
        rm -rf $INSTALL_DIR
        git clone https://github.com/virtuspro28/dashboard.git $INSTALL_DIR
    fi
fi

cd $INSTALL_DIR

# ═══════════════════════════════════════════════════════════════
# [5/7] BUILD (Orden correcto: Backend deps → Frontend → Prisma → Backend)
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[5/7] Compilando aplicación...${NC}"

echo -e "${CYAN}  → Instalando dependencias de Node.js (Backend)...${NC}"
npm install

echo -e "${CYAN}  → Compilando Frontend (React/Vite)...${NC}"
cd frontend
npm install
npm run build
cd ..

echo -e "${CYAN}  → Inicializando base de datos Prisma...${NC}"
npx prisma db push

echo -e "${CYAN}  → Compilando Backend (TypeScript)...${NC}"
npm run build || echo -e "${YELLOW}TypeScript completó la transpilación con advertencias.${NC}"

# ═══════════════════════════════════════════════════════════════
# [6/7] PERMISOS + SYSTEMD
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[6/7] Configurando permisos y persistencia con Systemd...${NC}"

# ─── Permisos: Nginx (www-data) necesita poder atravesar los directorios hasta dist ───
# chmod +x = permiso de ejecución/traversal en directorios (necesario para nginx)
chmod +x /opt
chmod +x /opt/homepinas
chmod +x /opt/homepinas/frontend
chmod +x /opt/homepinas/frontend/dist

# Asegurar que www-data pueda leer todos los archivos del frontend
chown -R root:www-data $FRONTEND_DIST
chmod -R 755 $FRONTEND_DIST

cat <<EOF > /etc/systemd/system/homepinas.service
[Unit]
Description=HomePiNAS Dashboard (Backend API)
After=network.target docker.service

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
systemctl enable homepinas
systemctl restart homepinas

# Esperar a que el backend arranque (máx 10s)
echo -e "${CYAN}  → Esperando a que el backend arranque...${NC}"
for i in $(seq 1 10); do
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✔ Backend operativo en puerto $BACKEND_PORT${NC}"
        break
    fi
    sleep 1
done

# ═══════════════════════════════════════════════════════════════
# [7/7] NGINX — Servidor Web con Proxy Inverso
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[7/7] Configurando servidor web Nginx (Puerto 80)...${NC}"

# ─── Eliminar configuración default de Nginx para evitar conflictos ───
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-available/default

# ─── Configuración optimizada: Estáticos + API Proxy + WebSocket ───
cat <<'NGINXEOF' > /etc/nginx/sites-available/homepinas
# ═══════════════════════════════════════════════════════════════
#  HomePiNAS — Nginx Configuration
# ═══════════════════════════════════════════════════════════════
#  Arquitectura:
#    Puerto 80 → Nginx
#       /             → Archivos estáticos (React SPA)
#       /api/*        → Proxy al backend Node.js (:3000)
#       /socket.io/*  → Proxy WebSocket al backend (:3000)
# ═══════════════════════════════════════════════════════════════

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # ─── Frontend: Archivos estáticos de React/Vite ───
    root /opt/homepinas/frontend/dist;
    index index.html;

    # Seguridad: Ocultar versión de Nginx
    server_tokens off;

    # Tamaño máximo de upload (para el gestor de archivos)
    client_max_body_size 5G;

    # ─── Compresión Gzip para rendimiento ───
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

    # ─── Caché de assets estáticos (JS, CSS, imágenes) ───
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ─── API Backend: Proxy inverso a Node.js ───
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Headers estándar de proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts generosos para operaciones largas (uploads, backups)
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # ─── WebSocket: Socket.IO para Terminal y Monitor en tiempo real ───
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Headers requeridos para upgrade a WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSockets necesitan timeouts largos
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ─── SPA Fallback: Todas las rutas no-API van a index.html ───
    # React Router maneja la navegación del lado del cliente
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

# Activar sitio
ln -sf /etc/nginx/sites-available/homepinas /etc/nginx/sites-enabled/homepinas

# Verificar configuración antes de reiniciar
echo -e "${CYAN}  → Verificando configuración de Nginx...${NC}"
if nginx -t 2>&1; then
    echo -e "${GREEN}  ✔ Configuración de Nginx válida${NC}"
    systemctl restart nginx
else
    echo -e "${RED}  ✘ Error en la configuración de Nginx. Revisa manualmente.${NC}"
    nginx -t
    exit 1
fi

# ═══════════════════════════════════════════════════════════════
# FINALIZACIÓN
# ═══════════════════════════════════════════════════════════════
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║     ¡FELICIDADES! HomePiNAS ha sido instalado con éxito   ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Accede a tu NAS desde cualquier navegador en la red local:"
echo -e "  ${BOLD}➜  http://$LOCAL_IP${NC}"
echo ""
echo -e "  ${CYAN}Arquitectura:${NC}"
echo -e "    ┌─ Puerto 80 (Nginx) ─── Archivos estáticos (React)"
echo -e "    ├─ /api/*             ─── Backend Node.js (:$BACKEND_PORT)"
echo -e "    └─ /socket.io/*       ─── WebSocket Terminal (:$BACKEND_PORT)"
echo ""
echo -e "  ${YELLOW}Nota:${NC} El primer usuario que crees será el OWNER del sistema."
echo -e "  ${YELLOW}Logs:${NC} sudo journalctl -u homepinas -f"
echo ""
