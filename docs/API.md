# API - HomeVault Dashboard

## Estado

Esta referencia resume los endpoints activos y los cambios recientes en las areas de Docker, WireGuard, Samba/NFS y almacenamiento.

## Autenticacion

Todas las rutas de esta seccion requieren cookie de sesion valida.

## Docker

### Contenedores

- `GET /api/docker/containers`
  Lista contenedores detectados.

- `GET /api/docker/containers/:id`
  Devuelve inspeccion basica del contenedor, politica de reinicio, puertos y montajes.

- `GET /api/docker/containers/:id/stats`
  Devuelve metricas de uso en tiempo real con `docker stats --no-stream`.

- `GET /api/docker/containers/:id/logs?tail=120`
  Devuelve logs recientes del contenedor.

- `POST /api/docker/containers/:id/start`
  Arranca el contenedor.

- `POST /api/docker/containers/:id/stop`
  Detiene el contenedor.

- `POST /api/docker/containers/:id/restart`
  Reinicia el contenedor.

## VPN / WireGuard

### Estado del servidor

- `GET /api/vpn/status`
  Informa si WireGuard esta instalado, si la interfaz esta activa, endpoint resuelto, clave publica y numero de clientes.

### Clientes

- `GET /api/vpn/clients`
  Lista clientes WireGuard almacenados en Prisma.

- `POST /api/vpn/clients`
  Crea un cliente, genera claves y reserva una IP en la subred WireGuard.
  Requiere rol administrador.

- `GET /api/vpn/clients/:id/qr`
  Genera un QR en base64 para importar el perfil en movil.

- `GET /api/vpn/clients/:id/config`
  Devuelve el contenido del fichero `.conf`.

- `GET /api/vpn/clients/:id/download`
  Descarga el fichero `.conf` listo para importar.

- `DELETE /api/vpn/clients/:id`
  Revoca el cliente y elimina el peer del fichero WireGuard cuando el entorno es Linux real.
  Requiere rol administrador.

## Proxy inverso y SSL

- `GET /api/proxy/domains`
  Lista dominios proxy registrados.

- `POST /api/proxy/domains`
  Registra un dominio y genera la configuracion Nginx base.

- `POST /api/proxy/domains/:id/ssl`
  Solicita certificado SSL con Certbot.

- `DELETE /api/proxy/domains/:id`
  Elimina el dominio proxy y sus ficheros asociados.

## Samba / NFS

- `GET /api/samba/shares`
  Lista recursos compartidos definidos en Samba.

- `GET /api/samba/protocol/status`
  Devuelve estado `active/enabled` de `smbd` y `nfs-kernel-server`.

- `POST /api/samba/shares`
  Crea un recurso compartido Samba.
  Requiere rol administrador.

- `POST /api/samba/shares/nfs`
  Exporta una ruta por NFS.
  Requiere rol administrador.

- `POST /api/samba/protocol/toggle`
  Activa o desactiva SMB o NFS usando systemd.
  Requiere rol administrador.

- `DELETE /api/samba/shares/:name`
  Elimina un recurso compartido Samba.
  Requiere rol administrador.

## Storage / MergerFS / SnapRAID

- `GET /api/storage/pools`
  Detecta pools configurados leyendo `fstab` y `snapraid.conf`.

- `GET /api/storage/pool/status`
  Devuelve estado de sincronizacion SnapRAID persistido en base de datos.

- `POST /api/storage/pool/create`
  Persiste una configuracion de MergerFS y, opcionalmente, genera `snapraid.conf`.

- `POST /api/storage/pool/sync`
  Lanza `snapraid sync` en segundo plano.

- `POST /api/storage/pool/persist-pool`
  Reaplica el montaje via `mount -a`.

- `GET /api/storage/health`
  Devuelve salud SMART de los discos fisicos.

## Notas operativas

- En Windows de desarrollo se usan respuestas mock para WireGuard, Docker y pools.
- En Linux real se espera tener disponibles `wg`, `docker`, `smartctl`, `snapraid`, `mergerfs`, `systemctl` y permisos sudo adecuados.
- Para perfiles WireGuard listos para produccion conviene definir `WG_ENDPOINT`, `WG_INTERFACE` y las rutas de claves del servidor.
