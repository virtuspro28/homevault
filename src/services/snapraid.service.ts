import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("snapraid-service");
const prisma = new PrismaClient();

export const SnapRaidService = {
  /**
   * Obtiene el estado actual del Pool desde la DB
   */
  async getStatus() {
    let status = await prisma.storagePool.findUnique({ where: { id: "global" } });
    
    if (!status) {
      status = await prisma.storagePool.create({
        data: { id: "global", status: "idle", progress: 0 }
      });
    }
    return status;
  },

  /**
   * Ejecuta SnapRAID Sync con captura de progreso
   */
  async runSync() {
    log.info("Iniciando SnapRAID Sync...");

    await prisma.storagePool.update({
      where: { id: "global" },
      data: { status: "syncing", progress: 0 }
    });

    // En Windows simulamos el proceso
    if (config.platform.isWindows) {
      this.simulateProcess("syncing", "lastSync");
      return;
    }

    const child = spawn("sudo", ["snapraid", "sync"]);

    child.stdout.on("data", async (data: Buffer) => {
      const output = data.toString();
      // Buscar patrones de porcentaje: " 15%"
      const match = output.match(/(\d+)%/);
      if (match) {
        const progress = parseInt(match[1] ?? "0");
        await prisma.storagePool.update({
          where: { id: "global" },
          data: { progress }
        });
      }
    });

    child.on("close", async (code: number | null) => {
      await prisma.storagePool.update({
        where: { id: "global" },
        data: { 
          status: "idle", 
          progress: 100, 
          lastSync: code === 0 ? new Date() : null 
        }
      });
      log.info(`SnapRAID Sync finalizado con código ${code}`);
    });
  },

  /**
   * Genera el pool de MergerFS y lo persiste en fstab
   */
  async persistMergerFSPool() {
    if (config.platform.isWindows) return;

    try {
      const fstabPath = "/etc/fstab";
      let content = fs.readFileSync(fstabPath, "utf-8");

      // El patrón busca todos los discos montados en /mnt/disk*
      // y los combina en /mnt/storage
      const mergerLine = "src/disk* /mnt/storage fuse.mergerfs allow_other,use_ino,cache.files=off,dropcacheonclose=true,category.create=mfs 0 0";

      if (!content.includes("fuse.mergerfs")) {
        fs.appendFileSync(fstabPath, `\n# HomePiNAS Storage Pool\n${mergerLine}\n`);
        log.info("Línea de MergerFS añadida a /etc/fstab");
      }
      
      await execAsync("sudo mount -a");
    } catch (err: any) {
      log.error("Error persistiendo MergerFS:", err.message);
      throw err;
    }
  },

  /**
   * Simulación para entornos de desarrollo
   */
  simulateProcess(status: "syncing" | "scrubbing", dateField: string) {
    let prog = 0;
    const interval = setInterval(async () => {
      prog += 10;
      await prisma.storagePool.update({
        where: { id: "global" },
        data: { progress: prog }
      });

      if (prog >= 100) {
        clearInterval(interval);
        await prisma.storagePool.update({
          where: { id: "global" },
          data: { 
            status: "idle", 
            progress: 100,
            [dateField]: new Date()
          }
        });
      }
    }, 2000);
  }
};
