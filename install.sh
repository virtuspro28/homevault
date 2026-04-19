#!/bin/bash

# ═══════════════════════════════════════════════════════════════
#  HomePiNAS — Master Installer
# ═══════════════════════════════════════════════════════════════
#  Detección, Instalación y Configuración Automática
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

# 2. Actualización de Sistema y Dependencias
echo -e "${CYAN}[1/6] Actualizando sistema y paquetes críticos...${NC}"
# Forzar actualización de repositorios
apt-get update -y

echo -e "${CYAN}Instalando herramientas de compilación y sistema...${NC}"
# Instalamos primero lo crítico de forma aislada
apt-get install -y build-essential curl git util-linux python3-minimal --no-install-recommends || true

echo -e "${CYAN}Instalando dependencias de red y NAS...${NC}"
# Instalamos el resto de servicios
apt-get install -y mergerfs snapraid smartmontools nginx wireguard htop ufw --no-install-recommends || true




# 3. Instalación de Docker
if ! [ -x "$(command -v docker)" ]; then
    echo -e "${CYAN}[2/6] Instalando Docker Engine...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
else
    echo -e "${GREEN}✔ Docker ya está instalado.${NC}"
fi

# 4. Instalación de Node.js 20.x LTS
if ! [ -x "$(command -v node)" ]; then
    echo -e "${CYAN}[3/6] Instalando Node.js (LTS)...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo -e "${GREEN}✔ Node.js ya está instalado ($(node -v)).${NC}"
fi

# 5. Despliegue de la Aplicación
INSTALL_DIR="/opt/homepinas"
echo -e "${CYAN}[4/6] Configurando archivos de la aplicación en $INSTALL_DIR...${NC}"

mkdir -p $INSTALL_DIR
# Si este script se ejecuta desde el repo, copiamos. Si no, clonamos vía HTTPS público.
if [ -d "./src" ] && [ -f "package.json" ]; then
    echo -e "${GREEN}Copiando archivos locales...${NC}"
    cp -r . $INSTALL_DIR/
else
    if [ -d "$INSTALL_DIR/.git" ]; then
        echo -e "${YELLOW}El directorio ya existe. Actualizando repositorio...${NC}"
        cd $INSTALL_DIR
        git fetch --all
        git reset --hard origin/main
    else
        echo -e "${YELLOW}Limpiando instalación previa fallida...${NC}"
        rm -rf $INSTALL_DIR
        git clone https://github.com/virtuspro28/dashboard.git $INSTALL_DIR
    fi
fi


cd $INSTALL_DIR

echo -e "${CYAN}Instalando dependencias de Node.js (Backend)...${NC}"
npm install

echo -e "${CYAN}Preparando Frontend (React Build)...${NC}"
cd frontend
npm install
npm run build
cd ..

echo -e "${CYAN}Inicializando base de datos Prisma...${NC}"
npx prisma db push

# 6. Configuración de Systemd
echo -e "${CYAN}[5/6] Configurando persistencia con Systemd...${NC}"
cat <<EOF > /etc/systemd/system/homepinas.service
[Unit]
Description=HomePiNAS Dashboard
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable homepinas
systemctl start homepinas

# 7. Configuración de Nginx
echo -e "${CYAN}[6/6] Configurando servidor web Nginx (Puerto 80)...${NC}"
cat <<EOF > /etc/nginx/sites-available/homepinas
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/homepinas /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# Finalización
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "\n${GREEN}${BOLD}¡FELICIDADES! HomePiNAS ha sido instalado con éxito.${NC}"
echo -e "------------------------------------------------------------"
echo -e "Accede a tu NAS desde cualquier navegador en la red local:"
echo -e "${BOLD}http://$LOCAL_IP${NC}"
echo -e "------------------------------------------------------------"
echo -e "Nota: El primer usuario que crees será el OWNER del sistema."
echo -e "Logs del sistema: sudo journalctl -u homepinas -f"
