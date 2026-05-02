# Documentacion del Sistema HomeVault

Este archivo es el informe de traspaso tecnico del estado real del proyecto en la fecha del ultimo relevo. Su objetivo es permitir que otra IA o cualquier desarrollador humano continúe el trabajo sin perder contexto, sin repetir diagnosticos ya cerrados y sin reabrir cambios estabilizados.

## 1. Identidad actual del proyecto

- El proyecto ya no debe tratarse como `HomePiNAS`.
- El nombre operativo y de despliegue es `HomeVault`.
- El servicio del sistema, los mensajes OTA y la documentacion funcional ya usan el estandar `HomeVault`.
- Todas las variables de entorno, nombres de servicio, rutas de documentacion y nuevas referencias deben seguir este mismo estandar.

Estado relevante:

- `package.json` usa `name: "homevault"` y `version: "1.0.2"`.
- El backend imprime en arranque `HomeVault Dashboard v1.0.2`.
- El OTA reinicia `homevault.service` con `sudo systemctl restart homevault.service`.

Regla para la siguiente IA:

- No volver a introducir nombres legacy como `HomePiNAS`, `CasaOS` o variantes mixtas en mensajes, variables o documentacion nueva, salvo cuando se documente una migracion historica.

## 2. Estado de rutas del Explorador

### Ruta absoluta confirmada

La ruta absoluta usada ahora por el backend para el Explorador es:

`/opt/homevault/data`

Esto ya no es una suposicion ni una ruta opcional por defecto. En el codigo actual:

- `src/config/index.ts` define `HOMEVAULT_STORAGE_ROOT = "/opt/homevault/data"`.
- `config.storage.basePath` queda fijado a esa constante.
- `src/services/files.service.ts` contiene tambien `DEFAULT_STORAGE_ROOT = "/opt/homevault/data"` como respaldo interno.

### Comportamiento actual del backend

Archivos implicados:

- `src/config/index.ts`
- `src/services/files.service.ts`
- `src/index.ts`

Logica actual:

1. El backend resuelve todas las operaciones del Explorador contra `config.storage.basePath`.
2. `normalizeRequestedPath()` convierte `""`, `/` y `.` en raiz logica interna.
3. `resolveStoragePath()` protege contra path traversal y obliga a que todo quede dentro de la raiz permitida.
4. `ensureStorageRootExists()` crea `/opt/homevault/data` con `fs.mkdir(..., { recursive: true })`.
5. `src/index.ts` ejecuta `ensureStorageRootExists()` al arrancar la aplicacion, antes de abrir el servidor HTTP.
6. Si el frontend pide `/`, `listFiles()` no devuelve ya `Directory not found: /` por falta de carpeta base. Si la raiz no existe, la crea y devuelve `[]`.

### Motivo del ultimo cambio

El explorador seguia fallando porque:

- parte de la logica habia vivido temporalmente en una rama separada mientras la OTA tiraba de `origin/main`;
- y ademas el backend podia seguir devolviendo `ENOENT` si `/opt/homevault/data` no existia fisicamente todavia.

Eso ya se corrigio.

### Estado actual del frontend

Archivo implicado:

- `frontend/src/pages/FileManager.tsx`

Confirmaciones:

- La ruta usada por el frontend es `"/api/files/list"`.
- Se centralizo en la constante `FILES_LIST_ENDPOINT = '/api/files/list'`.
- La carga inicial hace `fetchFiles('/')`.
- Si la carpeta esta vacia, la UI ya no debe parecer congelada: muestra estado vacio con icono de carpeta y texto explicativo.

### Lo primero que debe validar la siguiente IA

Aunque el codigo ya esta preparado, la siguiente IA debe comprobar en entorno real Linux:

1. Que `/opt/homevault/data` existe despues del arranque del servicio.
2. Que el usuario del servicio tiene permisos reales de lectura y escritura sobre esa ruta.
3. Que el endpoint `GET /api/files/list?path=/` devuelve `success: true` con `data: []` cuando la carpeta esta vacia.
4. Que la UI no muestra ya `Directory not found: /`.

## 3. Cambios de UI en CloudManager

### Estado actual del selector de proveedores

Archivo implicado:

- `frontend/src/pages/CloudManager.tsx`

El selector anterior de tipo de unidad ya no es un `select` clasico. Fue reescrito a un sistema de botones visuales para evitar:

- problemas de renderizado del desplegable;
- texto gris poco visible;
- errores por rutas no validas que devolvian HTML y provocaban `Unexpected token <`.

### Proveedores hardcodeados

Los proveedores visibles en codigo son:

- `WebDAV`
- `SMB`
- `SFTP`
- `FTP`
- `Google Drive`
- `OneDrive`

Se definen en `PROVIDER_DEFINITIONS`.

### Estado visual confirmado

La correccion visual actual hace lo siguiente:

- el contenedor del selector usa `overflow-visible`;
- la opcion activa usa `text-white`;
- la opcion inactiva ya no usa `text-slate-200`, sino `text-white` con hover hacia azul;
- el cambio de proveedor se hace con botones, no con un desplegable del navegador.

Clases relevantes actuales:

- contenedor: `overflow-visible rounded-2xl border border-white/10 bg-slate-950/80 p-3`
- activo: `border-blue-400/40 bg-blue-500/20 text-white`
- inactivo: `border-white/10 bg-slate-900 text-white hover:border-blue-400/30 hover:bg-slate-800 hover:text-blue-300`

### Logica asociada

La seleccion del proveedor depende de:

- `selectedProvider`
- `handleProviderSelect(provider)`
- `activeProvider`

Cuando se pulsa un boton:

1. se actualiza `selectedProvider`;
2. se actualiza `form.provider`;
3. cambia dinamicamente el bloque de campos renderizados.

### Respuesta defensiva ante HTML inesperado

`CloudManager.tsx` incluye `parseApiResponse()` para protegerse cuando un endpoint no devuelve JSON. Si llega HTML, el frontend detecta `content-type` invalido y lanza un error explicito en vez de romper el componente con `Unexpected token <`.

## 4. Endpoints de sistema y privilegios

### Endpoints documentados

Archivo implicado:

- `src/routes/system.ts`

Endpoints actuales:

- `POST /api/system/reboot`
- `POST /api/system/shutdown`

Protecciones actuales:

- `requireAuth`
- `requireAdmin`

Comandos ejecutados:

- reboot: `sudo /sbin/reboot`
- shutdown: `sudo /sbin/shutdown -h now`

### Requisito operativo de sudo

Importante: el codigo del backend asume que el usuario del servicio puede ejecutar esos comandos via `sudo` sin bloqueo interactivo.

Lo que si esta confirmado en codigo:

- el backend usa `sudo` explicitamente;
- el backend no gestiona password interactiva;
- por tanto, el host Linux necesita un archivo de `sudoers` o configuracion equivalente que permita esos comandos al usuario del servicio.

Lo que no esta versionado dentro del repositorio:

- el archivo real de `/etc/sudoers.d/...` no esta dentro del repo;
- por tanto, la siguiente IA debe validar en la maquina de destino el archivo operativo exacto.

Recomendacion operativa que debe comprobarse primero:

- que exista un fichero tipo `/etc/sudoers.d/homevault` o equivalente;
- que permita al usuario del servicio ejecutar sin password:
  - `/sbin/reboot`
  - `/sbin/shutdown -h now`
  - opcionalmente `systemctl restart homevault.service` si se usa OTA completa

### Relacion con Header

La UI del header ya llama a:

- `/api/system/reboot`
- `/api/system/shutdown`

Si esos botones fallan en la maquina real y el backend responde `success: true` pero la accion no se ejecuta, el siguiente punto a revisar no es React, sino `sudoers` o el usuario real del servicio systemd.

## 5. Estado del sistema OTA

### Regla importante

No tocar mas el sistema de actualizaciones salvo bug real nuevo. El usuario indico explicitamente que las actualizaciones ya funcionan y no quiere mas cambios sobre esa parte salvo necesidad critica.

### Estado actual

Archivos implicados:

- `src/routes/system.ts`
- `src/services/update.service.ts`

Estado estabilizado:

- la comprobacion de updates ya no depende de HTML accidental;
- los endpoints de update fuerzan salida JSON con `res.type("application/json").send(JSON.stringify(...))`;
- eso evita el error del frontend `Unexpected token '<'`, que antes aparecia cuando una ruta acababa devolviendo HTML o un error no serializado;
- la OTA ya esta publicada en `main`, que es la rama de referencia unica para el usuario.

### Flujo OTA actual

Resumen del flujo de `UpdateService.performUpdate()`:

1. registra log de inicio OTA;
2. en Windows devuelve simulacion y no ejecuta cambios reales;
3. en Linux hace:
   - `git reset --hard HEAD`
   - `git fetch origin main`
   - `git pull origin main`
   - `npm install --include=dev`
   - `npm --prefix frontend install --include=dev`
   - `npm --prefix frontend run build`
   - `npx prisma generate`
   - `npx prisma db push`
   - `npm run build`
4. si todo va bien, programa `sudo systemctl restart homevault.service` tras 5 segundos.

### Bypass del error JSON

El error de `Unexpected token '<'` se neutralizo de dos maneras:

1. Backend:
   - los endpoints de update fuerzan `application/json` incluso en error.
2. Frontend:
   - componentes como `CloudManager` verifican `content-type` antes de intentar `response.json()`.

Esto evita que una pagina HTML 404 o un error no JSON revienten el parseo del frontend.

## 6. Estado actual de App Store

Aunque esta tarea final no ha tocado App Store, el relevo necesita saberlo.

Archivos implicados:

- `src/data/appInventory.ts`
- `frontend/src/pages/AppStore.tsx`

Estado resumido:

- el catalogo fue reconstruido para mapear correctamente contra el nuevo `appInventory`;
- se eliminaron roturas por `map is not a function`;
- `AppStore.tsx` ya trabaja con tipado explicito en vez de depender de `any`;
- el frontend normaliza catalogos y datos incompletos antes de renderizar;
- la instalacion usa `defaultConfig` con defensas para campos indefinidos.

La siguiente IA no deberia reescribir App Store desde cero salvo regression visible nueva.

## 7. Estado actual del Explorador y de la UX de carpeta vacia

Resumen claro:

- backend: raiz fija en `/opt/homevault/data`;
- backend: crea la carpeta base si no existe;
- frontend: llama a `/api/files/list`;
- frontend: inicializa la carga en `/`;
- frontend: si no hay contenido y no hay error, enseña estado vacio utilizable con icono de carpeta.

Si el usuario vuelve a ver la UI vacia con error, el orden de chequeo debe ser:

1. permisos de `/opt/homevault/data`;
2. existencia real del directorio;
3. respuesta del endpoint `/api/files/list?path=/`;
4. servicio systemd realmente reiniciado con la version de `main`;
5. cache del navegador o despliegue de frontend viejo.

## 8. Estado de ramas y politica de despliegue

Punto muy importante para la siguiente IA:

- el usuario pidio expresamente dejar de trabajar en ramas paralelas porque le confunden;
- desde ese momento, los cambios deben publicarse en `main`;
- la OTA consulta `origin/main`, asi que cualquier arreglo que deba llegar al sistema real debe terminar en `main`.

Regla operativa:

- no volver a dejar arreglos funcionales solo en ramas `codex/*`;
- si se usa una rama temporal para resolver algo complejo, debe integrarse de inmediato en `main` antes de cerrar la tarea.

## 9. Pendientes criticos para la siguiente IA

Orden sugerido de revision practica:

1. Verificar en la maquina Linux real que `homevault.service` arranca con acceso efectivo a `/opt/homevault/data`.
2. Probar `GET /api/files/list?path=/` directamente y validar JSON correcto con carpeta vacia y con contenido.
3. Confirmar que el Explorador navega a subcarpetas, renombra y crea carpetas dentro de `/opt/homevault/data`.
4. Verificar montaje real de Rclone desde `CloudManager` con al menos un perfil de `WebDAV` y uno de `SMB`.
5. Confirmar que las rutas de montaje de Rclone bajo `/opt/homevault/remote/[nombre]` existen y tienen permisos funcionales.
6. Probar visualmente el selector de proveedores en distintos anchos de pantalla para confirmar que ninguna opcion queda cortada.
7. Probar instalacion real desde App Store de una app sencilla y validar la generacion del compose en `/store-manifests/<app_id>/docker-compose.yml`.
8. Probar la instalacion de AirDC++ con los presets nuevos y confirmar que `defaultConfig`, puertos, volumenes y variables se materializan correctamente.
9. Revisar si la configuracion de `sudoers` del host incluye sin password los comandos de reboot, shutdown y restart del servicio.
10. Verificar que los botones del header ejecutan la accion real en Debian/Ubuntu y no solo responden `success: true`.
11. Confirmar que el flujo OTA sigue estable tras varios reinicios del servicio y que no quedan diferencias entre lo desplegado y `origin/main`.

## 10. Archivos mas sensibles ahora mismo

Si la siguiente IA necesita diagnosticar algo rapido, estos son los archivos clave:

- `src/config/index.ts`
- `src/index.ts`
- `src/services/files.service.ts`
- `src/routes/system.ts`
- `src/services/update.service.ts`
- `src/data/appInventory.ts`
- `frontend/src/pages/FileManager.tsx`
- `frontend/src/pages/CloudManager.tsx`
- `frontend/src/pages/AppStore.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/layout/MainLayout.tsx`

## 11. Resumen ejecutivo del relevo

Estado consolidado al cierre de este traspaso:

- HomeVault es ya el nombre oficial del proyecto.
- La raiz del Explorador es `/opt/homevault/data`.
- Esa carpeta se crea automaticamente en backend al arrancar.
- El frontend del Explorador consume `/api/files/list`.
- El selector de proveedores de CloudManager ya es un sistema de botones con texto visible en blanco.
- Los endpoints de reinicio y apagado existen y dependen de permisos `sudo` del host.
- La OTA esta estabilizada y no debe tocarse sin necesidad real.
- La rama de verdad para despliegue es `main`.

Fin del informe tecnico de traspaso.
