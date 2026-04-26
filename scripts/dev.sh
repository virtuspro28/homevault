#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# HomeVault Dashboard — Script de Desarrollo con Watch
# ═══════════════════════════════════════════════════════════════════
# Inicia el servidor en modo desarrollo con hot-reload

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  HomeVault Dashboard — Modo Desarrollo                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Cargar variables de entorno
if [ -f ".env" ]; then
    set -a
    . ./.env
    set +a
fi

# Por defecto, usar entorno de desarrollo
export NODE_ENV="development"
export LOG_LEVEL="${LOG_LEVEL:-debug}"

echo "🚀 Iniciando servidor en modo desarrollo..."
echo "   Expresiones regulares: http://localhost:${PORT:-3000}"
echo "   Presiona Ctrl+C para detener"
echo

npm run dev
