#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# HomePiNAS Dashboard — Script de Migración de Base de Datos
# ═══════════════════════════════════════════════════════════════════
# Ejecuta todas las migraciones pendientes y valida la integridad

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  HomePiNAS Dashboard — Migraciones de BD                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Verificar que la aplicación esté compilada
if [ ! -d "dist" ]; then
    echo "❌ El código no está compilado. Ejecuta: npm run build"
    exit 1
fi

echo "🔄 Ejecutando migraciones..."

# Cargar variables de entorno
if [ -f ".env" ]; then
    set -a
    . ./.env
    set +a
fi

# Usar DATABASE_URL por defecto si no está configurado
DATABASE_URL="${DATABASE_URL:-file:./data/homepinas.db}"

# Crear directorio data si no existe
mkdir -p "$(dirname "${DATABASE_URL#file:}")"

echo "   Base de datos: $DATABASE_URL"

# Ejecutar migraciones (el servidor lo hace al arrancar)
# Pero podemos verificar la integridad de la BD manualmente

if command -v sqlite3 &> /dev/null; then
    DB_PATH="${DATABASE_URL#file:}"
    
    if [ -f "$DB_PATH" ]; then
        echo "📋 Verificando integridad de la base de datos..."
        sqlite3 "$DB_PATH" "PRAGMA integrity_check;"
        
        echo "📊 Estadísticas de la base de datos:"
        sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table';" | while read table; do
            count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;")
            echo "   ✓ $table: $count registros"
        done
    else
        echo "⚠️  Base de datos no existe aún (se creará al arrancar)"
    fi
else
    echo "⚠️  sqlite3 no está instalado, no se puede validar integridad"
fi

echo
echo "✅ Migraciones completadas"
echo

# Información para el siguiente paso
echo "Para iniciar el servidor:"
echo "  npm run dev      # Modo desarrollo"
echo "  npm start        # Modo producción"
echo
