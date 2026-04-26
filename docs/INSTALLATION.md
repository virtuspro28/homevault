# 🚀 Guía de Instalación - HomeVault Dashboard

## Requisitos Previos

### Hardware Mínimo
- **CPU**: ARM64/ARMHF/x86_64 (Raspberry Pi 3+, Mini PC, Servidor)
- **RAM**: 256 MB (crítico), 512 MB (recomendado), 1 GB+ (óptimo)
- **Almacenamiento**: 500 MB (mínimo), 2 GB (recomendado)
- **Red**: Ethernet o WiFi para acceso local

### Software Requerido
- **Node.js**: 20.0.0 o superior
- **npm**: 10.0.0 o superior
- **Docker**: 20.10+ (para aplicaciones)
- **Git**: Para clonar el repositorio (opcional)

### Sistema Operativo
- ✅ Raspberry Pi OS (64-bit)
- ✅ Ubuntu 22.04 LTS+
- ✅ Debian 12+
- ✅ Alpine Linux
- ✅ Otros con Node.js 20+

---

## 1️⃣ Instalación Manual (Recomendado para Desarrollo)

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/homevault-dashboard.git
cd homevault-dashboard
```

### Paso 2: Configurar Entorno

```bash
# Copiar plantilla de configuración
cp .env.example .env

# Editar .env con valores específicos de tu setup
nano .env
```

**Variables críticas a configurar:**

```bash
# Base de datos
DATABASE_URL="file:./data/homevault.db"

# Seguridad (generar con: openssl rand -base64 32)
JWT_SECRET="your-secret-key-here"

# Servidor
PORT=3000
NODE_ENV="development"

# Almacenamiento
STORAGE_BASE_PATH="/mnt/storage"
```

### Paso 3: Ejecutar Setup Automático

```bash
# Dar permisos de ejecución a scripts
chmod +x scripts/*.sh

# Ejecutar setup (crea directorios, instala dependencias, compila)
./scripts/setup.sh
```

### Paso 4: Iniciar Servidor

**Desarrollo (con hot-reload):**
```bash
./scripts/dev.sh
# o
npm run dev
```

**Producción:**
```bash
npm run build
npm start
```

### Paso 5: Acceder al Dashboard

Abre tu navegador en: **http://localhost:3000**

> ℹ️ En el primer acceso, se mostrará la pantalla de setup para crear el usuario OWNER

---

## 2️⃣ Instalación con Docker (Recomendado para Producción)

### Requisito Previo

```bash
# Instalar Docker y Docker Compose
curl -sSL https://get.docker.com | sh

# Agregar usuario actual al grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

### Paso 1: Clonar Repositorio

```bash
git clone https://github.com/tu-usuario/homevault-dashboard.git
cd homevault-dashboard
```

### Paso 2: Configurar Variables

```bash
cp .env.example .env

# Editar archivo .env
nano .env

# Generar JWT_SECRET fuerte
# Descomenta la línea y reemplaza:
JWT_SECRET=$(openssl rand -base64 32)
```

### Paso 3: Construir Imagen

```bash
# Opción A: Build automático (recomendado)
docker-compose up -d --build

# Opción B: Build manual
docker build -t homevault-dashboard:latest .
docker-compose up -d
```

### Paso 4: Verificar Estado

```bash
# Ver containers en ejecución
docker-compose ps

# Ver logs en vivo
docker-compose logs -f homevault

# Verificar salud del servicio
curl http://localhost:3000/api/health
```

### Paso 5: Acceder al Dashboard

URL: **http://localhost:3000** (o **https://tu-dominio.com** si está configurado)

---

## 3️⃣ Instalación en Raspberry Pi (Optimizada)

### Requisitos RPi

- Raspberry Pi 3B+ o superior (64-bit OS)
- 32 GB microSD mínimo
- Fuente de 5V 3A

### Paso 1: Preparar SO

```bash
# Descargar Raspberry Pi Imager desde:
# https://www.raspberrypi.com/software/

# Opciones de imagen recomendadas:
# - Raspberry Pi OS (64-bit, Lite) para usar espacio mínimo
# - Incluir SSH en configuración avanzada
```

### Paso 2: Actualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y curl wget git build-essential python3

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Paso 3: Instalar Docker (ARM64)

```bash
# Script oficial
curl -sSL https://get.docker.com | sh

# Agregar usuario
sudo usermod -aG docker pi

# Logout y login para aplicar cambios
exit
```

### Paso 4: Clonar y Configurar

```bash
cd /opt  # Ubicación estándar

sudo git clone https://github.com/tu-usuario/homevault-dashboard.git
sudo chown -R pi:pi homevault-dashboard

cd homevault-dashboard
cp .env.example .env

# Editar .env para RPi
nano .env

# Configuraciones recomendadas para RPi 3:
STORAGE_BASE_PATH="/mnt/storage"      # Montar USB/NAS
NODE_ENV="production"
LOG_LEVEL="warn"                       # Menos logging = menos I/O SD
```

### Paso 5: Crear Servicio Systemd

```bash
# Crear archivo de servicio
sudo tee /etc/systemd/system/homevault.service > /dev/null <<EOF
[Unit]
Description=HomeVault Dashboard
After=network.target docker.service

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/homevault-dashboard
ExecStart=docker-compose up

Restart=unless-stopped
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Habilitar y arrancar
sudo systemctl daemon-reload
sudo systemctl enable homevault
sudo systemctl start homevault

# Ver estado
sudo systemctl status homevault
```

### Paso 6: Optimizar Rendimiento

```bash
# Aumentar limite de archivos abiertos
echo "fs.file-max = 100000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Desabilitar IPv6 si no se usa
echo "net.ipv6.conf.all.disable_ipv6 = 1" | sudo tee -a /etc/sysctl.conf

# Aumentar buffer de socket
echo "net.core.rmem_max=134217728" | sudo tee -a /etc/sysctl.conf
echo "net.core.wmem_max=134217728" | sudo tee -a /etc/sysctl.conf
```

---

## 4️⃣ Instalación desde Fuente en Computadora Personal

### Para Desarrollo

```bash
# 1. Clonar
git clone https://github.com/tu-usuario/homevault-dashboard.git
cd homevault-dashboard

# 2. Instalar dependencias completas (incluyendo dev)
npm ci

# 3. Copiar .env
cp .env.example .env

# 4. Compilar TypeScript
npm run build

# 5. Iniciar desarrollo
npm run dev

# En otra terminal: compilar frontend
cd frontend
npm install
npm run dev
```

### Para Servir Frontend Estático

```bash
# Compilar frontend
cd frontend
npm run build

# Copiar dist a servidor
cp -r dist/* ../public/
```

---

## 🐳 Comandos Útiles de Docker

### Administración

```bash
# Ver estado
docker-compose ps

# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Recrear sin cache
docker-compose up -d --build --force-recreate

# Limpiar volúmenes (⚠️ CUIDADO: borra datos)
docker-compose down -v
```

### Mantenimiento

```bash
# Ejecutar comando en contenedor
docker-compose exec homevault bash

# Hacer backup de BD dentro del contenedor
docker-compose exec homevault cp data/homevault.db /backups/

# Ver tamaño de imagen
docker images | grep homevault
```

---

## ✅ Verificación Post-Instalación

### Checklist

```bash
# 1. Servidor accesible
curl http://localhost:3000/api/health

# 2. BD inicializada
ls -lh data/homevault.db

# 3. Logs disponibles
tail logs/homevault.log

# 4. Permisos correctos
ls -la data/ logs/ backups/

# 5. Puertos abiertos
netstat -tuln | grep 3000
```

### Primer Acceso

1. Abre http://localhost:3000
2. Haz clic en "Setup" o "Configurar"
3. Crea usuario OWNER con contraseña fuerte (mín 12 caracteres)
4. ¡Listo! Ya puedes usar HomeVault

---

## 🆘 Solución de Problemas

### El servidor no inicia

```bash
# Ver errores detallados
NODE_ENV=development npm run dev

# Verificar puerto en uso
lsof -i :3000

# Matar proceso que usa puerto
sudo kill -9 $(lsof -t -i:3000)
```

### BD corrompida

```bash
# Hacer backup
cp data/homevault.db data/homevault-corrupted.db

# Eliminar y reiniciar (se recreará)
rm data/homevault.db
npm run dev
```

### Docker no funciona

```bash
# Verificar socket
ls -la /var/run/docker.sock

# Permisos
sudo usermod -aG docker $USER

# Restart daemon
sudo systemctl restart docker
```

### Problemas de memoria en RPi

```bash
# Ver uso actual
free -h

# Reducir footprint
NODE_OPTIONS="--max-old-space-size=256" npm start
```

---

## 📚 Siguientes Pasos

1. ✅ Lee [SECURITY.md](./SECURITY.md) para proteger tu instalación
2. 📖 Consulta [docs/](./docs/) para documentación completa
3. 🐛 Reporta problemas en [GitHub Issues](https://github.com/tu-usuario/homevault-dashboard/issues)
4. 🤝 Contribuye mejoras via pull requests

---

**¿Necesitas ayuda?**  
- 📖 [Documentación Completa](./docs/)
- 🐛 [Reportar Errores](https://github.com/)
- 💬 [Comunidad](https://github.com/)

**Ultima actualización**: Abril 2026
