#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# HomePiNAS Dashboard — Script de Limpieza
# ═══════════════════════════════════════════════════════════════════
# Limpia artefactos de compilación y cachés (CUIDADO: destructivo)

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  HomePiNAS Dashboard — Limpieza                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

read -p "⚠️  Esto eliminará compilaciones, cachés y logs. ¿Continuar? (s/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Cancelado"
    exit 1
fi

echo "🧹 Limpiando..."

# Eliminar directorio dist
if [ -d "dist" ]; then
    rm -rf dist
    echo "   ✓ Eliminado: dist/"
fi

# Eliminar archivos de log
if [ -d "logs" ]; then
    rm -f logs/*.log
    echo "   ✓ Limpiados: logs/*.log"
fi

# Limpiar caché de npm
npm cache clean --force 2>/dev/null && echo "   ✓ Caché de npm limpiado"

# Opcional: eliminar node_modules (comentar si no quieres)
# read -p "¿Eliminar node_modules también? (s/N) " -n 1 -r
# echo
# if [[ $REPLY =~ ^[Ss]$ ]]; then
#     rm -rf node_modules
#     echo "   ✓ Eliminado: node_modules/"
#     echo "   Ejecuta 'npm ci' para reinstalar"
# fi

echo
echo "✅ Limpieza completada"
echo "Ahora puedes ejecutar: npm run build"
echo
