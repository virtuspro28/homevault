# Documentación del Sistema HomeVault

Este documento resume la arquitectura de despliegue, persistencia de datos y gestión de permisos del entorno HomeVault. 

## 1. App Store: Cómo añadir una nueva app oficial manualmente

La App Store de HomeVault ha sido reescrita para depender exclusivamente de fuentes oficiales y originales (Docker Hub, GitHub Container Registry) abandonando la dependencia en el catálogo de terceros (CasaOS). 

El catálogo es **100% estático, auditable y seguro**, definido en el propio código fuente de la aplicación.

### Pasos para añadir una nueva app:
1. Localiza el archivo del catálogo en el código fuente: `src/data/appInventory.ts`
2. Añade un nuevo bloque al array `appInventory` definiendo la configuración de la app oficial.

**Ejemplo de bloque a añadir:**
```typescript
{
  id: "jellyfin",
  name: "Jellyfin Media Server",
  description: "Servidor multimedia de software libre.",
  icon: "Play",
  image: "linuxserver/jellyfin:latest", // <-- Imagen y tag oficial
  category: "Media",
  ports: ["8096:8096"],
  env: {
    PUID: "1000",
    PGID: "1000",
    TZ: "Europe/Madrid"
  },
  source: "local"
}
```
3. Guarda el archivo, vuelve a compilar el backend (`npm run build`) y reinicia el servicio (`sudo systemctl restart homevault.service`). La app aparecerá instantáneamente en la interfaz lista para desplegarse mediante su propio archivo `docker-compose.yml` que HomeVault generará en tiempo real.

## 2. Persistencia de Datos y Volúmenes

Para garantizar que ningún dato se pierda cuando actualices, borres o modifiques contenedores, toda la persistencia se centraliza en un único directorio maestro de almacenamiento, evitando que los datos se dispersen por el sistema de archivos de Linux.

### Estructura de Persistencia
* **Ruta Maestra Configurada:** Definida en el entorno, por defecto mapeada típicamente a `/opt/homevault/data` (o `/home/sr_android/homevault/data` si has modificado el directorio en la UI/variables de entorno).
* **Manifiestos generados:** Cuando instalas una app, HomeVault genera de forma invisible un archivo compose estándar en la subcarpeta `/store-manifests/<app_id>/docker-compose.yml`.
* **Datos de configuración de la app:** Los volúmenes (como la carpeta de `/config` de LinuxServer) se montan automáticamente apuntando a la ruta `<Ruta Maestra>/<app_id>`.

Por lo tanto, los datos de Pi-hole vivirán en:
`<Ruta Maestra>/pihole/`

**¿Cómo hacer un backup?**
Simplemente copia la carpeta maestra de datos. Contiene tanto la base de datos de HomeVault como las configuraciones internas de todos tus contenedores.

## 3. Resolución de Problemas: Permisos del Socket de Docker

El gestor de instalaciones necesita comunicarse directamente con el daemon de Docker mediante el socket local `/var/run/docker.sock`. Si la UI (en el panel de logs) escupe el error **"Docker no está disponible o el servicio NodeJS no tiene permisos de socket"**, el problema es de permisos a nivel de sistema operativo.

### Explicación del problema
Si arrancas HomeVault manualmente usando `npm run dev` o `npm start` bajo tu cuenta de usuario (ej. `sr_android` o `pi`), tu cuenta no tiene permisos administrativos nativos sobre el motor de Docker.

### Solución Definitiva
No uses `sudo npm start`. La forma correcta en Linux es añadir tu usuario de confianza al grupo de seguridad `docker`.

1. **Añade tu usuario al grupo docker:**
   ```bash
   sudo usermod -aG docker $USER
   ```
2. **Refresca los grupos de la sesión actual sin tener que reiniciar:**
   ```bash
   newgrp docker
   ```
3. **Verifica que tienes acceso:**
   ```bash
   docker ps
   ```
   *(Si el comando de arriba no arroja "permission denied", el problema está resuelto).*
4. Vuelve a arrancar HomeVault. Ahora la aplicación podrá interactuar libremente con Docker sin chocar con bloqueos del kernel.
