export interface AppPortMapping {
  host: string;
  container: string;
  protocol?: "tcp" | "udp";
  label?: string;
}

export interface AppVolumeMapping {
  host: string;
  container: string;
  label?: string;
}

export interface AppEnvVar {
  key: string;
  value: string;
  label?: string;
}

export interface AppInventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  image?: string;
  category: string;
  source: "local" | "custom";
  developer?: string;
  ports: AppPortMapping[];
  volumes: AppVolumeMapping[];
  env: AppEnvVar[];
  networkMode?: string;
  privileged?: boolean;
  capAdd?: string[];
}

function configVolume(appId: string, suffix = "config", label = "Config"): AppVolumeMapping {
  return {
    host: `/opt/homevault/${appId}/${suffix}`,
    container: suffix === "config" ? "/config" : `/${suffix}`,
    label,
  };
}

export const appInventory: AppInventoryItem[] = [
  {
    id: "plex",
    name: "Plex Media Server",
    description: "Stream your personal media library anywhere: movies, TV, music and photos.",
    icon: "Play",
    image: "plexinc/pms-docker:latest",
    category: "Media",
    source: "local",
    developer: "Plex",
    ports: [{ host: "32400", container: "32400", label: "Web UI" }],
    volumes: [
      { host: "/opt/homevault/plex/config", container: "/config", label: "Config" },
      { host: "/opt/homevault/plex/transcode", container: "/transcode", label: "Transcode temp" },
      { host: "/mnt/storage/media", container: "/data", label: "Media library" },
    ],
    env: [
      { key: "TZ", value: "Europe/Madrid", label: "Timezone" },
      { key: "PLEX_CLAIM", value: "", label: "Plex Claim Token (optional)" },
    ],
  },
  {
    id: "jellyfin",
    name: "Jellyfin",
    description: "Free software media system, the volunteer-built alternative to Plex.",
    icon: "Tv",
    image: "jellyfin/jellyfin:latest",
    category: "Media",
    source: "local",
    developer: "Jellyfin",
    ports: [{ host: "8096", container: "8096", label: "Web UI" }],
    volumes: [
      { host: "/opt/homevault/jellyfin/config", container: "/config", label: "Config" },
      { host: "/opt/homevault/jellyfin/cache", container: "/cache", label: "Cache" },
      { host: "/mnt/storage/media", container: "/media", label: "Media library" },
    ],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "immich",
    name: "Immich",
    description: "High-performance self-hosted photo and video management with mobile backup support.",
    icon: "Image",
    image: "ghcr.io/immich-app/immich-server:release",
    category: "Media",
    source: "local",
    developer: "Immich",
    ports: [{ host: "2283", container: "2283", label: "Web UI" }],
    volumes: [
      { host: "/opt/homevault/immich/upload", container: "/usr/src/app/upload", label: "Upload library" },
      { host: "/etc/localtime", container: "/etc/localtime", label: "Localtime" },
    ],
    env: [
      { key: "TZ", value: "Europe/Madrid", label: "Timezone" },
      { key: "DB_HOSTNAME", value: "", label: "PostgreSQL host" },
      { key: "DB_USERNAME", value: "", label: "PostgreSQL user" },
      { key: "DB_PASSWORD", value: "", label: "PostgreSQL password" },
      { key: "DB_DATABASE_NAME", value: "immich", label: "Database name" },
      { key: "REDIS_HOSTNAME", value: "", label: "Redis host" },
    ],
  },
  {
    id: "qbittorrent",
    name: "qBittorrent",
    description: "Open-source BitTorrent client with a clean web interface.",
    icon: "Download",
    image: "lscr.io/linuxserver/qbittorrent:latest",
    category: "Download",
    source: "local",
    developer: "LinuxServer.io",
    ports: [
      { host: "8080", container: "8080", label: "Web UI" },
      { host: "6881", container: "6881", label: "Torrent TCP" },
      { host: "6881", container: "6881", protocol: "udp", label: "Torrent UDP" },
    ],
    volumes: [
      { host: "/opt/homevault/qbittorrent/config", container: "/config", label: "Config" },
      { host: "/mnt/storage/downloads", container: "/downloads", label: "Downloads" },
    ],
    env: [
      { key: "TZ", value: "Europe/Madrid", label: "Timezone" },
      { key: "WEBUI_PORT", value: "8080", label: "Web UI Port" },
    ],
  },
  {
    id: "sonarr",
    name: "Sonarr",
    description: "Smart PVR for newsgroup and bittorrent users that automates TV show downloads.",
    icon: "Tv",
    image: "lscr.io/linuxserver/sonarr:latest",
    category: "Download",
    source: "local",
    developer: "LinuxServer.io",
    ports: [{ host: "8989", container: "8989", label: "Web UI" }],
    volumes: [
      { host: "/opt/homevault/sonarr/config", container: "/config", label: "Config" },
      { host: "/mnt/storage/tv", container: "/tv", label: "TV library" },
      { host: "/mnt/storage/downloads", container: "/downloads", label: "Downloads" },
    ],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "radarr",
    name: "Radarr",
    description: "Movie collection manager and automatic downloader.",
    icon: "Film",
    image: "lscr.io/linuxserver/radarr:latest",
    category: "Download",
    source: "local",
    developer: "LinuxServer.io",
    ports: [{ host: "7878", container: "7878", label: "Web UI" }],
    volumes: [
      { host: "/opt/homevault/radarr/config", container: "/config", label: "Config" },
      { host: "/mnt/storage/movies", container: "/movies", label: "Movie library" },
      { host: "/mnt/storage/downloads", container: "/downloads", label: "Downloads" },
    ],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "prowlarr",
    name: "Prowlarr",
    description: "Indexer manager and proxy for Sonarr, Radarr and related media apps.",
    icon: "Search",
    image: "lscr.io/linuxserver/prowlarr:latest",
    category: "Download",
    source: "local",
    developer: "LinuxServer.io",
    ports: [{ host: "9696", container: "9696", label: "Web UI" }],
    volumes: [configVolume("prowlarr")],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "overseerr",
    name: "Overseerr",
    description: "Request management and media discovery tool for Plex and Jellyfin setups.",
    icon: "Globe",
    image: "lscr.io/linuxserver/overseerr:latest",
    category: "Media",
    source: "local",
    developer: "LinuxServer.io",
    ports: [{ host: "5055", container: "5055", label: "Web UI" }],
    volumes: [configVolume("overseerr")],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "nextcloud",
    name: "Nextcloud",
    description: "Self-hosted cloud storage and collaboration platform.",
    icon: "Cloud",
    image: "nextcloud:latest",
    category: "Storage",
    source: "local",
    developer: "Nextcloud",
    ports: [{ host: "8082", container: "80", label: "Web UI" }],
    volumes: [
      { host: "/opt/homevault/nextcloud/html", container: "/var/www/html", label: "App data" },
      { host: "/mnt/storage/cloud", container: "/var/www/html/data", label: "User data" },
    ],
    env: [
      { key: "TZ", value: "Europe/Madrid", label: "Timezone" },
      { key: "NEXTCLOUD_TRUSTED_DOMAINS", value: "", label: "Trusted domains" },
    ],
  },
  {
    id: "gitea",
    name: "Gitea",
    description: "Lightweight self-hosted Git service with a familiar GitHub-like interface.",
    icon: "GitBranch",
    image: "gitea/gitea:latest",
    category: "Development",
    source: "local",
    developer: "Gitea",
    ports: [
      { host: "3001", container: "3000", label: "Web UI" },
      { host: "2222", container: "22", label: "SSH" },
    ],
    volumes: [{ host: "/opt/homevault/gitea/data", container: "/data", label: "Data" }],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "pihole",
    name: "Pi-hole",
    description: "Network-wide ad blocking via your own DNS server.",
    icon: "Shield",
    image: "pihole/pihole:latest",
    category: "Networking",
    source: "local",
    developer: "Pi-hole",
    ports: [
      { host: "8081", container: "80", label: "Web UI" },
      { host: "53", container: "53", protocol: "tcp", label: "DNS TCP" },
      { host: "53", container: "53", protocol: "udp", label: "DNS UDP" },
    ],
    volumes: [
      { host: "/opt/homevault/pihole/etc-pihole", container: "/etc/pihole", label: "Pi-hole config" },
      { host: "/opt/homevault/pihole/etc-dnsmasq.d", container: "/etc/dnsmasq.d", label: "DNSMasq config" },
    ],
    env: [
      { key: "TZ", value: "Europe/Madrid", label: "Timezone" },
      { key: "WEBPASSWORD", value: "", label: "Web password" },
    ],
  },
  {
    id: "nginx-proxy-manager",
    name: "Nginx Proxy Manager",
    description: "Expose your services easily with SSL certificates and a friendly UI.",
    icon: "ShieldCheck",
    image: "jc21/nginx-proxy-manager:latest",
    category: "Networking",
    source: "local",
    developer: "Nginx Proxy Manager",
    ports: [
      { host: "81", container: "81", label: "Admin UI" },
      { host: "80", container: "80", label: "HTTP" },
      { host: "443", container: "443", label: "HTTPS" },
    ],
    volumes: [
      { host: "/opt/homevault/nginx-proxy-manager/data", container: "/data", label: "Data" },
      { host: "/opt/homevault/nginx-proxy-manager/letsencrypt", container: "/etc/letsencrypt", label: "Let's Encrypt" },
    ],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "vaultwarden",
    name: "Vaultwarden",
    description: "Lightweight Bitwarden-compatible password manager server.",
    icon: "Lock",
    image: "vaultwarden/server:latest",
    category: "Security",
    source: "local",
    developer: "Vaultwarden",
    ports: [{ host: "8222", container: "80", label: "Web UI" }],
    volumes: [{ host: "/opt/homevault/vaultwarden/data", container: "/data", label: "Data" }],
    env: [
      { key: "TZ", value: "Europe/Madrid", label: "Timezone" },
      { key: "SIGNUPS_ALLOWED", value: "false", label: "Allow signups" },
    ],
  },
  {
    id: "portainer",
    name: "Portainer",
    description: "Universal container management GUI to manage Docker from a browser.",
    icon: "Boxes",
    image: "portainer/portainer-ce:latest",
    category: "Monitoring",
    source: "local",
    developer: "Portainer",
    ports: [{ host: "9000", container: "9000", label: "Web UI" }],
    volumes: [
      { host: "/var/run/docker.sock", container: "/var/run/docker.sock", label: "Docker socket" },
      { host: "/opt/homevault/portainer/data", container: "/data", label: "Data" },
    ],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "grafana",
    name: "Grafana",
    description: "Beautiful dashboards for metrics, logs and traces.",
    icon: "BarChart3",
    image: "grafana/grafana:latest",
    category: "Monitoring",
    source: "local",
    developer: "Grafana Labs",
    ports: [{ host: "3000", container: "3000", label: "Web UI" }],
    volumes: [{ host: "/opt/homevault/grafana/data", container: "/var/lib/grafana", label: "Data" }],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "influxdb",
    name: "InfluxDB",
    description: "Time series database designed for metrics, events and real-time analytics.",
    icon: "Database",
    image: "influxdb:2",
    category: "Monitoring",
    source: "local",
    developer: "InfluxData",
    ports: [{ host: "8086", container: "8086", label: "API / UI" }],
    volumes: [
      { host: "/opt/homevault/influxdb/data", container: "/var/lib/influxdb2", label: "Data" },
      { host: "/opt/homevault/influxdb/config", container: "/etc/influxdb2", label: "Config" },
    ],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
  {
    id: "home-assistant",
    name: "Home Assistant",
    description: "Open source home automation platform that puts local control and privacy first.",
    icon: "Home",
    image: "ghcr.io/home-assistant/home-assistant:stable",
    category: "Automation",
    source: "local",
    developer: "Home Assistant",
    ports: [{ host: "8123", container: "8123", label: "Web UI" }],
    volumes: [{ host: "/opt/homevault/home-assistant/config", container: "/config", label: "Config" }],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
    networkMode: "host",
  },
  {
    id: "node-red",
    name: "Node-RED",
    description: "Low-code programming for event-driven applications and IoT automation.",
    icon: "Workflow",
    image: "nodered/node-red:latest",
    category: "Automation",
    source: "local",
    developer: "OpenJS Foundation",
    ports: [{ host: "1880", container: "1880", label: "Web UI" }],
    volumes: [{ host: "/opt/homevault/node-red/data", container: "/data", label: "Flows" }],
    env: [{ key: "TZ", value: "Europe/Madrid", label: "Timezone" }],
  },
];
