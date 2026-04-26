#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# HomeVault Dashboard — Script de Verificación del Sistema
# ═══════════════════════════════════════════════════════════════════
# Verifica que todos los componentes estén configurados correctamente

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  HomeVault Dashboard — Diagnóstico del Sistema              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1: $($1 --version 2>&1 | head -1)"
    else
        echo -e "${RED}✗${NC} $1: No instalado"
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1: No encontrado"
    fi
}

echo "🖥️  Requisitos del Sistema:"
echo "────────────────────────────────────────────────────────────────"
check_command "node"
check_command "npm"
check_command "docker"
check_command "git"
check_command "sqlite3"
echo

echo "📁 Archivos de Configuración:"
echo "────────────────────────────────────────────────────────────────"
check_file ".env"
check_file "package.json"
check_file "tsconfig.json"
check_file "docker-compose.yml"
check_file "Dockerfile"
echo

echo "📂 Directorios Necesarios:"
echo "────────────────────────────────────────────────────────────────"
for dir in data logs backups node_modules dist src; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir/"
    else
        echo -e "${RED}✗${NC} $dir/: No existe"
    fi
done
echo

echo "🔐 Verificación de Seguridad:"
echo "────────────────────────────────────────────────────────────────"

if [ -f ".env" ]; then
    if grep -q "change-me-in-production" .env; then
        echo -e "${YELLOW}⚠${NC}  JWT_SECRET: DEBE CAMBIAR en producción"
    else
        echo -e "${GREEN}✓${NC} JWT_SECRET: Configurado"
    fi
else
    echo -e "${RED}✗${NC} .env: No configurado"
fi

if [ -f "data/homevault.db" ]; then
    echo -e "${GREEN}✓${NC} Base de datos: Existe"
    if command -v sqlite3 &> /dev/null; then
        integrity=$(sqlite3 "data/homevault.db" "PRAGMA integrity_check;" 2>/dev/null)
        if [ "$integrity" = "ok" ]; then
            echo -e "${GREEN}✓${NC} Base de datos: Íntegra"
        else
            echo -e "${RED}✗${NC} Base de datos: Corrupta ($integrity)"
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC}  Base de datos: No existe (se creará al arrancar)"
fi
echo

echo "📊 Uso de Disco:"
echo "────────────────────────────────────────────────────────────────"
if [ -f "data/homevault.db" ]; then
    size=$(du -h "data/homevault.db" | cut -f1)
    echo "   homevault.db: $size"
fi

if [ -d "node_modules" ]; then
    size=$(du -sh "node_modules" 2>/dev/null | cut -f1)
    echo "   node_modules: $size"
fi

echo

echo "🐳 Estado de Docker:"
echo "────────────────────────────────────────────────────────────────"
if command -v docker &> /dev/null; then
    if docker ps -q &> /dev/null; then
        count=$(docker ps -q | wc -l)
        echo -e "${GREEN}✓${NC} Docker: Funcionando ($count contenedores activos)"
    else
        echo -e "${YELLOW}⚠${NC}  Docker: No se puede acceder al socket"
    fi
else
    echo -e "${RED}✗${NC} Docker: No instalado"
fi

echo

echo "✅ Diagnóstico completado"
echo
