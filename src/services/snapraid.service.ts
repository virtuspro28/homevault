import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("snapraid-service");
const prisma = new PrismaClient();

const FSTAB_PATH = process.env["FSTAB_PATH"] ?? "/etc/fstab";
const SNAPRAID_CONF_PATH = process.env["SNAPRAID_CONF_PATH"] ?? "/etc/snapraid.conf";
const MERGERFS_MOUNTPOINT = process.env["MERGERFS_MOUNTPOINT"] ?? "/mnt/storage";

export interface StoragePoolDetails {
  name: string;
  type: "MergerFS" | "SnapRAID" | "Standalone";
  size: string;
  used: string;
  free: string;
  usage: number;
  mountPoint: string;
  healthy: boolean;
  disks: Array<{ path: string; role: "data" | "parity" | "content" | "mount" }>;
}

function parseBytes(rawValue: string): number {
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : 0;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

async function ensureGlobalStatus() {
  const current = await prisma.storagePool.findUnique({ where: { id: "global" } });
  if (current) {
    return current;
  }

  return prisma.storagePool.create({
    data: { id: "global", status: "idle", progress: 0 },
  });
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

async function getMountUsage(targetPath: string): Promise<{ size: string; used: string; free: string; usage: number }> {
  if (config.platform.isWindows) {
    return { size: "12 TB", used: "4.6 TB", free: "7.4 TB", usage: 38 };
  }

  try {
    const { stdout } = await execAsync(`df -B1 "${targetPath}" | tail -n 1`);
    const parts = stdout.trim().split(/\s+/);
    const sizeBytes = parseBytes(parts[1] ?? "0");
    const usedBytes = parseBytes(parts[2] ?? "0");
    const freeBytes = parseBytes(parts[3] ?? "0");
    const usage = Number((parts[4] ?? "0").replace("%", ""));

    return {
      size: formatBytes(sizeBytes),
      used: formatBytes(usedBytes),
      free: formatBytes(freeBytes),
      usage: Number.isFinite(usage) ? usage : 0,
    };
  } catch {
    return { size: "N/A", used: "N/A", free: "N/A", usage: 0 };
  }
}

async function parseConfiguredPool(): Promise<StoragePoolDetails[]> {
  if (config.platform.isWindows) {
    return [
      {
        name: "pool-main",
        type: "MergerFS",
        size: "12 TB",
        used: "4.6 TB",
        free: "7.4 TB",
        usage: 38,
        mountPoint: MERGERFS_MOUNTPOINT,
        healthy: true,
        disks: [
          { path: "C:\\mock\\disk1", role: "data" },
          { path: "C:\\mock\\disk2", role: "data" },
          { path: "C:\\mock\\parity1", role: "parity" },
        ],
      },
    ];
  }

  const [fstabContent, snapraidContent] = await Promise.all([
    readOptionalFile(FSTAB_PATH),
    readOptionalFile(SNAPRAID_CONF_PATH),
  ]);

  const fstabLine = fstabContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && line.includes("fuse.mergerfs"));

  if (!fstabLine) {
    return [];
  }

  const fstabParts = fstabLine.split(/\s+/);
  const sourcePattern = fstabParts[0] ?? "";
  const mountPoint = fstabParts[1] ?? MERGERFS_MOUNTPOINT;
  const mountUsage = await getMountUsage(mountPoint);

  const snapraidLines = snapraidContent.split(/\r?\n/).map((line) => line.trim());
  const disks: StoragePoolDetails["disks"] = [];

  for (const line of snapraidLines) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const dataMatch = line.match(/^data\s+\S+\s+(.+)$/i);
    const parityMatch = line.match(/^parity\s+(.+)$/i);
    const contentMatch = line.match(/^content\s+(.+)$/i);
    const dataPath = dataMatch?.[1];
    const parityPath = parityMatch?.[1];
    const contentPath = contentMatch?.[1];

    if (dataPath) {
      disks.push({ path: dataPath.trim(), role: "data" });
    } else if (parityPath) {
      disks.push({ path: parityPath.trim(), role: "parity" });
    } else if (contentPath) {
      disks.push({ path: contentPath.trim(), role: "content" });
    }
  }

  if (disks.length === 0) {
    sourcePattern.split(":").forEach((entry) => {
      if (entry) {
        disks.push({ path: entry, role: "mount" });
      }
    });
  }

  return [
    {
      name: "pool-main",
      type: snapraidContent.trim().length > 0 ? "SnapRAID" : "MergerFS",
      mountPoint,
      healthy: true,
      disks,
      ...mountUsage,
    },
  ];
}

function buildMergerFsLine(disks: string[], mountPoint: string): string {
  return `${disks.join(":")} ${mountPoint} fuse.mergerfs defaults,allow_other,use_ino,cache.files=partial,dropcacheonclose=true,category.create=mfs 0 0`;
}

function buildSnapraidConf(disks: string[], parityDisk: string, mountPoint: string): string {
  const dataEntries = disks
    .map((disk, index) => `data d${index + 1} ${disk}`)
    .join("\n");
  return `# HomePiNAS autogenerated SnapRAID configuration
parity ${parityDisk}
content ${mountPoint}/.snapraid.content
${dataEntries}
exclude *.tmp
exclude /tmp/
exclude .recycle/
`;
}

export const SnapRaidService = {
  async getStatus() {
    return ensureGlobalStatus();
  },

  async listPools(): Promise<StoragePoolDetails[]> {
    return parseConfiguredPool();
  },

  async runSync() {
    await ensureGlobalStatus();
    log.info("Iniciando SnapRAID Sync...");

    await prisma.storagePool.update({
      where: { id: "global" },
      data: { status: "syncing", progress: 0 },
    });

    if (config.platform.isWindows) {
      this.simulateProcess("syncing", "lastSync");
      return;
    }

    const child = spawn("sudo", ["snapraid", "sync"]);

    child.stdout.on("data", async (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/(\d+)%/);
      if (match) {
        const progress = parseInt(match[1] ?? "0", 10);
        await prisma.storagePool.update({
          where: { id: "global" },
          data: { progress },
        });
      }
    });

    child.on("close", async (code: number | null) => {
      await prisma.storagePool.update({
        where: { id: "global" },
        data: {
          status: code === 0 ? "idle" : "error",
          progress: code === 0 ? 100 : 0,
          lastSync: code === 0 ? new Date() : null,
        },
      });
      log.info(`SnapRAID Sync finalizado con codigo ${code}`);
    });
  },

  async createPool(payload: { disks: string[]; parityDisk?: string; mountPoint?: string }) {
    const disks = payload.disks.map((disk) => disk.trim()).filter(Boolean);
    const mountPoint = payload.mountPoint?.trim() || MERGERFS_MOUNTPOINT;

    if (disks.length < 2) {
      throw new Error("Se necesitan al menos dos rutas de datos para crear un pool MergerFS.");
    }

    if (config.platform.isWindows) {
      await ensureGlobalStatus();
      return {
        name: "pool-main",
        mountPoint,
        disks,
        parityDisk: payload.parityDisk?.trim() || null,
        mode: "mock",
      };
    }

    const fstabContent = await readOptionalFile(FSTAB_PATH);
    const mergerLine = buildMergerFsLine(disks, mountPoint);
    if (!fstabContent.includes("fuse.mergerfs")) {
      await fs.appendFile(FSTAB_PATH, `\n# HomePiNAS Storage Pool\n${mergerLine}\n`, "utf-8");
    } else {
      const updated = fstabContent.replace(/^.*fuse\.mergerfs.*$/m, mergerLine);
      await fs.writeFile(FSTAB_PATH, updated, "utf-8");
    }

    if (payload.parityDisk?.trim()) {
      const snapraidConf = buildSnapraidConf(disks, payload.parityDisk.trim(), mountPoint);
      await fs.writeFile(SNAPRAID_CONF_PATH, snapraidConf, "utf-8");
    }

    await execAsync("sudo mount -a");
    return {
      name: "pool-main",
      mountPoint,
      disks,
      parityDisk: payload.parityDisk?.trim() || null,
      mode: "linux",
    };
  },

  async persistMergerFSPool() {
    const pools = await this.listPools();
    if (pools.length === 0) {
      throw new Error("No hay un pool MergerFS detectado para persistir.");
    }

    if (config.platform.isWindows) {
      return;
    }

    await execAsync("sudo mount -a");
  },

  simulateProcess(status: "syncing" | "scrubbing", dateField: "lastSync" | "lastScrub") {
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 10;
      await prisma.storagePool.update({
        where: { id: "global" },
        data: { progress },
      });

      if (progress >= 100) {
        clearInterval(interval);
        await prisma.storagePool.update({
          where: { id: "global" },
          data: {
            status: "idle",
            progress: 100,
            [dateField]: new Date(),
          },
        });
      }
    }, 2000);
  },
};
