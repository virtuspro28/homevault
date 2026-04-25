#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# HomePiNAS Dashboard — Script de Inicialización del Entorno
# ═══════════════════════════════════════════════════════════════════
# Este script configura el entorno completo para ejecutar HomePiNAS
# Usage: ./scripts/setup.sh

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  HomePiNAS Dashboard — Setup Inicial                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# 1. Verificar requisitos previos
echo "📋 Verificando requisitos..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js no encontrado. Por favor instala Node.js 20+ primero."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm no encontrado. Por favor instala npm primero."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "⚠️  git no encontrado (opcional para el funcionamiento)"
fi

echo "✅ Requisitos básicos verificados"
echo "   Node: $(node --version)"
echo "   npm: $(npm --version)"
echo

# 2. Crear estructura de directorios
echo "📁 Creando directorios necesarios..."

mkdir -p data
mkdir -p logs
mkdir -p backups
mkdir -p scripts

echo "✅ Directorios creados"
echo

# 3. Configurar archivo .env
if [ ! -f .env ]; then
    echo "🔧 Generando archivo .env..."
    
    # Generar secreto JWT fuerte
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    
    cp .env.example .env
    
    # Reemplazar placeholder si el sistema tiene sed disponible
    if command -v sed &> /dev/null; then
        sed -i "s/change-me-in-production.*/change-me-in-production-$JWT_SECRET/" .env
    fi
    
    echo "✅ Archivo .env generado"
    echo "   ⚠️  Revisa .env y configura las variables según tu setup"
else
    echo "✅ Archivo .env ya existe (no se sobrescribe)"
fi
echo

# 4. Instalar dependencias
echo "📦 Instalando dependencias..."

if [ ! -d "node_modules" ]; then
    npm ci --omit=dev
    npm install --save-dev @types/node typescript
    echo "✅ Dependencias instaladas"
else
    echo "✅ node_modules ya existe"
fi
echo

# 5. Compilar TypeScript
echo "🔨 Compilando TypeScript..."
npm run build
echo "✅ Compilación completada"
echo

# 6. Preparar base de datos
echo "💾 Inicializando base de datos..."

# Crear directorio data si no existe
mkdir -p data

# Si la BD existe, hacer backup
if [ -f "data/homepinas.db" ]; then
    BACKUP_NAME="data/homepinas-$(date +%s).db.bak"
    cp data/homepinas.db "$BACKUP_NAME"
    echo "   📦 Backup creado: $BACKUP_NAME"
fi

echo "✅ Base de datos lista"
echo

# 7. Información final
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup Completado                                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo
echo "Próximos pasos:"
echo "1. Revisa la configuración en .env"
echo "2. Inicia el servidor:"
echo "   npm run dev        # Desarrollo"
echo "   npm start          # Producción"
echo
echo "3. Abre http://localhost:3000 en tu navegador"
echo
echo "Para usar Docker:"
echo "   docker-compose up -d"
echo
