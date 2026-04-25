# HomePiNAS Dashboard - Multi-arquitectura Dockerfile
# Soporta: ARM64, ARMHF, x86_64

FROM node:20-alpine AS builder

# Instalar dependencias de compilación necesarias para better-sqlite3
RUN apk add --no-cache python3 make g++ ca-certificates

WORKDIR /app

# Copiar archivos de package
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas las dependencias (incluyendo dev para compilación)
RUN npm ci

# Copiar código fuente
COPY src ./src
COPY prisma ./prisma

# Compilar TypeScript
RUN npm run build

# Etapa de Producción
FROM node:20-alpine

# Instalar herramientas de sistema necesarias
RUN apk add --no-cache \
    ca-certificates \
    tini \
    bash \
    sqlite \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copiar package.json para instalar solo dependencias de producción
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar código compilado desde builder
COPY --from=builder /app/dist ./dist

# Copiar archivos de prisma (necesario para migraciones)
COPY --from=builder /app/prisma ./prisma

# Copiar archivo de configuración de prisma
COPY prisma.config.ts ./

# Crear directorio de datos
RUN mkdir -p /app/data && \
    chmod 755 /app/data

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    DATABASE_URL=file:/app/data/homepinas.db

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Usar tini como init para manejar signals correctamente
ENTRYPOINT ["/sbin/tini", "--"]

# Comando de inicio
CMD ["node", "dist/index.js"]
