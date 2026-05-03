import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("docker-service");

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface DockerContainerDetails {
  container: DockerContainer;
  command: string;
  createdAt: string | null;
  mounts: Array<{ source: string; destination: string; mode: string }>;
  ports: string[];
  restartPolicy: string;
}

export interface DockerContainerStats {
  cpu: string;
  memory: string;
  memoryPercent: string;
  networkIO: string;
  blockIO: string;
  pids: string;
}

export interface RemoveContainerOptions {
  deleteData?: boolean;
}

function resolveAppDataPath(details: DockerContainerDetails): string | null {
  const appsRoot = path.join(config.storage.basePath, "apps");

  for (const mount of details.mounts) {
    const sourcePath = mount.source.trim();
    if (!sourcePath) {
      continue;
    }

    const normalizedSource = path.normalize(sourcePath);
    const relativeToAppsRoot = path.relative(appsRoot, normalizedSource);
    const isInsideAppsRoot = relativeToAppsRoot !== ""
      && !relativeToAppsRoot.startsWith("..")
      && !path.isAbsolute(relativeToAppsRoot);

    if (!isInsideAppsRoot) {
      continue;
    }

    const [appDirectory] = relativeToAppsRoot.split(path.sep);
    if (!appDirectory) {
      continue;
    }

    return path.join(appsRoot, appDirectory);
  }

  return null;
}

function buildDockerError(error: any): Error {
  const message = error?.stderr || error?.message || "Error de Docker desconocido.";
  if (message.includes("permission denied") || message.includes("acceso denegado")) {
    return new Error("Permisos denegados. El usuario actual no pertenece al grupo docker.");
  }
  if (message.includes("not found") || message.includes("no se reconoce") || error?.code === 127) {
    return new Error("El motor de Docker no esta instalado o no existe en el PATH del servidor.");
  }
  return new Error("No se pudo contactar con el demonio de Docker.");
}

function getMockContainers(): DockerContainer[] {
  return [
    { id: "e1234567890f", name: "Plex-Media-Server", image: "plexinc/pms:latest", state: "running", status: "Up 4 days" },
    { id: "a9876543210b", name: "Pi-hole", image: "pihole/pihole:latest", state: "running", status: "Up 2 weeks" },
    { id: "c5555555555d", name: "Home-Assistant", image: "homeassistant/home-assistant:latest", state: "running", status: "Up 2 hours" },
    { id: "f1111111111a", name: "Nextcloud-DB", image: "mariadb:10.5", state: "exited", status: "Exited (0) 5 days ago" },
  ];
}

export async function getContainers(): Promise<DockerContainer[]> {
  if (config.platform.isWindows) {
    return getMockContainers();
  }

  try {
    const { stdout } = await execAsync('docker ps -a --format "{{json .}}"');
    if (!stdout.trim()) {
      return [];
    }

    return stdout
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const raw = JSON.parse(line);
        return {
          id: raw.ID || raw.id,
          name: raw.Names || raw.name,
          image: raw.Image || raw.image,
          state: (raw.State || raw.state || "exited").toLowerCase(),
          status: raw.Status || raw.status,
        };
      });
  } catch (error: any) {
    log.errorWithStack("Error ejecutando CLI de Docker", error);
    throw buildDockerError(error);
  }
}

async function runDockerAction(command: string, errorMessage: string): Promise<void> {
  try {
    await execAsync(command);
  } catch (error: any) {
    log.errorWithStack(errorMessage, error);
    throw new Error(`${errorMessage}. Detalle: ${error.stderr || error.message}`);
  }
}

export async function startContainer(id: string): Promise<void> {
  await runDockerAction(`docker start ${id}`, `Fallo al iniciar el contenedor ${id}`);
}

export async function stopContainer(id: string): Promise<void> {
  await runDockerAction(`docker stop ${id}`, `Fallo al detener el contenedor ${id}`);
}

export async function restartContainer(id: string): Promise<void> {
  await runDockerAction(`docker restart ${id}`, `Fallo al reiniciar el contenedor ${id}`);
}

export async function removeContainer(id: string, options: RemoveContainerOptions = {}): Promise<void> {
  const { deleteData = false } = options;

  if (config.platform.isWindows) {
    return;
  }

  const details = await getContainerDetails(id);

  try {
    if (details.container.state === "running") {
      await execAsync(`docker stop ${id}`);
    }

    await execAsync(`docker rm ${id}`);

    if (deleteData) {
      const dataPath = resolveAppDataPath(details);
      if (!dataPath) {
        throw new Error(`No se encontró una carpeta de datos de app asociada al contenedor ${details.container.name}.`);
      }
      await fs.rm(dataPath, { recursive: true, force: true });
    }
  } catch (error: any) {
    log.errorWithStack(`Error eliminando el contenedor ${id}`, error);
    throw new Error(`No se pudo eliminar el contenedor ${details.container.name}. Detalle: ${error.stderr || error.message}`);
  }
}

export async function getContainerLogs(id: string, tail = 120): Promise<string[]> {
  if (config.platform.isWindows) {
    return [
      `[mock:${id}] Boot sequence completed`,
      `[mock:${id}] Healthcheck OK`,
      `[mock:${id}] Waiting for incoming connections`,
    ];
  }

  try {
    const { stdout, stderr } = await execAsync(`docker logs --tail ${tail} ${id}`);
    return `${stdout}\n${stderr}`
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .slice(-tail);
  } catch (error: any) {
    log.errorWithStack(`Error obteniendo logs del contenedor ${id}`, error);
    throw new Error(`No se pudieron recuperar los logs del contenedor ${id}.`);
  }
}

export async function getContainerStats(id: string): Promise<DockerContainerStats> {
  if (config.platform.isWindows) {
    return {
      cpu: "2.14%",
      memory: "312MiB / 2GiB",
      memoryPercent: "15.2%",
      networkIO: "32MB / 12MB",
      blockIO: "84MB / 16MB",
      pids: "19",
    };
  }

  try {
    const { stdout } = await execAsync(`docker stats ${id} --no-stream --format "{{json .}}"`);
    const raw = JSON.parse(stdout.trim());
    return {
      cpu: raw.CPUPerc ?? raw.CPU ?? "0%",
      memory: raw.MemUsage ?? raw.Memory ?? "N/A",
      memoryPercent: raw.MemPerc ?? "N/A",
      networkIO: raw.NetIO ?? "N/A",
      blockIO: raw.BlockIO ?? "N/A",
      pids: raw.PIDs ?? "N/A",
    };
  } catch (error: any) {
    log.errorWithStack(`Error obteniendo stats del contenedor ${id}`, error);
    throw new Error(`No se pudieron recuperar las metricas del contenedor ${id}.`);
  }
}

export async function getContainerDetails(id: string): Promise<DockerContainerDetails> {
  const containers = await getContainers();
  const container = containers.find((entry) => entry.id === id);
  if (!container) {
    throw new Error("Contenedor no encontrado.");
  }

  if (config.platform.isWindows) {
    return {
      container,
      command: "docker-entrypoint.sh",
      createdAt: new Date().toISOString(),
      mounts: [
        { source: "C:\\mock\\config", destination: "/config", mode: "rw" },
        { source: "C:\\mock\\data", destination: "/data", mode: "rw" },
      ],
      ports: ["8080->80/tcp", "8443->443/tcp"],
      restartPolicy: "unless-stopped",
    };
  }

  try {
    const { stdout } = await execAsync(`docker inspect ${id}`);
    const parsed = JSON.parse(stdout);
    const raw = parsed[0];
    return {
      container,
      command: Array.isArray(raw.Config?.Cmd) ? raw.Config.Cmd.join(" ") : raw.Path || "",
      createdAt: raw.Created ?? null,
      mounts: (raw.Mounts ?? []).map((mount: any) => ({
        source: mount.Source ?? "",
        destination: mount.Destination ?? "",
        mode: mount.Mode ?? "",
      })),
      ports: Object.entries(raw.NetworkSettings?.Ports ?? {}).flatMap(([containerPort, bindings]) => {
        if (!Array.isArray(bindings) || bindings.length === 0) {
          return [containerPort];
        }
        return bindings.map((binding: any) => `${binding.HostPort}->${containerPort}`);
      }),
      restartPolicy: raw.HostConfig?.RestartPolicy?.Name || "no",
    };
  } catch (error: any) {
    log.errorWithStack(`Error inspeccionando el contenedor ${id}`, error);
    throw new Error(`No se pudo inspeccionar el contenedor ${id}.`);
  }
}
