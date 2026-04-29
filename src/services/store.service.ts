import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { io } from "../index.js";
import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { getContainers } from "./docker.service.js";
import { NotificationService } from "./notification.service.js";
import {
  appInventory,
  type AppEnvVar,
  type AppInventoryItem,
  type AppPortMapping,
  type AppVolumeMapping,
} from "../data/appInventory.js";

const execAsync = promisify(exec);
const log = logger.child("store-service");

const STORE_MANIFEST_DIR = path.join(config.paths.data, "store-manifests");
const CUSTOM_APPS_FILE = path.join(config.paths.data, "store-custom-apps.json");

export interface InstallAppPayload {
  id?: string;
  name?: string;
  image?: string;
  ports?: AppPortMapping[];
  volumes?: AppVolumeMapping[];
  env?: AppEnvVar[];
  networkMode?: string;
  privileged?: boolean;
  capAdd?: string[];
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function sanitizePorts(ports: AppPortMapping[] | undefined): AppPortMapping[] {
  return ensureArray(ports)
    .map((port) => ({
      host: String(port.host ?? "").trim(),
      container: String(port.container ?? "").trim(),
      protocol: (port.protocol === "udp" ? "udp" : "tcp") as "tcp" | "udp",
      label: typeof port.label === "string" ? port.label.trim() : "",
    }))
    .filter((port) => port.host && port.container);
}

function sanitizeVolumes(volumes: AppVolumeMapping[] | undefined): AppVolumeMapping[] {
  return ensureArray(volumes)
    .map((volume) => ({
      host: String(volume.host ?? "").trim(),
      container: String(volume.container ?? "").trim(),
      label: typeof volume.label === "string" ? volume.label.trim() : "",
    }))
    .filter((volume) => volume.host && volume.container);
}

function sanitizeEnv(env: AppEnvVar[] | undefined): AppEnvVar[] {
  return ensureArray(env)
    .map((item) => ({
      key: String(item.key ?? "").trim(),
      value: String(item.value ?? ""),
      label: typeof item.label === "string" ? item.label.trim() : "",
    }))
    .filter((item) => item.key);
}

function sanitizeAppInput(input: Partial<AppInventoryItem>, source: "local" | "custom"): AppInventoryItem {
  const id = normalizeId(String(input.id ?? ""));
  const name = String(input.name ?? "").trim();
  const image = String(input.image ?? "").trim();

  if (!id) {
    throw new Error("El identificador de la app es obligatorio.");
  }
  if (!name) {
    throw new Error("El nombre de la app es obligatorio.");
  }
  if (!image) {
    throw new Error("La imagen Docker es obligatoria.");
  }

  const app: AppInventoryItem = {
    id,
    name,
    description: String(input.description ?? "").trim(),
    icon: String(input.icon ?? "Package").trim() || "Package",
    image,
    category: String(input.category ?? "General").trim() || "General",
    source,
    ports: sanitizePorts(input.ports),
    volumes: sanitizeVolumes(input.volumes),
    env: sanitizeEnv(input.env),
    privileged: Boolean(input.privileged),
    capAdd: ensureArray(input.capAdd).map((cap) => String(cap).trim()).filter(Boolean),
  };

  if (typeof input.developer === "string" && input.developer.trim()) {
    app.developer = input.developer.trim();
  }

  if (typeof input.networkMode === "string" && input.networkMode.trim()) {
    app.networkMode = input.networkMode.trim();
  }

  return app;
}

async function readCustomApps(): Promise<AppInventoryItem[]> {
  try {
    const raw = await fs.readFile(CUSTOM_APPS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((app) => sanitizeAppInput(app, "custom"));
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return [];
    }

    log.errorWithStack("Error leyendo el catálogo personalizado", error);
    return [];
  }
}

async function writeCustomApps(apps: AppInventoryItem[]): Promise<void> {
  await fs.mkdir(config.paths.data, { recursive: true });
  await fs.writeFile(CUSTOM_APPS_FILE, JSON.stringify(apps, null, 2), "utf-8");
}

async function ensureDockerComposeAvailable(): Promise<void> {
  try {
    await execAsync("docker compose version");
  } catch {
    throw new Error("Docker Compose no está disponible. Instálalo o actualiza Docker.");
  }
}

async function checkArchitectureCompatibility(image: string, appId: string): Promise<void> {
  const arch = process.arch;
  io.emit(`app:install:log:${appId}`, { stream: "stdout", text: `Verificando compatibilidad de la imagen ${image} con la arquitectura local (${arch})...\n` });

  try {
    const { stdout } = await execAsync(`docker manifest inspect ${image}`);
    const manifests = JSON.parse(stdout);

    let dockerArch: string = arch;
    if (arch === "x64") dockerArch = "amd64";
    if (arch === "arm64") dockerArch = "arm64";

    const isCompatible = (manifests.manifests || [manifests]).some((item: any) =>
      item.platform?.architecture?.includes?.(dockerArch),
    );

    if (!isCompatible) {
      const msg = `Advertencia: la imagen ${image} podría no soportar oficialmente la arquitectura ${arch}.\n`;
      io.emit(`app:install:log:${appId}`, { stream: "stderr", text: msg });
      log.warn(msg);
    } else {
      io.emit(`app:install:log:${appId}`, { stream: "stdout", text: `Imagen compatible con ${arch}.\n` });
    }
  } catch {
    io.emit(`app:install:log:${appId}`, { stream: "stdout", text: "No se pudo verificar la arquitectura de la imagen. Continuando...\n" });
  }
}

function mergeInstallConfig(app: AppInventoryItem, payload?: InstallAppPayload): AppInventoryItem {
  const nextApp: AppInventoryItem = {
    ...app,
    ports: payload?.ports ? sanitizePorts(payload.ports) : app.ports,
    volumes: payload?.volumes ? sanitizeVolumes(payload.volumes) : app.volumes,
    env: payload?.env ? sanitizeEnv(payload.env) : app.env,
  };

  const nextPrivileged = payload?.privileged ?? app.privileged;
  if (typeof nextPrivileged === "boolean") {
    nextApp.privileged = nextPrivileged;
  } else {
    delete nextApp.privileged;
  }

  const nextCapAdd = payload?.capAdd?.length ? payload.capAdd : app.capAdd;
  if (nextCapAdd && nextCapAdd.length > 0) {
    nextApp.capAdd = nextCapAdd;
  } else {
    delete nextApp.capAdd;
  }

  const nextNetworkMode = payload?.networkMode?.trim();
  if (nextNetworkMode) {
    nextApp.networkMode = nextNetworkMode;
  } else if (!nextNetworkMode && !app.networkMode) {
    delete nextApp.networkMode;
  }

  return nextApp;
}

function buildComposeContent(app: AppInventoryItem): string {
  const lines: string[] = [
    "services:",
    `  ${app.id}:`,
    `    image: ${app.image}`,
    `    container_name: ${app.id}`,
    "    restart: unless-stopped",
  ];

  if (app.networkMode) {
    lines.push(`    network_mode: ${app.networkMode}`);
  }

  if (app.privileged) {
    lines.push("    privileged: true");
  }

  if (app.capAdd && app.capAdd.length > 0) {
    lines.push("    cap_add:");
    for (const cap of app.capAdd) {
      lines.push(`      - ${cap}`);
    }
  }

  if (!app.networkMode && app.ports.length > 0) {
    lines.push("    ports:");
    for (const port of app.ports) {
      const suffix = port.protocol && port.protocol !== "tcp" ? `/${port.protocol}` : "";
      lines.push(`      - "${port.host}:${port.container}${suffix}"`);
    }
  }

  if (app.volumes.length > 0) {
    lines.push("    volumes:");
    for (const volume of app.volumes) {
      lines.push(`      - ${volume.host.replace(/\\/g, "/")}:${volume.container}`);
    }
  }

  if (app.env.length > 0) {
    lines.push("    environment:");
    for (const item of app.env) {
      lines.push(`      ${item.key}: "${item.value.replace(/"/g, '\\"')}"`);
    }
  }

  return lines.join("\n");
}

async function ensureVolumeDirectories(volumes: AppVolumeMapping[]): Promise<void> {
  for (const volume of volumes) {
    if (!volume.host.startsWith("/etc/") && !path.extname(volume.host)) {
      await fs.mkdir(volume.host, { recursive: true });
    }
  }
}

export const StoreService = {
  async getCatalog(): Promise<AppInventoryItem[]> {
    const customApps = await readCustomApps();
    return [...appInventory, ...customApps];
  },

  async getCustomApps(): Promise<AppInventoryItem[]> {
    return readCustomApps();
  },

  async createCustomApp(payload: Partial<AppInventoryItem>): Promise<AppInventoryItem> {
    const nextApp = sanitizeAppInput(payload, "custom");
    const customApps = await readCustomApps();

    if (customApps.some((app) => app.id === nextApp.id) || appInventory.some((app) => app.id === nextApp.id)) {
      throw new Error(`Ya existe una app con el id ${nextApp.id}.`);
    }

    customApps.push(nextApp);
    await writeCustomApps(customApps);
    return nextApp;
  },

  async updateCustomApp(appId: string, payload: Partial<AppInventoryItem>): Promise<AppInventoryItem> {
    const customApps = await readCustomApps();
    const index = customApps.findIndex((app) => app.id === appId);
    if (index === -1) {
      throw new Error("La app personalizada no existe.");
    }

    const current = customApps[index];
    const updated = sanitizeAppInput({ ...current, ...payload, id: appId }, "custom");
    customApps[index] = updated;
    await writeCustomApps(customApps);
    return updated;
  },

  async deleteCustomApp(appId: string): Promise<void> {
    const customApps = await readCustomApps();
    const filtered = customApps.filter((app) => app.id !== appId);
    if (filtered.length === customApps.length) {
      throw new Error("La app personalizada no existe.");
    }
    await writeCustomApps(filtered);
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
    const catalog = await this.getCatalog();
    return catalog.find((app) => app.id === appId) || null;
  },

  async generateAndDeployCompose(app: AppInventoryItem): Promise<void> {
    if (!app.image) {
      throw new Error(`La aplicación ${app.name} no tiene imagen Docker configurada.`);
    }

    await ensureDockerComposeAvailable();
    await checkArchitectureCompatibility(app.image, app.id);

    const manifestDir = path.join(STORE_MANIFEST_DIR, app.id);
    const manifestPath = path.join(manifestDir, "docker-compose.yml");

    await ensureVolumeDirectories(app.volumes);
    await fs.mkdir(manifestDir, { recursive: true });

    const composeContent = buildComposeContent(app);
    await fs.writeFile(manifestPath, composeContent, "utf8");

    io.emit(`app:install:log:${app.id}`, { stream: "stdout", text: `docker-compose.yml generado en ${manifestPath}\nArrancando servicio...\n` });

    await new Promise<void>((resolve, reject) => {
      const child = spawn("docker", ["compose", "-f", manifestPath, "up", "-d"], {
        cwd: manifestDir,
        shell: true,
      });

      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        io.emit(`app:install:log:${app.id}`, { stream: "stdout", text: data.toString() });
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

  async deployApp(appId: string, payload?: InstallAppPayload): Promise<void> {
    const app = await this.validateAppExists(appId);
    if (!app) {
      throw new Error(`Aplicación ${appId} no encontrada en el catálogo local.`);
    }

    const mergedApp = mergeInstallConfig(app, payload);
    log.info(`Iniciando despliegue dinámico de: ${mergedApp.name} (${mergedApp.id})`);

    try {
      await execAsync("docker ps --no-trunc");
    } catch {
      throw new Error("Docker no está disponible o el servicio NodeJS no tiene permisos de socket.");
    }

    try {
      await this.generateAndDeployCompose(mergedApp);

      await NotificationService.sendAlert(
        `Instalación completada\n\nLa aplicación <b>${mergedApp.name}</b> se ha desplegado correctamente.`,
        "INFO",
      );
    } catch (error: any) {
      log.errorWithStack(`Error desplegando ${appId}`, error);

      try {
        await NotificationService.sendAlert(
          `Instalación fallida\n\nHubo un error instalando <b>${mergedApp.name}</b>:\n\n${error.message}`,
          "WARNING",
        );
      } catch {
        // Ignorar errores secundarios de notificación
      }

      throw error;
    }
  },

  async installApp(appId: string, payload?: InstallAppPayload): Promise<void> {
    return this.deployApp(appId, payload);
  },
};
