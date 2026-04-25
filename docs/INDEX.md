# 📚 Índice de Documentación - HomePiNAS Dashboard

## 🚀 Inicio Rápido

| Documento | Descripción | Público |
|-----------|-------------|---------|
| [INSTALLATION.md](./INSTALLATION.md) | Guía completa de instalación para todos los escenarios | ✅ |
| [SECURITY.md](./SECURITY.md) | Mejores prácticas y configuración de seguridad | ✅ |
| [API.md](./API.md) | Referencia de endpoints (si existe) | ✅ |

## 🔧 Guías Técnicas

### Para Desarrolladores
- **Estructura de Código**: Ver `src/` y `frontend/src/`
- **TypeScript Config**: `tsconfig.json`
- **Build**: `npm run build`
- **Desarrollo**: `./scripts/dev.sh` o `npm run dev`

### Para Administradores
- **Setup Inicial**: `./scripts/setup.sh`
- **Migraciones BD**: `./scripts/migrate.sh`
- **Diagnóstico**: `./scripts/diagnose.sh`
- **Limpieza**: `./scripts/clean.sh`

### Para DevOps/Cloud
- **Docker**: `Dockerfile` + `docker-compose.yml`
- **CI/CD**: Configurar según tu proveedor
- **Monitoreo**: Endpoint `/api/health`

## 📖 Documentación Completa

```
docs/
├── INSTALLATION.md      # ← EMPIEZA AQUÍ
├── SECURITY.md          # Seguridad y hardening
├── API.md               # Referencia de endpoints (si existe)
├── ARCHITECTURE.md      # Diseño del sistema (si existe)
└── TROUBLESHOOTING.md   # Solución de problemas (si existe)
```

## 🔒 Seguridad (CRÍTICO)

⚠️ **DEBES LEER ANTES DE PRODUCCIÓN**:
1. [SECURITY.md](./SECURITY.md) - Políticas de contraseña
2. [INSTALLATION.md](./INSTALLATION.md) - Sección HTTPS
3. Cambiar `JWT_SECRET` en `.env`

## 🐳 Docker

### Desarrollo
```bash
docker-compose up -d --build
docker-compose logs -f homepinas
```

### Producción
```bash
# Usar imagen pre-compilada si está disponible
# O compilar con: docker build -t homepinas:latest .
docker-compose -f docker-compose.yml up -d
```

## 🧰 Scripts Disponibles

```bash
./scripts/setup.sh      # Instalación inicial (Node.js)
./scripts/dev.sh        # Desarrollo con hot-reload
./scripts/migrate.sh    # Ejecutar migraciones
./scripts/diagnose.sh   # Diagnosticar problemas
./scripts/verify.sh     # Verificar correcciones
./scripts/clean.sh      # Limpiar artefactos
```

## 📊 API REST

### Autenticación

```bash
# Estado
GET /api/auth/status

# Setup (primera vez)
POST /api/auth/setup
{"username": "admin", "password": "MyPassword123!"}

# Login
POST /api/auth/login
{"username": "admin", "password": "MyPassword123!"}

# Info del usuario actual
GET /api/auth/me

# Logout
POST /api/auth/logout
```

### Aplicaciones (Store)

```bash
# Listar apps disponibles
GET /api/docker/store/apps

# Instalar app
POST /api/docker/store/install/:id
```

### Contenedores Docker

```bash
# Listar contenedores
GET /api/docker/containers

# Iniciar
POST /api/docker/containers/:id/start

# Detener
POST /api/docker/containers/:id/stop
```

### Salud del Sistema

```bash
# Health check
GET /api/health
```

## 🐛 Reportar Problemas

1. Ejecuta: `./scripts/diagnose.sh`
2. Revisa logs: `cat logs/homepinas.log`
3. Abre issue con:
   - Output de diagnóstico
   - Logs relevantes
   - Descripción del problema
   - Pasos para reproducir

## 📈 Roadmap

### v1.0.0 (Actual)
- ✅ Autenticación básica
- ✅ Gestión de contenedores Docker
- ✅ App Store
- ✅ Validación de entrada

### v1.1.0 (Planificado)
- 🔜 Two-Factor Auth
- 🔜 Rate Limiting
- 🔜 Audit logs persistentes
- 🔜 API Keys

### v1.2.0 (Futuro)
- 🔜 WebSockets para notificaciones
- 🔜 OAuth2 integration
- 🔜 Backup automático a cloud
- 🔜 Multi-usuario avanzado

## 🤝 Contribuir

¿Quieres ayudar? ¡Genial!

1. Fork el repositorio
2. Crea rama: `git checkout -b feature/mi-feature`
3. Commits: `git commit -am 'Descripcción clara'`
4. Push: `git push origin feature/mi-feature`
5. Pull Request

### Requisitos de PR
- [ ] Pruebas incluidas
- [ ] Documentación actualizada
- [ ] Siguiendo style guide
- [ ] TypeScript sin errores

## 📞 Soporte

| Canal | Uso | Respuesta |
|-------|-----|----------|
| GitHub Issues | Bugs reportados | 24-48h |
| GitHub Discussions | Preguntas generales | 48-72h |
| Email | Crítico/Seguridad | Inmediato |

## 📋 Contenido por Rol

### 👨‍💼 Administrador del Sistema
1. Leer: [INSTALLATION.md](./INSTALLATION.md)
2. Leer: [SECURITY.md](./SECURITY.md) - Sección "Administración"
3. Usar: `./scripts/setup.sh` y `./scripts/diagnose.sh`
4. Bookmarkear: Sección de Troubleshooting

### 👨‍💻 Desarrollador
1. Leer: README.md de la raíz
2. Leer: [ARCHITECTURE.md](./ARCHITECTURE.md) si existe
3. Clonar y ejecutar: `./scripts/dev.sh`
4. Revisar: `src/` y `frontend/src/`
5. Contribuir: Seguir sección "Contribuir"

### 🔒 DevSecOps
1. Leer: [SECURITY.md](./SECURITY.md) completamente
2. Leer: Sección Docker
3. Auditar: Variables de `.env`
4. Implementar: HTTPS, firewall, logs

### ☁️ DevOps/Cloud
1. Leer: [INSTALLATION.md](./INSTALLATION.md) - Docker
2. Revisar: `docker-compose.yml`
3. Configurar: Recursos según infraestructura
4. Monitorear: `/api/health` endpoint

## 🎓 Aprendiendo

### Tecnologías Usadas
- **Backend**: Express.js, TypeScript, Prisma
- **Frontend**: React, TypeScript, Tailwind CSS
- **Base de Datos**: SQLite con better-sqlite3
- **Contenedor**: Docker & Docker Compose
- **Autenticación**: JWT + bcryptjs

### Recursos Recomendados
- [Express.js](https://expressjs.com/)
- [Prisma ORM](https://www.prisma.io/)
- [Docker Docs](https://docs.docker.com/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT.io](https://jwt.io/)

## ✅ Checklist Pre-Producción

- [ ] JWT_SECRET cambió en `.env`
- [ ] NODE_ENV = "production"
- [ ] HTTPS configurado
- [ ] Firewall habilitado
- [ ] Backups de BD verificados
- [ ] Logs monitoreados
- [ ] Usuarios administrativos configurados
- [ ] Contraseñas fuertes en todos los usuarios
- [ ] Máximo de reintentos de login configurado
- [ ] Alertas configuradas (email, Telegram, etc)

## 📄 Licencia

Ver [LICENSE](../LICENSE) en la raíz del proyecto

## 🙏 Agradecimientos

Gracias a todos los contribuidores y la comunidad de HomeLab.

---

**Última actualización**: Abril 2026  
**Versión**: 1.0.0  
**Mantenedor**: HomePiNAS Team

[← Volver a README.md](../README.md)
