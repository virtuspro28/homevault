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

export const UpdateService = {
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      const { stdout: localHash } = await execAsync("git rev-parse HEAD", {
        cwd: config.paths.root,
        maxBuffer: COMMAND_MAX_BUFFER,
      });

      await execAsync("git fetch origin", {
        cwd: config.paths.root,
        maxBuffer: COMMAND_MAX_BUFFER,
      });

      const { stdout: remoteHash } = await execAsync("git rev-parse origin/main", {
        cwd: config.paths.root,
        maxBuffer: COMMAND_MAX_BUFFER,
      });

      const localCommit = localHash.trim();
      const remoteCommit = remoteHash.trim();
      const currentVersion = localCommit.substring(0, 7);
      const latestVersion = remoteCommit.substring(0, 7);

      return {
        available: Boolean(remoteCommit) && localCommit !== remoteCommit,
        latestVersion,
        currentVersion,
        localCommit,
        remoteCommit,
      };
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error("Error comprobando actualizaciones", errData);
      return {
        available: false,
        latestVersion: "unknown",
        currentVersion: await getPackageVersion(),
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
      logChunks.push(await runCommand("git reset --hard HEAD", "Descartando cambios locales antes de actualizar"));
      logChunks.push(await runCommand("git fetch origin main", "Descargando cambios"));
      logChunks.push(await runCommand("git pull origin main", "Aplicando cambios remotos"));
      logChunks.push(await runCommand("npm install --include=dev", "Dependencias backend"));
      logChunks.push(await runCommand("npm --prefix frontend install --include=dev", "Dependencias frontend"));
      logChunks.push(await runCommand("npm --prefix frontend run build", "Build frontend"));
      logChunks.push(await runCommand("npx prisma generate", "Prisma generate"));
      logChunks.push(await runCommand("npx prisma db push", "Prisma db push"));
      logChunks.push(await runCommand("npm run build", "Build backend"));

      logChunks.push("Actualización aplicada correctamente. Reiniciando servicio HomeVault en 5 segundos...\n");
      setTimeout(() => {
        exec("sudo systemctl restart homevault.service");
      }, 5000);

      return {
        success: true,
        message: "Actualización OTA completada. El servicio se reiniciará en unos segundos.",
        logs: logChunks.join(""),
        restartRequired: true,
      };
    } catch (error: unknown) {
      log.errorWithStack("Fallo en la actualización OTA", error);

      const failedCommand =
        error instanceof Error && "cmd" in error && typeof error.cmd === "string"
          ? error.cmd
          : "Comando no disponible";

      logChunks.push(await captureFailure(failedCommand, "Error de actualización", error));

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
        logChunks.push("\nEl sistema indica que conviene reiniciar para completar cambios del kernel o librerías base.\n");
      }

      return {
        success: true,
        message: rebootRequired
          ? "Paquetes del sistema actualizados. Se recomienda reiniciar la Raspberry."
          : "Paquetes del sistema actualizados correctamente.",
        logs: logChunks.join(""),
        rebootRequired,
      };
    } catch (error: unknown) {
      log.errorWithStack("Fallo en la actualización del sistema", error);

      const failedCommand =
        error instanceof Error && "cmd" in error && typeof error.cmd === "string"
          ? error.cmd
          : "Comando no disponible";

      logChunks.push(await captureFailure(failedCommand, "Error de actualización del sistema", error));

      return {
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido durante la actualización del sistema.",
        logs: logChunks.join(""),
        error: error instanceof Error ? error.message : "Error desconocido durante la actualización del sistema.",
      };
    }
  },
};
