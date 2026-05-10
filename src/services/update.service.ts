import { exec } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);
const log = logger.child("update-service");
const COMMAND_MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_BRANCH = process.env["HOMEVAULT_UPDATE_BRANCH"]?.trim() || "main";
const DEFAULT_SERVICE_NAME = process.env["HOMEVAULT_SERVICE_NAME"]?.trim() || "homevault";

interface UpdateCommandResult {
  logs: string;
  success: boolean;
  message: string;
  restartRequired?: boolean;
  rebootRequired?: boolean;
  error?: string;
}

interface UpdateCheckResult {
  available: boolean;
  latestVersion: string;
  currentVersion: string;
  localCommit?: string;
  remoteCommit?: string;
  repoUrl?: string;
  branch?: string;
}

function formatSection(title: string): string {
  return `\n[${title}]\n`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function getPackageVersion(): Promise<string> {
  try {
    const packageJsonPath = path.join(config.paths.root, "package.json");
    const packageJson = await readFile(packageJsonPath, "utf-8");
    const parsed = JSON.parse(packageJson) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
}

async function runCommand(command: string, title: string): Promise<string> {
  const { stdout, stderr } = await execAsync(command, {
    cwd: config.paths.root,
    maxBuffer: COMMAND_MAX_BUFFER,
  });

  const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  const body = output.length > 0 ? `${output}\n` : "Sin salida.\n";
  return `${formatSection(title)}$ ${command}\n${body}`;
}

async function captureFailure(command: string, title: string, error: unknown): Promise<string> {
  if (!(error instanceof Error)) {
    return `${formatSection(title)}$ ${command}\n${String(error)}\n`;
  }

  const stdout = "stdout" in error && typeof error.stdout === "string" ? error.stdout.trim() : "";
  const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
  const lines = [error.message, stdout, stderr].filter(Boolean).join("\n");

  return `${formatSection(title)}$ ${command}\n${lines || "Error desconocido"}\n`;
}

async function getRemoteRepoUrl(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd: config.paths.root,
      maxBuffer: COMMAND_MAX_BUFFER,
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function getLocalCommit(): Promise<string> {
  const { stdout } = await execAsync("git rev-parse HEAD", {
    cwd: config.paths.root,
    maxBuffer: COMMAND_MAX_BUFFER,
  });

  return stdout.trim();
}

async function getRemoteCommit(branch = DEFAULT_BRANCH): Promise<string> {
  const { stdout } = await execAsync(`git ls-remote --heads origin ${branch}`, {
    cwd: config.paths.root,
    maxBuffer: COMMAND_MAX_BUFFER,
  });

  return stdout.trim().split(/\s+/)[0] || "";
}

async function ensureCleanWorktree(): Promise<void> {
  const { stdout } = await execAsync("git status --porcelain", {
    cwd: config.paths.root,
    maxBuffer: COMMAND_MAX_BUFFER,
  });

  if (stdout.trim().length > 0) {
    throw new Error("Hay cambios locales sin confirmar. La auto-actualización no sobrescribe un árbol de trabajo sucio.");
  }
}

function getFailedCommand(error: unknown): string {
  if (error instanceof Error && "cmd" in error && typeof error.cmd === "string") {
    return error.cmd;
  }

  return "Comando no disponible";
}

function scheduleServiceRestart(serviceName: string): void {
  setTimeout(() => {
    exec(`sudo systemctl restart ${serviceName}.service`, (error) => {
      if (error) {
        log.error("No se pudo reiniciar el servicio tras la actualización", { error: error.message, serviceName });
      }
    });
  }, 4000);
}

export const UpdateService = {
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      const [localCommit, remoteCommit, repoUrl, currentVersion] = await Promise.all([
        getLocalCommit(),
        getRemoteCommit(),
        getRemoteRepoUrl(),
        getPackageVersion(),
      ]);

      const result: UpdateCheckResult = {
        available: Boolean(remoteCommit) && localCommit !== remoteCommit,
        latestVersion: remoteCommit ? remoteCommit.substring(0, 7) : currentVersion,
        currentVersion: localCommit ? localCommit.substring(0, 7) : currentVersion,
        localCommit,
        remoteCommit,
        branch: DEFAULT_BRANCH,
      };

      if (repoUrl) {
        result.repoUrl = repoUrl;
      }

      return result;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error("Error comprobando actualizaciones", errData);
      return {
        available: false,
        latestVersion: "unknown",
        currentVersion: await getPackageVersion(),
        branch: DEFAULT_BRANCH,
      };
    }
  },

  async performUpdate(): Promise<UpdateCommandResult> {
    log.info("Iniciando proceso de actualización OTA...");

    if (config.platform.isWindows) {
      return {
        success: true,
        message: "Actualización OTA no disponible en Windows. Modo simulación.",
        logs: "[SIMULACION]\nActualización OTA no disponible en Windows.\n",
      };
    }

    const logChunks: string[] = ["Iniciando actualización OTA de HomeVault...\n"];

    try {
      await ensureCleanWorktree();

      logChunks.push(await runCommand(`git fetch origin ${DEFAULT_BRANCH} --prune`, "Descargando estado remoto"));
      logChunks.push(await runCommand(`git pull --ff-only origin ${DEFAULT_BRANCH}`, "Sincronizando repositorio"));
      logChunks.push(await runCommand("npm install --include=dev", "Dependencias backend"));
      logChunks.push(await runCommand("npm --prefix frontend install --include=dev", "Dependencias frontend"));
      logChunks.push(await runCommand("npm --prefix frontend run build", "Build frontend"));
      logChunks.push(await runCommand("npx prisma generate", "Prisma generate"));
      logChunks.push(await runCommand("npx prisma db push", "Prisma db push"));
      logChunks.push(await runCommand("npm run build", "Build backend"));
      logChunks.push(`${formatSection("Reinicio del servicio")}Se programó reinicio de ${DEFAULT_SERVICE_NAME}.service en 4 segundos.\n`);
      scheduleServiceRestart(DEFAULT_SERVICE_NAME);

      return {
        success: true,
        message: "Actualización OTA completada. El servicio se reiniciará en unos segundos.",
        logs: logChunks.join(""),
        restartRequired: true,
      };
    } catch (error: unknown) {
      log.errorWithStack("Fallo en la actualización OTA", error);
      logChunks.push(await captureFailure(getFailedCommand(error), "Error de actualización", error));

      return {
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido durante la actualización OTA.",
        logs: logChunks.join(""),
        error: error instanceof Error ? error.message : "Error desconocido durante la actualización OTA.",
      };
    }
  },

  async updateSystemPackages(): Promise<UpdateCommandResult> {
    log.info("Iniciando actualización de paquetes del sistema...");

    if (config.platform.isWindows) {
      return {
        success: true,
        message: "Actualización del sistema no disponible en Windows. Modo simulación.",
        logs: "[SIMULACION]\nActualización del sistema no disponible en Windows.\n",
      };
    }

    const logChunks: string[] = ["Iniciando actualización de paquetes del sistema...\n"];

    try {
      logChunks.push(await runCommand("sudo apt-get update", "Indice APT"));
      logChunks.push(await runCommand("sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y", "Actualización de paquetes"));
      logChunks.push(await runCommand("sudo apt-get autoremove -y", "Limpieza de paquetes"));

      const rebootRequired = await pathExists("/var/run/reboot-required");
      if (rebootRequired) {
        logChunks.push("\nEl sistema recomienda reinicio para completar cambios del kernel o librerías base.\n");
      }

      return {
        success: true,
        message: rebootRequired
          ? "Paquetes del sistema actualizados. Se recomienda reiniciar el host."
          : "Paquetes del sistema actualizados correctamente.",
        logs: logChunks.join(""),
        rebootRequired,
      };
    } catch (error: unknown) {
      log.errorWithStack("Fallo en la actualización del sistema", error);
      logChunks.push(await captureFailure(getFailedCommand(error), "Error de actualización del sistema", error));

      return {
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido durante la actualización del sistema.",
        logs: logChunks.join(""),
        error: error instanceof Error ? error.message : "Error desconocido durante la actualización del sistema.",
      };
    }
  },
};
