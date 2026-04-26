export interface AppInventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  image?: string;
  category: string;
  ports: string[];
  env?: Record<string, string>;
  source: "local" | "casaos";
  composeUrl?: string;
  developer?: string;
}

export const appInventory: AppInventoryItem[] = [
  {
    id: "plex",
    name: "Plex Media Server",
    description: "Organiza tus bibliotecas de video, música y fotos para verlas en cualquier dispositivo.",
    icon: "Play",
    image: "linuxserver/plex:latest",
    category: "Media",
    ports: ["32400:32400"],
    source: "local",
  },
  {
    id: "pihole",
    name: "Pi-hole",
    description: "Bloqueador de publicidad a nivel de red para toda tu casa.",
    icon: "Shield",
    image: "pihole/pihole:latest",
    category: "Network",
    ports: ["53:53/udp", "53:53/tcp", "8081:80"],
    env: {
      TZ: "Europe/Madrid",
    },
    source: "local",
  },
  {
    id: "transmission",
    name: "Transmission",
    description: "Cliente BitTorrent ligero y potente con interfaz web.",
    icon: "Download",
    image: "linuxserver/transmission:latest",
    category: "Download",
    ports: ["9091:9091", "51413:51413"],
    source: "local",
  },
  {
    id: "threadfin",
    name: "Threadfin",
    description: "Proxy M3U para Plex/Emby/Jellyfin, sucesor de xTeVe.",
    icon: "Tv",
    image: "fgture/threadfin:latest",
    category: "Network",
    ports: ["34400:34400"],
    source: "local",
  },
  {
    id: "airdcpp",
    name: "AirDC++",
    description: "Cliente avanzado para redes Direct Connect, ideal para compartir archivos en LAN.",
    icon: "Share2",
    image: "gange666/airdcpp-webclient:latest",
    category: "Download",
    ports: ["21248:21248"],
    source: "local",
  },
  {
    id: "dispatcher",
    name: "Dispatcher",
    description: "Sistema de distribución de carga y gestión de colas ligero.",
    icon: "Terminal",
    image: "aleitner/dispatcher:latest",
    category: "Tools",
    ports: [],
    source: "local",
  },
  {
    id: "jackett",
    name: "Jackett",
    description: "Soporte de API para tus trackers de torrent favoritos.",
    icon: "Search",
    image: "linuxserver/jackett:latest",
    category: "Download",
    ports: ["9117:9117"],
    source: "local",
  },
  {
    id: "radarr",
    name: "Radarr",
    description: "Gestor de colecciones de películas para usuarios de BitTorrent y Usenet.",
    icon: "Film",
    image: "linuxserver/radarr:latest",
    category: "Media",
    ports: ["7878:7878"],
    source: "local",
  },
  {
    id: "sonarr",
    name: "Sonarr",
    description: "Gestor de colecciones de series de TV para usuarios de BitTorrent y Usenet.",
    icon: "Tv",
    image: "linuxserver/sonarr:latest",
    category: "Media",
    ports: ["8989:8989"],
    source: "local",
  },
];
