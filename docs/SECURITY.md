# 🔐 Guía de Seguridad - HomeVault Dashboard

## Introducción

Este documento describe las mejores prácticas de seguridad implementadas en HomeVault Dashboard y cómo mantener tu instalación segura.

## 1. Autenticación & Contraseñas

### Política de Contraseñas

**Setup Inicial (Contraseña OWNER)**
- **Mínimo**: 12 caracteres
- **Requisitos**: Mayúsculas, minúsculas, números
- **Especial**: Se recomienda incluir caracteres especiales

**Login Posterior (Contraseña Usuario)**
- **Mínimo**: 8 caracteres
- **Sin requisitos especiales**, pero se recomienda:
  - Mayúsculas + minúsculas + números
  - No usar información personal (nombre, fecha de nacimiento, etc.)

### Implementación

```typescript
// Hashing: bcrypt con 12 rondas (OWASP recomendado)
const salt = await bcrypt.genSalt(12);
const hashed = await bcrypt.hash(password, salt);

// Verificación: comparación temporal constant
const isMatch = await bcrypt.compare(password, storedHash);
```

**Nunca almacenes contraseñas en texto plano.**

## 2. JWT & Sesiones

### Configuración de Cookies

```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,        // No accesible desde JavaScript
  secure: true,          // HTTPS solo (producción)
  sameSite: "strict",    // Protección CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 días
};
```

### Tokens JWT

- **Duración**: 7 días (configurable en `.env`)
- **Firme**: RS256 (asimétrico) o HS256 (simétrico)
- **Claims**: `id`, `username`, `role`
- **Secreto**: Usa `openssl rand -base64 32`

**Generar nuevo secreto:**
```bash
openssl rand -base64 32
```

## 3. Control de Acceso Basado en Roles (RBAC)

### Roles Disponibles

| Rol | Permisos |
|-----|----------|
| **OWNER** | Control total del sistema, configuración crítica, usuarios |
| **ADMIN** | Gestión de aplicaciones, backups, configuración |
| **USER** | Acceso a datos, lectura de logs |
| **VIEWER** | Solo lectura (dashboards, estadísticas) |

### Middlewares de Protección

```typescript
// Requiere autenticación
router.use(requireAuth);

// Requiere rol ADMIN
router.use(requireAdmin);

// Requiere rol OWNER
router.use(requireOwner);
```

## 4. Validación de Entrada (Input Validation)

### Patrones Implementados

```typescript
// Usuario: 3-32 caracteres, alfanuméricos + - _
PATTERNS.username = /^[a-zA-Z0-9_\-]{3,32}$/

// Contraseña: 8-128 caracteres (cualquier carácter)
PATTERNS.password = /^.{8,128}$/

// Email: formato básico RFC
PATTERNS.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Puerto: 1-65535
PATTERNS.port = /^(6553[0-5]|655[0-2][0-9]|...|[1-9][0-9]{0,3})$/
```

### Limitaciones de Tamaño

- **Body JSON máximo**: 10 KB (previene DoS)
- **Contraseña máxima**: 128 caracteres
- **Username máximo**: 32 caracteres

## 5. Seguridad del Servidor

### Middlewares Implementados

**Helmet**: Configura headers HTTP seguros
```typescript
Strict-Transport-Security
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy
X-XSS-Protection
```

**CORS**: Control de orígenes
```typescript
// Desarrollo: * (local)
// Producción: especificar orígenes
API_CORS_ORIGIN="https://dominio.com"
```

### Rate Limiting (Recomendado)

```bash
npm install express-rate-limit
```

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100,                    // 100 requests por IP
  message: "Demasiadas solicitudes"
});

app.use(limiter);
```

## 6. Seguridad de la Base de Datos

### SQLite con mejor-sqlite3

**PRAGMAs habilitados:**
```sql
PRAGMA journal_mode = WAL;      -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;    -- Balance seguridad/rendimiento
PRAGMA foreign_keys = ON;       -- Integridad referencial
PRAGMA temp_store = MEMORY;     -- Temporales en RAM
```

**Inyección SQL:**
- ✅ Úsamos Prisma ORM (prepared statements)
- ✅ Parametrización automática
- ❌ Evitar queries dinámicas

### Backups de BD

```bash
# Backup manual
cp data/homevault.db data/homevault-$(date +%s).db.bak

# Backup automático (docker-compose)
docker-compose exec homevault-db-backup "ls backups/"
```

## 7. Seguridad de Docker

### Configuración Segura

```yaml
# docker-compose.yml
services:
  homevault:
    restart: unless-stopped
    read_only: true              # Sistema de archivos de solo lectura
    cap_drop:
      - ALL                      # Eliminar todas las capacidades
    cap_add:
      - NET_BIND_SERVICE         # Solo lo necesario
    security_opt:
      - no-new-privileges:true   # No escalar privilegios
```

### Gestión de Secretos

```bash
# ❌ NO hagas esto
docker run -e PASSWORD="1234567890"

# ✅ Usa .env en docker-compose
# docker-compose.yml
environment:
  JWT_SECRET: ${JWT_SECRET}
  
# .env (en .gitignore)
JWT_SECRET=xxxxx
```

## 8. Logging & Auditoría

### Eventos Registrados Automáticamente

- ✅ Intentos de login (éxito/fallo)
- ✅ Cambios de contraseña
- ✅ Operaciones administrativas
- ✅ Accesos denegados
- ✅ Cambios en configuración

### Acceder a Logs

```bash
# Logs del servidor
tail -f logs/homevault.log

# Logs de Docker
docker-compose logs -f homevault

# Logs del contenedor (dentro)
docker exec homevault tail -f logs/homevault.log
```

## 9. HTTPS en Producción

### Configuración con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Generar certificado
sudo certbot certonly --standalone -d tu-dominio.com

# En docker-compose.yml
environment:
  NODE_ENV: production
  
volumes:
  - /etc/letsencrypt/live/tu-dominio.com:/certs:ro
```

## 10. Firewall & Red

### Puertos a Abrir

| Puerto | Protocolo | Propósito |
|--------|-----------|----------|
| 3000 | HTTP | Dashboard |
| 443 | HTTPS | Dashboard (producción) |
| 22 | SSH | Administración remota |
| 445 | SMB | Samba (si habilitado) |

### UFW (Ubuntu/Raspberry Pi)

```bash
# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP
sudo ufw allow 80/tcp

# Permitir HTTPS
sudo ufw allow 443/tcp

# Permitir puerto 3000 solo desde red local
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Habilitar firewall
sudo ufw enable
```

## 11. Auditoría Periódica

### Checklist Semanal

- [ ] Revisar logs de login fallidos
- [ ] Verificar integridad de la BD
- [ ] Comprobar espacio en disco
- [ ] Revisar actualizaciones de dependencias

### Checklist Mensual

- [ ] Cambiar contraseñas administrativas
- [ ] Revisar y revocar usuarios inactivos
- [ ] Hacer backup completo
- [ ] Actualizar dependencias de npm

### Checklist Anual

- [ ] Renovar certificados HTTPS
- [ ] Auditoría de acceso a datos
- [ ] Revisión de políticas de seguridad
- [ ] Test de recuperación de backups

## 12. Incidentes de Seguridad

### Respuesta a Compromiso

1. **Contener**: Desconectar el servidor si es necesario
2. **Investigar**: Revisar logs para identificar vector
3. **Limpiar**: Reiniciar servicios, cambiar contraseñas
4. **Restaurar**: Desde backup limpio verificado
5. **Aprender**: Documentar y prevenir en futuro

### Contactar Soporte

- 🐛 Bugs de seguridad: issues@homevault.dev
- 📧 Responsablemente: NO publiques vulnerabilidades

## 13. Variables de Entorno Críticas

```bash
# CAMBIAR EN PRODUCCIÓN
JWT_SECRET=cambiar-esto-aqui

# Configuración de CORS
API_CORS_ORIGIN=https://tu-dominio.com

# Modo de seguridad
NODE_ENV=production

# Niveles de log
LOG_LEVEL=info

# Deshabilitables
SKIP_AUTH=false
DEBUG=false
```

## 14. Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)

---

**Última actualización**: Abril 2026  
**Versión**: 1.0.0  
**Mantenedor**: HomeVault Team
