import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { io } from "../index.js";
import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { getContainers } from "./docker.service.js";
import { NotificationService } from "./notification.service.js";
import { appInventory, type AppInventoryItem } from "../data/appInventory.js";

const execAsync = promisify(exec);
const log = logger.child("store-service");

const CASAOS_REPO_API = "https://api.github.com/repos/IceWhaleTech/CasaOS-AppStore/contents/Apps";
const CASAOS_RAW_BASE = "https://raw.githubusercontent.com/IceWhaleTech/CasaOS-AppStore/main/Apps";
const STORE_CACHE_DIR = path.join(config.paths.data, "store-cache");
const STORE_CACHE_FILE = path.join(STORE_CACHE_DIR, "casaos-catalog.json");
const STORE_MANIFEST_DIR = path.join(config.paths.data, "store-manifests");
const CASAOS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CASAOS_FETCH_CONCURRENCY = 12;
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "HomePiNAS-AppStore/1.0",
};

type GitHubContentEntry = {
  name: string;
  type: string;
};

type CasaOsCatalogCache = {
  updatedAt: number;
  apps: AppInventoryItem[];
};

let inMemoryCasaOsCatalog: CasaOsCatalogCache | null = null;

function normalizeAppId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapCategory(category: string | undefined): string {
  if (!category) {
    return "Tools";
  }

  const normalized = category.trim();
  if (!normalized) {
    return "Tools";
  }

  return normalized;
}

function parseLocalizedField(block: string, fieldName: string): string | null {
  const fieldPattern = new RegExp(`\\n\\s+${fieldName}:\\s*\\n([\\s\\S]*?)(?=\\n\\s+[a-zA-Z0-9_]+:\\s|$)`, "i");
  const match = block.match(fieldPattern);

  if (!match) {
    return null;
  }

  const localizedBlock = match[1] ?? "";
  const preferredLines = localizedBlock
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const localeKey of ["en_US:", "en_us:", "en_GB:"]) {
    const localized = preferredLines.find((line) => line.startsWith(localeKey));
    if (localized) {
      return localized.slice(localeKey.length).trim().replace(/^["']|["']$/g, "");
    }
  }

  const generic = preferredLines[0];
  if (!generic) {
    return null;
  }

  const value = generic.includes(":") ? generic.split(":").slice(1).join(":") : generic;
  return value.trim().replace(/^["']|["']$/g, "");
}

function parsePortMappings(composeContent: string): string[] {
  const inlinePortMap = composeContent.match(/\n\s+port_map:\s*['"]?([^'"\n]+)['"]?/i);
  if (inlinePortMap?.[1]) {
    return inlinePortMap[1]
      .split(/[,|]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => `${value}:${value}`);
  }

  const portMatches = Array.from(
    composeContent.matchAll(/\n\s+published:\s*["']?([^"'\n]+)["']?[\s\S]*?\n\s+target:\s*["']?([^"'\n]+)["']?/gi),
  );

  return portMatches
    .map((match) => {
      const published = match[1]?.trim();
      const target = match[2]?.trim();
      return published && target ? `${published}:${target}` : null;
    })
    .filter((value): value is string => Boolean(value));
}

function parseCasaOsCompose(appFolder: string, composeContent: string): AppInventoryItem | null {
  const title =
    composeContent.match(/\n\s+title:\s*\n[\s\S]*?\n\s+en_us:\s*([^\n]+)/i)?.[1]?.trim() ??
    composeContent.match(/\n\s+title:\s*\n[\s\S]*?\n\s+en_US:\s*([^\n]+)/i)?.[1]?.trim() ??
    appFolder;

  const description =
    parseLocalizedField(composeContent, "tagline") ??
    parseLocalizedField(composeContent, "description") ??
    `Aplicación importada desde CasaOS AppStore: ${title}`;

  const icon =
    composeContent.match(/\n\s+icon:\s*([^\n]+)/i)?.[1]?.trim() ??
    "Package";

  const category = mapCategory(composeContent.match(/\n\s+category:\s*([^\n]+)/i)?.[1]?.trim());
  const image = composeContent.match(/\n\s+image:\s*([^\n]+)/i)?.[1]?.trim();
  const developer = composeContent.match(/\n\s+developer:\s*([^\n]+)/i)?.[1]?.trim();
  const ports = parsePortMappings(composeContent);

  if (!title || !image) {
    return null;
  }

  const parsedApp: AppInventoryItem = {
    id: normalizeAppId(appFolder),
    name: title.replace(/^["']|["']$/g, ""),
    description,
    icon: icon.replace(/^["']|["']$/g, ""),
    image: image.replace(/^["']|["']$/g, ""),
    category,
    ports,
    source: "casaos",
    composeUrl: `${CASAOS_RAW_BASE}/${encodeURIComponent(appFolder)}/docker-compose.yml`,
  };

  if (developer) {
    parsedApp.developer = developer;
  }

  return parsedApp;
}

async function readCasaOsCache(): Promise<CasaOsCatalogCache | null> {
  try {
    const cacheContent = await fs.readFile(STORE_CACHE_FILE, "utf8");
    return JSON.parse(cacheContent) as CasaOsCatalogCache;
  } catch {
    return null;
  }
}

async function writeCasaOsCache(apps: AppInventoryItem[]): Promise<void> {
  await fs.mkdir(STORE_CACHE_DIR, { recursive: true });
  await fs.writeFile(
    STORE_CACHE_FILE,
    JSON.stringify(
      {
        updatedAt: Date.now(),
        apps,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: GITHUB_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`GitHub respondió ${response.status} al consultar ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: GITHUB_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`GitHub respondió ${response.status} al descargar ${url}`);
  }

  return response.text();
}

async function fetchCasaOsCatalogFromRemote(): Promise<AppInventoryItem[]> {
  const entries = await fetchJson<GitHubContentEntry[]>(CASAOS_REPO_API);
  const appFolders = entries.filter((entry) => entry.type === "dir").map((entry) => entry.name);
  const results: AppInventoryItem[] = [];

  for (let index = 0; index < appFolders.length; index += CASAOS_FETCH_CONCURRENCY) {
    const batch = appFolders.slice(index, index + CASAOS_FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (folderName) => {
        try {
          const composeUrl = `${CASAOS_RAW_BASE}/${encodeURIComponent(folderName)}/docker-compose.yml`;
          const composeContent = await fetchText(composeUrl);
          return parseCasaOsCompose(folderName, composeContent);
        } catch (error) {
          log.warn(`No se pudo importar ${folderName} desde CasaOS: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      }),
    );

    results.push(...batchResults.filter((item): item is AppInventoryItem => Boolean(item)));
  }

  return results.sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
}

function transformCasaOsComposePaths(composeContent: string, appId: string): string {
  const appDataPath = path.join(config.storage.basePath, "appdata", appId).replace(/\\/g, "/");
  const storageBasePath = config.storage.basePath.replace(/\\/g, "/").replace(/\/$/, "");

  let transformed = composeContent.replace(
    /\/DATA\/AppData\/[^/\s"']+([^\n"']*)/g,
    (_match, suffix: string) => `${appDataPath}${suffix ?? ""}`,
  );

  transformed = transformed.replace(/\/DATA(\/[^\s"']*)?/g, (_match, suffix: string) => `${storageBasePath}${suffix ?? ""}`);
  return transformed;
}

async function ensureDockerComposeAvailable(): Promise<void> {
  try {
    await execAsync("docker compose version");
  } catch {
    throw new Error("Docker Compose no está disponible. Instálalo o actualiza Docker.");
  }
}

export const StoreService = {
  async getCasaOsCatalog(): Promise<AppInventoryItem[]> {
    const now = Date.now();

    if (inMemoryCasaOsCatalog && now - inMemoryCasaOsCatalog.updatedAt < CASAOS_CACHE_TTL_MS) {
      return inMemoryCasaOsCatalog.apps;
    }

    const diskCache = await readCasaOsCache();
    if (diskCache && now - diskCache.updatedAt < CASAOS_CACHE_TTL_MS) {
      inMemoryCasaOsCatalog = diskCache;
      return diskCache.apps;
    }

    try {
      const remoteApps = await fetchCasaOsCatalogFromRemote();
      await writeCasaOsCache(remoteApps);
      inMemoryCasaOsCatalog = {
        updatedAt: Date.now(),
        apps: remoteApps,
      };
      return remoteApps;
    } catch (error) {
      log.warn(`No se pudo sincronizar CasaOS AppStore: ${error instanceof Error ? error.message : String(error)}`);

      if (diskCache) {
        inMemoryCasaOsCatalog = diskCache;
        return diskCache.apps;
      }

      return [];
    }
  },

  async getCatalog(): Promise<AppInventoryItem[]> {
    try {
      const now = Date.now();
      
      // Intentar obtener de memoria o disco (Caché rápido)
      let casaOsApps: AppInventoryItem[] = [];
      try {
        const diskCache = await readCasaOsCache();
        casaOsApps = (inMemoryCasaOsCatalog && now - inMemoryCasaOsCatalog.updatedAt < CASAOS_CACHE_TTL_MS)
          ? inMemoryCasaOsCatalog.apps
          : (diskCache && now - diskCache.updatedAt < CASAOS_CACHE_TTL_MS)
            ? diskCache.apps
            : [];

        // Si no hay caché de CasaOS o está expirada, disparamos una sincronización en segundo plano
        if (casaOsApps.length === 0 || (inMemoryCasaOsCatalog && now - inMemoryCasaOsCatalog.updatedAt > CASAOS_CACHE_TTL_MS)) {
          log.info("Iniciando sincronización de AppStore en segundo plano...");
          this.getCasaOsCatalog().catch(err => log.warn("Error en sync de Store (background):", err.message));
        }
      } catch (e: any) {
        log.warn(`Error accediendo a caché de CasaOS: ${e?.message || e}`);
      }



      const merged = new Map<string, AppInventoryItem>();

      // Combinar inventario local (siempre disponible) con lo que tengamos de CasaOS
      for (const app of [...appInventory, ...casaOsApps]) {
        merged.set(app.id, app);
      }

      return Array.from(merged.values()).sort((left, right) =>
        left.name.localeCompare(right.name, "es", { sensitivity: "base" }),
      );
    } catch (error: any) {
      log.errorWithStack("Error obteniendo catálogo", error);
      // Fallback extremo: devolver solo lo local
      return [...appInventory];
    }
  },


  async getInstalledStatus(): Promise<string[]> {
    try {
      const containers = await getContainers();
      return containers.map((container) => {
        const name = container.name || "";
        return name.toLowerCase().replace(/^\//, "");
      });
    } catch (error: any) {
      log.warn("Error verificando estado de instalación:", error.message);
      return [];
    }
  },

  async validateAppExists(appId: string): Promise<AppInventoryItem | null> {
    if (!appId || typeof appId !== "string") return null;
    if (!/^[a-zA-Z0-9_\-]{2,64}$/.test(appId)) return null;

    const catalog = await this.getCatalog();
    const app = catalog.find((catalogApp) => catalogApp.id === appId);
    return app || null;
  },

  async deployLocalApp(app: AppInventoryItem): Promise<void> {
    if (!app.image) {
      throw new Error(`La aplicación ${app.name} no tiene imagen Docker configurada`);
    }

    const appDataPath = path.join(config.storage.basePath, "appdata", app.id);

    await fs.mkdir(appDataPath, { recursive: true });

    try {
      const { stdout } = await execAsync(`docker ps -a --filter "name=${app.id}" --format "{{.Names}}"`);
      if (stdout.includes(app.id)) {
        throw new Error(`El contenedor '${app.id}' ya existe. Usa docker rm para eliminarlo.`);
      }
    } catch (error: any) {
      if (error.message.includes("ya existe")) {
        throw error;
      }
      log.warn("No se pudo verificar contenedores existentes:", error.message);
    }

    const portMapping = (app.ports || []).map((port) => `-p ${port}`).join(" ");
    const envMapping = Object.entries(app.env || {})
      .map(([key, value]) => `-e "${key}=${String(value).replace(/"/g, '\\"')}"`)
      .join(" ");

    const dockerCmd = [
      "docker run -d",
      `--name ${app.id}`,
      "--restart unless-stopped",
      `--volume "${appDataPath}:/config"`,
      "-e PUID=1000",
      "-e PGID=1000",
      portMapping,
      envMapping,
      app.image,
    ]
      .filter(Boolean)
      .join(" ");

    await new Promise<void>((resolve, reject) => {
      const child = spawn(dockerCmd, [], { shell: true });
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        const line = data.toString();
        io.emit(`app:install:log:${app.id}`, { stream: "stdout", text: line });
      });

      child.stderr?.on("data", (data: Buffer) => {
        const line = data.toString();
        stderr += line;
        io.emit(`app:install:log:${app.id}`, { stream: "stderr", text: line });
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `Docker salió con código ${code}`));
      });

      child.on("error", (error: Error) => {
        reject(new Error(`Error al ejecutar Docker: ${error.message}`));
      });
    });
  },

  async deployCasaOsApp(app: AppInventoryItem): Promise<void> {
    if (!app.composeUrl) {
      throw new Error(`La aplicación ${app.name} no tiene manifiesto compose disponible`);
    }

    await ensureDockerComposeAvailable();

    const manifestDir = path.join(STORE_MANIFEST_DIR, app.id);
    const manifestPath = path.join(manifestDir, "docker-compose.yml");

    await fs.mkdir(manifestDir, { recursive: true });
    await fs.mkdir(path.join(config.storage.basePath, "appdata", app.id), { recursive: true });

    const composeContent = await fetchText(app.composeUrl);
    const transformedCompose = transformCasaOsComposePaths(composeContent, app.id);

    await fs.writeFile(manifestPath, transformedCompose, "utf8");

    await new Promise<void>((resolve, reject) => {
      const child = spawn("docker", ["compose", "-f", manifestPath, "up", "-d"], {
        cwd: manifestDir,
        shell: true,
      });

      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        const line = data.toString();
        io.emit(`app:install:log:${app.id}`, { stream: "stdout", text: line });
      });

      child.stderr?.on("data", (data: Buffer) => {
        const line = data.toString();
        stderr += line;
        io.emit(`app:install:log:${app.id}`, { stream: "stderr", text: line });
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `docker compose salió con código ${code}`));
      });

      child.on("error", (error: Error) => {
        reject(new Error(`Error ejecutando docker compose: ${error.message}`));
      });
    });
  },

  async deployApp(appId: string): Promise<void> {
    const app = await this.validateAppExists(appId);
    if (!app) {
      throw new Error(`Aplicación ${appId} no encontrada en el catálogo`);
    }

    log.info(`Iniciando despliegue de: ${app.name} (${app.id})`);

    try {
      await execAsync("docker ps --no-trunc");
    } catch {
      throw new Error("Docker no está disponible o no se puede acceder al socket");
    }

    try {
      if (app.source === "casaos") {
        await this.deployCasaOsApp(app);
      } else {
        await this.deployLocalApp(app);
      }

      log.info(`✅ ${app.name} desplegado correctamente`);

      await NotificationService.sendAlert(
        `🚀 INSTALACIÓN COMPLETADA\n\nLa aplicación <b>${app.name}</b> se ha desplegado correctamente y ya está en ejecución.`,
        "INFO",
      );
    } catch (error: any) {
      log.errorWithStack(`Error desplegando ${appId}`, error);

      try {
        await NotificationService.sendAlert(
          `❌ INSTALACIÓN FALLIDA\n\nHubo un error instalando <b>${app.name}</b>:\n\n${error.message}`,
          "WARNING",
        );
      } catch {
        // Ignorar errores de notificación
      }

      throw error;
    }
  },

  async installApp(appId: string): Promise<void> {
    return this.deployApp(appId);
  },
};
