import path from "node:path";

export interface AppPortMapping {
  host: string;
  container: string;
  protocol?: "tcp" | "udp" | undefined;
  label?: string | undefined;
}

export interface AppVolumeMapping {
  host: string;
  container: string;
  label?: string | undefined;
}

export interface AppEnvVar {
  key: string;
  value: string;
  label?: string | undefined;
}

export interface AppDefaultConfig {
  ports: AppPortMapping[];
  volumes: AppVolumeMapping[];
  env: AppEnvVar[];
  webPath?: string | undefined;
  networkMode?: string | undefined;
  privileged?: boolean | undefined;
  capAdd?: string[] | undefined;
}

export interface AppInventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  image?: string | undefined;
  category: string;
  source: "local" | "custom";
  developer?: string | undefined;
  defaultConfig: AppDefaultConfig;
  ports: AppPortMapping[];
  volumes: AppVolumeMapping[];
  env: AppEnvVar[];
  networkMode?: string | undefined;
  privileged?: boolean | undefined;
  capAdd?: string[] | undefined;
}

const DATA_ROOT = (process.env["HOMEVAULT_DATA_ROOT"]?.trim()
  || process.env["STORAGE_BASE_PATH"]?.trim()
  || path.resolve(process.cwd(), "data")).replace(/\\/g, "/");
const DEFAULT_TZ = "Europe/Madrid";
const DEFAULT_PUID = "1000";
const DEFAULT_PGID = "1000";

function appDataPath(appId: string, ...segments: string[]): string {
  return [DATA_ROOT, "apps", appId, ...segments].join("/");
}

function sharedDataPath(...segments: string[]): string {
  return [DATA_ROOT, ...segments].join("/");
}

function envVar(key: string, value: string, label?: string): AppEnvVar {
  return { key, value, label };
}

function port(host: string, container: string, label: string, protocol: "tcp" | "udp" = "tcp"): AppPortMapping {
  return { host, container, label, protocol };
}

function volume(host: string, container: string, label: string): AppVolumeMapping {
  return { host, container, label };
}

function createApp(item: Omit<AppInventoryItem, "ports" | "volumes" | "env">): AppInventoryItem {
  return {
    ...item,
    ports: item.defaultConfig.ports.map((entry) => ({ ...entry })),
    volumes: item.defaultConfig.volumes.map((entry) => ({ ...entry })),
    env: item.defaultConfig.env.map((entry) => ({ ...entry })),
    networkMode: item.defaultConfig.networkMode,
    privileged: item.defaultConfig.privileged,
    capAdd: item.defaultConfig.capAdd ? [...item.defaultConfig.capAdd] : undefined,
  };
}

function withUserMapping(appId: string, image: string, name: string, description: string, category: string, icon: string, developer: string, config: AppDefaultConfig): AppInventoryItem {
  const mergedConfig: AppDefaultConfig = {
    ...config,
    env: [
      envVar("PUID", DEFAULT_PUID, "UID del usuario"),
      envVar("PGID", DEFAULT_PGID, "GID del usuario"),
      envVar("TZ", DEFAULT_TZ, "Timezone"),
      ...config.env,
    ],
  };

  return createApp({
    id: appId,
    name,
    description,
    icon,
    image,
    category,
    source: "local",
    developer,
    defaultConfig: mergedConfig,
  });
}

export const appInventory: AppInventoryItem[] = [
  createApp({
    id: "pihole",
    name: "Pi-hole",
    description: "Bloqueo de publicidad y DNS local para toda la red, con panel web y configuración persistente.",
    icon: "/assets/icons/pihole.svg",
    image: "pihole/pihole:latest",
    category: "Networking",
    source: "local",
    developer: "Pi-hole",
    defaultConfig: {
      ports: [
        port("8081", "80", "Web UI"),
        port("53", "53", "DNS TCP"),
        port("53", "53", "DNS UDP", "udp"),
        port("8443", "443", "HTTPS"),
      ],
      volumes: [
        volume(appDataPath("pihole", "etc-pihole"), "/etc/pihole", "Pi-hole data"),
        volume(appDataPath("pihole", "dnsmasq"), "/etc/dnsmasq.d", "dnsmasq"),
      ],
      env: [
        envVar("TZ", DEFAULT_TZ, "Timezone"),
        envVar("FTLCONF_webserver_api_password", "", "Password panel web"),
        envVar("DNSMASQ_LISTENING", "all", "Escucha DNS"),
      ],
      webPath: "/admin",
      capAdd: ["NET_ADMIN"],
    },
  }),
  createApp({
    id: "adguard-home",
    name: "AdGuard Home",
    description: "DNS filtrado con bloqueo de anuncios, malware y control parental desde una interfaz moderna.",
    icon: "/assets/icons/adguard-home.svg",
    image: "adguard/adguardhome:latest",
    category: "Networking",
    source: "local",
    developer: "AdGuard",
    defaultConfig: {
      ports: [
        port("3000", "3000", "Setup UI"),
        port("8082", "80", "Panel web"),
        port("53", "53", "DNS TCP"),
        port("53", "53", "DNS UDP", "udp"),
        port("8443", "443", "HTTPS"),
        port("853", "853", "DNS over TLS"),
      ],
      volumes: [
        volume(appDataPath("adguard-home", "work"), "/opt/adguardhome/work", "Work"),
        volume(appDataPath("adguard-home", "conf"), "/opt/adguardhome/conf", "Config"),
      ],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  createApp({
    id: "plex",
    name: "Plex Media Server",
    description: "Servidor multimedia para películas, series, música y fotos con clientes en TV, móvil y web.",
    icon: "/assets/icons/plex.svg",
    image: "plexinc/pms-docker:latest",
    category: "Media",
    source: "local",
    developer: "Plex",
    defaultConfig: {
      ports: [port("32400", "32400", "Web UI")],
      volumes: [
        volume(appDataPath("plex", "config"), "/config", "Config"),
        volume(appDataPath("plex", "transcode"), "/transcode", "Transcode"),
        volume(sharedDataPath("media"), "/data", "Media library"),
      ],
      env: [
        envVar("TZ", DEFAULT_TZ, "Timezone"),
        envVar("PLEX_CLAIM", "", "Plex Claim Token"),
      ],
    },
  }),
  createApp({
    id: "jellyfin",
    name: "Jellyfin",
    description: "Alternativa libre a Plex con streaming multimedia, bibliotecas y gestión de usuarios.",
    icon: "/assets/icons/jellyfin.svg",
    image: "jellyfin/jellyfin:latest",
    category: "Media",
    source: "local",
    developer: "Jellyfin",
    defaultConfig: {
      ports: [port("8096", "8096", "Web UI")],
      volumes: [
        volume(appDataPath("jellyfin", "config"), "/config", "Config"),
        volume(appDataPath("jellyfin", "cache"), "/cache", "Cache"),
        volume(sharedDataPath("media"), "/media", "Media library"),
      ],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  withUserMapping(
    "transmission",
    "linuxserver/transmission:latest",
    "Transmission",
    "Cliente BitTorrent ligero con panel web, cola de descargas y carpeta watch.",
    "/assets/icons/transmission.svg",
    "/assets/icons/qbittorrent.svg",
    "LinuxServer.io",
    {
      ports: [
        port("9091", "9091", "Web UI"),
        port("51413", "51413", "Torrent TCP"),
        port("51413", "51413", "Torrent UDP", "udp"),
      ],
      volumes: [
        volume(appDataPath("transmission", "config"), "/config", "Config"),
        volume(sharedDataPath("downloads", "transmission"), "/downloads", "Downloads"),
        volume(sharedDataPath("downloads", "watch"), "/watch", "Watch"),
      ],
      env: [
        envVar("USER", "homevault", "Usuario panel"),
        envVar("PASS", "homevault", "Password panel"),
        envVar("TRANSMISSION_WEB_HOME", "", "Tema web opcional"),
      ],
    },
  ),
  withUserMapping(
    "qbittorrent",
    "linuxserver/qbittorrent:latest",
    "qBittorrent",
    "Cliente BitTorrent con búsqueda, límites avanzados y panel web configurable.",
    "Download",
    "Download",
    "LinuxServer.io",
    {
      ports: [
        port("8080", "8080", "Web UI"),
        port("6881", "6881", "Torrent TCP"),
        port("6881", "6881", "Torrent UDP", "udp"),
      ],
      volumes: [
        volume(appDataPath("qbittorrent", "config"), "/config", "Config"),
        volume(sharedDataPath("downloads", "qbittorrent"), "/downloads", "Downloads"),
      ],
      env: [envVar("WEBUI_PORT", "8080", "Puerto panel web")],
    },
  ),
  withUserMapping(
    "airdcpp",
    "gangefors/airdcpp-webclient:latest",
    "AirDC++ Web Client",
    "Cliente DC++ con interfaz web y directorios dedicados para descargas y contenido compartido.",
    "Download",
    "/assets/icons/airdcpp.svg",
    "gangefors",
    {
      ports: [
        port("5600", "5600", "Web UI HTTP"),
        port("5601", "5601", "Web UI HTTPS"),
        port("21248", "21248", "Client TCP"),
        port("21248", "21248", "Client UDP", "udp"),
        port("21249", "21249", "Encrypted TCP"),
      ],
      volumes: [
        volume(appDataPath("airdcpp", "config"), "/.airdcpp", "Config"),
        volume(sharedDataPath("downloads", "airdcpp"), "/Downloads", "Downloads"),
        volume(sharedDataPath("share", "airdcpp"), "/Share", "Shared library"),
      ],
      env: [],
    },
  ),
  createApp({
    id: "immich",
    name: "Immich",
    description: "Gestor de fotos y vídeos autoalojado con copias automáticas y búsqueda moderna.",
    icon: "/assets/icons/immich.svg",
    image: "ghcr.io/immich-app/immich-server:release",
    category: "Media",
    source: "local",
    developer: "Immich",
    defaultConfig: {
      ports: [port("2283", "2283", "Web UI")],
      volumes: [volume(appDataPath("immich", "upload"), "/usr/src/app/upload", "Uploads")],
      env: [
        envVar("TZ", DEFAULT_TZ, "Timezone"),
        envVar("DB_HOSTNAME", "immich-database", "PostgreSQL host"),
        envVar("DB_USERNAME", "immich", "PostgreSQL user"),
        envVar("DB_PASSWORD", "immich", "PostgreSQL password"),
        envVar("DB_DATABASE_NAME", "immich", "Database name"),
        envVar("REDIS_HOSTNAME", "immich-redis", "Redis host"),
      ],
    },
  }),
  withUserMapping(
    "sonarr",
    "linuxserver/sonarr:latest",
    "Sonarr",
    "Gestión automática de series, indexadores y descargas con integración torrent y Usenet.",
    "Download",
    "/assets/icons/sonarr.svg",
    "LinuxServer.io",
    {
      ports: [port("8989", "8989", "Web UI")],
      volumes: [
        volume(appDataPath("sonarr", "config"), "/config", "Config"),
        volume(sharedDataPath("media", "tv"), "/tv", "TV library"),
        volume(sharedDataPath("downloads"), "/downloads", "Downloads"),
      ],
      env: [],
    },
  ),
  withUserMapping(
    "radarr",
    "linuxserver/radarr:latest",
    "Radarr",
    "Gestor automático de películas con monitorización de calidad y descargas.",
    "Download",
    "/assets/icons/radarr.svg",
    "LinuxServer.io",
    {
      ports: [port("7878", "7878", "Web UI")],
      volumes: [
        volume(appDataPath("radarr", "config"), "/config", "Config"),
        volume(sharedDataPath("media", "movies"), "/movies", "Movies"),
        volume(sharedDataPath("downloads"), "/downloads", "Downloads"),
      ],
      env: [],
    },
  ),
  withUserMapping(
    "prowlarr",
    "linuxserver/prowlarr:latest",
    "Prowlarr",
    "Proxy e indexador central para Sonarr, Radarr y el resto del stack multimedia.",
    "Download",
    "/assets/icons/prowlarr.svg",
    "LinuxServer.io",
    {
      ports: [port("9696", "9696", "Web UI")],
      volumes: [volume(appDataPath("prowlarr", "config"), "/config", "Config")],
      env: [],
    },
  ),
  withUserMapping(
    "overseerr",
    "linuxserver/overseerr:latest",
    "Overseerr",
    "Portal de solicitudes para bibliotecas Plex/Jellyfin con gestión de peticiones.",
    "Media",
    "/assets/icons/overseerr.svg",
    "LinuxServer.io",
    {
      ports: [port("5055", "5055", "Web UI")],
      volumes: [volume(appDataPath("overseerr", "config"), "/config", "Config")],
      env: [],
    },
  ),
  createApp({
    id: "nextcloud",
    name: "Nextcloud",
    description: "Nube autoalojada para archivos, colaboración y sincronización entre dispositivos.",
    icon: "/assets/icons/nextcloud.svg",
    image: "nextcloud:latest",
    category: "Storage",
    source: "local",
    developer: "Nextcloud",
    defaultConfig: {
      ports: [port("8083", "80", "Web UI")],
      volumes: [
        volume(appDataPath("nextcloud", "html"), "/var/www/html", "App data"),
        volume(sharedDataPath("cloud"), "/var/www/html/data", "User data"),
      ],
      env: [
        envVar("TZ", DEFAULT_TZ, "Timezone"),
        envVar("NEXTCLOUD_TRUSTED_DOMAINS", "", "Trusted domains"),
      ],
    },
  }),
  createApp({
    id: "gitea",
    name: "Gitea",
    description: "Servicio Git autoalojado ligero con interfaz tipo GitHub y soporte SSH.",
    icon: "/assets/icons/gitea.svg",
    image: "gitea/gitea:latest",
    category: "Development",
    source: "local",
    developer: "Gitea",
    defaultConfig: {
      ports: [
        port("3001", "3000", "Web UI"),
        port("2222", "22", "SSH"),
      ],
      volumes: [volume(appDataPath("gitea", "data"), "/data", "Data")],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  createApp({
    id: "nginx-proxy-manager",
    name: "Nginx Proxy Manager",
    description: "Proxy inverso con certificados SSL y panel amigable para exponer servicios.",
    icon: "/assets/icons/nginx-proxy-manager.svg",
    image: "jc21/nginx-proxy-manager:latest",
    category: "Networking",
    source: "local",
    developer: "Nginx Proxy Manager",
    defaultConfig: {
      ports: [
        port("81", "81", "Admin UI"),
        port("80", "80", "HTTP"),
        port("443", "443", "HTTPS"),
      ],
      volumes: [
        volume(appDataPath("nginx-proxy-manager", "data"), "/data", "Data"),
        volume(appDataPath("nginx-proxy-manager", "letsencrypt"), "/etc/letsencrypt", "Let's Encrypt"),
      ],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  createApp({
    id: "vaultwarden",
    name: "Vaultwarden",
    description: "Servidor compatible con Bitwarden, ligero y apto para NAS doméstico.",
    icon: "/assets/icons/vaultwarden.svg",
    image: "vaultwarden/server:latest",
    category: "Security",
    source: "local",
    developer: "Vaultwarden",
    defaultConfig: {
      ports: [port("8222", "80", "Web UI")],
      volumes: [volume(appDataPath("vaultwarden", "data"), "/data", "Data")],
      env: [
        envVar("TZ", DEFAULT_TZ, "Timezone"),
        envVar("SIGNUPS_ALLOWED", "false", "Permitir registro"),
      ],
    },
  }),
  createApp({
    id: "portainer",
    name: "Portainer",
    description: "Panel de gestión Docker para ver, desplegar y administrar contenedores.",
    icon: "/assets/icons/portainer.svg",
    image: "portainer/portainer-ce:latest",
    category: "Monitoring",
    source: "local",
    developer: "Portainer",
    defaultConfig: {
      ports: [port("9000", "9000", "Web UI")],
      volumes: [
        volume("/var/run/docker.sock", "/var/run/docker.sock", "Docker socket"),
        volume(appDataPath("portainer", "data"), "/data", "Data"),
      ],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  createApp({
    id: "grafana",
    name: "Grafana",
    description: "Dashboards para métricas, logs y telemetría del sistema o servicios externos.",
    icon: "/assets/icons/grafana.svg",
    image: "grafana/grafana:latest",
    category: "Monitoring",
    source: "local",
    developer: "Grafana Labs",
    defaultConfig: {
      ports: [port("3002", "3000", "Web UI")],
      volumes: [volume(appDataPath("grafana", "data"), "/var/lib/grafana", "Data")],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  createApp({
    id: "influxdb",
    name: "InfluxDB",
    description: "Base de datos de series temporales para métricas, sensores y monitorización.",
    icon: "/assets/icons/influxdb.svg",
    image: "influxdb:2",
    category: "Monitoring",
    source: "local",
    developer: "InfluxData",
    defaultConfig: {
      ports: [port("8086", "8086", "API / UI")],
      volumes: [
        volume(appDataPath("influxdb", "data"), "/var/lib/influxdb2", "Data"),
        volume(appDataPath("influxdb", "config"), "/etc/influxdb2", "Config"),
      ],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  createApp({
    id: "home-assistant",
    name: "Home Assistant",
    description: "Plataforma domótica con control local, integraciones y automatizaciones.",
    icon: "/assets/icons/home-assistant.svg",
    image: "ghcr.io/home-assistant/home-assistant:stable",
    category: "Automation",
    source: "local",
    developer: "Home Assistant",
    defaultConfig: {
      ports: [port("8123", "8123", "Web UI")],
      volumes: [volume(appDataPath("home-assistant", "config"), "/config", "Config")],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
      networkMode: "host",
    },
  }),
  createApp({
    id: "node-red",
    name: "Node-RED",
    description: "Editor visual low-code para automatización, IoT y flujos de integración.",
    icon: "/assets/icons/node-red.svg",
    image: "nodered/node-red:latest",
    category: "Automation",
    source: "local",
    developer: "OpenJS Foundation",
    defaultConfig: {
      ports: [port("1880", "1880", "Web UI")],
      volumes: [volume(appDataPath("node-red", "data"), "/data", "Flows")],
      env: [envVar("TZ", DEFAULT_TZ, "Timezone")],
    },
  }),
  withUserMapping(
    "lidarr",
    "linuxserver/lidarr:latest",
    "Lidarr",
    "Gestor automático de música y álbumes para completar el stack multimedia.",
    "Download",
    "/assets/icons/lidarr.svg",
    "LinuxServer.io",
    {
      ports: [port("8686", "8686", "Web UI")],
      volumes: [
        volume(appDataPath("lidarr", "config"), "/config", "Config"),
        volume(sharedDataPath("media", "music"), "/music", "Music library"),
        volume(sharedDataPath("downloads"), "/downloads", "Downloads"),
      ],
      env: [],
    },
  ),
  withUserMapping(
    "bazarr",
    "linuxserver/bazarr:latest",
    "Bazarr",
    "Gestión de subtítulos automática para bibliotecas de series y películas.",
    "Media",
    "/assets/icons/bazarr.svg",
    "LinuxServer.io",
    {
      ports: [port("6767", "6767", "Web UI")],
      volumes: [
        volume(appDataPath("bazarr", "config"), "/config", "Config"),
        volume(sharedDataPath("media", "movies"), "/movies", "Movies"),
        volume(sharedDataPath("media", "tv"), "/tv", "TV Shows"),
      ],
      env: [],
    },
  ),
  withUserMapping(
    "syncthing",
    "linuxserver/syncthing:latest",
    "Syncthing",
    "Sincronización P2P de carpetas entre dispositivos sin nube central.",
    "Storage",
    "/assets/icons/syncthing.svg",
    "LinuxServer.io",
    {
      ports: [
        port("8384", "8384", "Web UI"),
        port("22000", "22000", "Sync TCP"),
        port("22000", "22000", "Sync UDP", "udp"),
        port("21027", "21027", "Discovery", "udp"),
      ],
      volumes: [
        volume(appDataPath("syncthing", "config"), "/config", "Config"),
        volume(sharedDataPath("sync"), "/data", "Data"),
      ],
      env: [],
    },
  ),
  createApp({
    id: "paperless-ngx",
    name: "Paperless-ngx",
    description: "Gestor documental para escanear, indexar y buscar facturas y documentos.",
    icon: "/assets/icons/paperless-ngx.svg",
    image: "ghcr.io/paperless-ngx/paperless-ngx:latest",
    category: "Productivity",
    source: "local",
    developer: "Paperless-ngx",
    defaultConfig: {
      ports: [port("8000", "8000", "Web UI")],
      volumes: [
        volume(appDataPath("paperless-ngx", "data"), "/usr/src/paperless/data", "Data"),
        volume(appDataPath("paperless-ngx", "media"), "/usr/src/paperless/media", "Media"),
        volume(appDataPath("paperless-ngx", "export"), "/usr/src/paperless/export", "Export"),
        volume(appDataPath("paperless-ngx", "consume"), "/usr/src/paperless/consume", "Consume"),
      ],
      env: [
        envVar("TZ", DEFAULT_TZ, "Timezone"),
        envVar("PAPERLESS_URL", "http://localhost:8000", "Base URL"),
      ],
    },
  }),
];
