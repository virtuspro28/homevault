#!/bin/bash

# ═══════════════════════════════════════════════════════════════
#  HomeVault Dashboard — Script de Desinstalación Limpia
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

INSTALL_DIR="/opt/homevault"
SERVICE_NAME="homevault"
NGINX_SITE="/etc/nginx/sites-available/homevault"
LEGACY_SERVICE_NAME="homepinas"
LEGACY_NGINX_SITE="/etc/nginx/sites-available/homepinas"

if [ "${EUID}" -ne 0 ]; then
  echo -e "${RED}Error: Este script debe ejecutarse con privilegios de ROOT.${NC}"
  exit 1
fi

echo -e "${BLUE}${BOLD}--- Desinstalando HomeVault ---${NC}\n"

# 1. Detener y eliminar el servicio de systemd
echo -e "${YELLOW}[1/4] Deteniendo y eliminando el servicio de sistema...${NC}"
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME"
fi
if systemctl is-active --quiet "$LEGACY_SERVICE_NAME"; then
    systemctl stop "$LEGACY_SERVICE_NAME"
fi
systemctl disable "$SERVICE_NAME" || true
systemctl disable "$LEGACY_SERVICE_NAME" || true
rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
rm -f "/etc/systemd/system/${LEGACY_SERVICE_NAME}.service"
systemctl daemon-reload

# 2. Eliminar configuración de Nginx
echo -e "${YELLOW}[2/4] Eliminando configuración de Nginx...${NC}"
rm -f "/etc/nginx/sites-enabled/homevault"
rm -f "/etc/nginx/sites-enabled/homepinas"
rm -f "$NGINX_SITE"
rm -f "$LEGACY_NGINX_SITE"
systemctl restart nginx || true

# 3. Eliminar archivos de la aplicación
echo -e "${YELLOW}[3/4] Eliminando archivos de la aplicación en $INSTALL_DIR...${NC}"
# Preguntar antes de borrar por si el usuario quiere conservar datos/db
read -p "¿Deseas eliminar también la carpeta de la aplicación y la base de datos? (s/n): " confirm
if [[ $confirm == [sS] ]]; then
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}Carpeta eliminada.${NC}"
else
    echo -e "${BLUE}Se ha conservado la carpeta $INSTALL_DIR.${NC}"
fi

# 4. Limpiar reglas de UFW (opcional)
echo -e "${YELLOW}[4/4] Limpiando reglas de firewall...${NC}"
ufw delete allow 80 || true
ufw delete allow 3000 || true

echo -e "\n${GREEN}${BOLD}Desinstalación completada.${NC}"
echo -e "Nota: Docker, Node.js y las herramientas base (SnapRAID, MergerFS, etc.) no han sido eliminadas por seguridad."
