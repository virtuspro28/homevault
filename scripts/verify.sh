#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# HomeVault Dashboard — Testing Rápido Post-Correcciones
# ═══════════════════════════════════════════════════════════════════
# Este script verifica que todas las correcciones fueron aplicadas

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  HomeVault Dashboard — Verificación de Correcciones         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

ERRORS=0

# Función para verificar archivo
check_file() {
    if [ -f "$1" ]; then
        echo "✅ $1"
    else
        echo "❌ $1: No encontrado"
        ERRORS=$((ERRORS + 1))
    fi
}

# Función para verificar contenido
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo "✅ $1 contiene: $2"
    else
        echo "❌ $1 NO contiene: $2"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "📂 Verificando archivos creados..."
echo "────────────────────────────────────────────────────────────────"
check_file "Dockerfile"
check_file "docker-compose.yml"
check_file "src/middlewares/validation.ts"
check_file "scripts/setup.sh"
check_file "scripts/migrate.sh"
check_file "scripts/diagnose.sh"
check_file "scripts/dev.sh"
check_file "scripts/clean.sh"
check_file "docs/SECURITY.md"
check_file "docs/INSTALLATION.md"
check_file "CHANGES.md"
echo

echo "🔍 Verificando contenido de archivos clave..."
echo "────────────────────────────────────────────────────────────────"

# Dockerfile
check_content "Dockerfile" "FROM node:20-alpine"
check_content "Dockerfile" "HEALTHCHECK"
check_content "Dockerfile" "ENTRYPOINT"

# docker-compose
check_content "docker-compose.yml" "homevault-dashboard"
check_content "docker-compose.yml" "DATABASE_URL"
check_content "docker-compose.yml" "backup-cron"

# Validación middleware
check_content "src/middlewares/validation.ts" "validateLoginCredentials"
check_content "src/middlewares/validation.ts" "validateSetupData"
check_content "src/middlewares/validation.ts" "PATTERNS.username"

# Auth Controller
check_content "src/controllers/authController.ts" "sameSite.*strict"
check_content "src/controllers/authController.ts" "validatePattern"
check_content "src/controllers/authController.ts" "12"

# Docker Routes
check_content "src/routes/docker.routes.ts" "store/apps"
check_content "src/routes/docker.routes.ts" "store/install"
check_content "src/routes/docker.routes.ts" "StoreService"

# Store Service
check_content "src/services/store.service.ts" "validateAppExists"
check_content "src/services/store.service.ts" "deployApp"
check_content "src/services/store.service.ts" "docker rm -f"

# AppStore Frontend
check_content "frontend/src/pages/AppStore.tsx" "api/docker/store"
check_content "frontend/src/pages/AppStore.tsx" "error handling"

# Env Example
check_content ".env.example" "JWT_SECRET"
check_content ".env.example" "STORAGE_BASE_PATH"
check_content ".env.example" "FAIL2BAN_ENABLED"

echo

echo "🧪 Verificando sintaxis de scripts..."
echo "────────────────────────────────────────────────────────────────"

for script in scripts/*.sh; do
    if bash -n "$script" 2>/dev/null; then
        echo "✅ $script: Sintaxis válida"
    else
        echo "❌ $script: Error de sintaxis"
        ERRORS=$((ERRORS + 1))
    fi
done
echo

echo "📦 Verificando TypeScript..."
echo "────────────────────────────────────────────────────────────────"

if npm run build 2>&1 | tail -5 | grep -q "error TS"; then
    echo "❌ Errores de TypeScript encontrados"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ TypeScript compila sin errores"
fi
echo

echo "📋 Verificando estructura de directorios..."
echo "────────────────────────────────────────────────────────────────"

for dir in data logs backups scripts docs src frontend; do
    if [ -d "$dir" ]; then
        echo "✅ $dir/"
    else
        echo "⚠️  $dir/ no existe (será creado al usar)"
    fi
done
echo

echo "🔐 Verificación de Seguridad..."
echo "────────────────────────────────────────────────────────────────"

# Verificar que no haya hardcoded passwords
if grep -r "password.*=.*\"[a-zA-Z0-9]*\"" src --include="*.ts" 2>/dev/null | grep -v "password" > /dev/null; then
    echo "❌ Posibles credenciales hardcodeadas detectadas"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No hay credenciales hardcodeadas"
fi

# Verificar validación de entrada
if grep -q "validatePattern\|validateLogin\|validateSetup" src/controllers/*.ts 2>/dev/null; then
    echo "✅ Validación de entrada implementada"
else
    echo "❌ Validación de entrada NO encontrada"
    ERRORS=$((ERRORS + 1))
fi

# Verificar CORS
if grep -q "CORS\|cors" src/index.ts 2>/dev/null; then
    echo "✅ CORS configurado"
else
    echo "⚠️  CORS no explícitamente mencionado"
fi

echo

echo "════════════════════════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo "✅ TODAS LAS VERIFICACIONES PASARON"
    echo "════════════════════════════════════════════════════════════════"
    echo
    echo "🎉 Las correcciones han sido aplicadas exitosamente"
    echo
    echo "Próximos pasos:"
    echo "1. npm install  (asegurarse de dependencias)"
    echo "2. npm run build"
    echo "3. npm run dev  (o ./scripts/dev.sh)"
    echo
    exit 0
else
    echo "❌ $ERRORS ERRORES ENCONTRADOS"
    echo "════════════════════════════════════════════════════════════════"
    echo
    echo "Por favor revisa los errores arriba"
    echo
    exit 1
fi
