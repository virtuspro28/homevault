import { exec } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { promisify } from "node:util";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);
const log = logger.child("nfs-service");
const EXPORTS_PATH = "/etc/exports";
const NFS_SERVICE = "nfs-kernel-server";

export interface NfsShareDefinition {
  path: string;
  clients?: string;
  options?: string[];
}

function normalizeShare(input: NfsShareDefinition): Required<NfsShareDefinition> {
  return {
    path: input.path.trim(),
    clients: input.clients?.trim() || "*",
    options: input.options?.length ? input.options : ["rw", "sync", "no_subtree_check", "no_root_squash"],
  };
}

function buildExportLine(share: Required<NfsShareDefinition>): string {
  return `${share.path} ${share.clients}(${share.options.join(",")})`;
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function run(command: string): Promise<void> {
  await execAsync(command, { maxBuffer: 5 * 1024 * 1024 });
}

export const NfsService = {
  async ensureInstalled(): Promise<void> {
    if (!config.platform.isLinux || config.platform.isWindows) {
      return;
    }

    try {
      await run("dpkg -s nfs-kernel-server");
    } catch {
      await run("sudo apt-get update");
      await run("sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nfs-kernel-server nfs-common");
    }
  },

  async listExports(): Promise<string[]> {
    if (!(await fileExists(EXPORTS_PATH))) {
      return [];
    }

    const content = await readFile(EXPORTS_PATH, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  },

  async ensureShare(input: NfsShareDefinition): Promise<{ changed: boolean; line: string }> {
    if (!config.platform.isLinux || config.platform.isWindows) {
      return { changed: false, line: "" };
    }

    await this.ensureInstalled();

    const share = normalizeShare(input);
    const exportLine = buildExportLine(share);

    await mkdir(share.path, { recursive: true });
    const stats = await stat(share.path);
    if (!stats.isDirectory()) {
      throw new Error(`La ruta ${share.path} no es un directorio válido para exportar por NFS.`);
    }

    const currentLines = await this.listExports();
    // Remover configuraciones anteriores para la misma ruta
    const otherLines = currentLines.filter((line) => !line.startsWith(`${share.path} `) && !line.startsWith(`${share.path}\t`));
    
    if (currentLines.includes(exportLine) && otherLines.length === currentLines.length - 1) {
      return { changed: false, line: exportLine };
    }

    const nextContent = `${[...otherLines, exportLine].join("\n")}\n`;
    const tmpFile = `/tmp/homevault_exports_${Date.now()}`;
    await writeFile(tmpFile, nextContent, "utf-8");
    await run(`sudo cp ${tmpFile} ${EXPORTS_PATH} && sudo rm ${tmpFile}`);
    await run("sudo exportfs -ra");
    await run(`sudo systemctl enable ${NFS_SERVICE}`);
    await run(`sudo systemctl restart ${NFS_SERVICE}`);
    log.info(`Export NFS configurado: ${exportLine}`);

    return { changed: true, line: exportLine };
  },
};
