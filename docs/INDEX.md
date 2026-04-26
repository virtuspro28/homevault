# Indice de Documentacion - HomePiNAS Dashboard

## Lectura recomendada

| Documento | Uso |
|-----------|-----|
| [INSTALLATION.md](./INSTALLATION.md) | Instalacion inicial, despliegue y servicio |
| [SECURITY.md](./SECURITY.md) | Hardening, credenciales y practicas seguras |
| [API.md](./API.md) | Endpoints activos de Docker, VPN, Samba y storage |

## Estado funcional actual

- Docker Manager ya expone listado, arranque, parada, reinicio, logs e inspeccion basica.
- WireGuard ya permite crear clientes, listar, revocar, descargar `.conf` y generar QR.
- Samba/NFS ya devuelve estado real de `systemd` y permite activar o desactivar protocolos.
- Storage ya detecta pools MergerFS/SnapRAID desde configuracion, lanza sync y puede persistir configuracion base.

## Operacion en Linux real

Para sacar partido completo a los modulos nuevos conviene que el host tenga disponibles:

- `docker`
- `wg`
- `smartctl`
- `snapraid`
- `mergerfs`
- `systemctl`

Ademas, la aplicacion necesita permisos sudo suficientes para manipular WireGuard, montar pools y consultar SMART.

## Flujo de desarrollo

- Backend: `npm run build`
- Frontend: `cd frontend && npm run build`
- API base: `GET /api/health`

## Modulos con trabajo pendiente

- Gestion centralizada de agentes remotos HomePiNAS
- Automatizacion completa de preparacion WireGuard del servidor
- Validacion end-to-end de `start/stop/restart` contra una VM Linux real
- Afinado de permisos y ownership en pools y compartidos de produccion

## Nota de traspaso

La guia local de progreso del ultimo relevo vive en `docs_local/guia_progreso.md` y complementa este indice con decisiones de implementacion y siguientes pasos.
