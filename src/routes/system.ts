import { Router, type Request, type Response } from "express";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { UpdateService } from "../services/update.service.js";
import { logger } from "../utils/logger.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";
import { TelemetryService } from "../services/telemetry.service.js";
import { getSystemStats, getHardwareInfo } from "../modules/system-monitor.js";

const execAsync = promisify(exec);
const router = Router();
const log = logger.child("system-routes");

function getMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Error desconocido";
}
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../../package.json");

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return pkg.version;
  } catch {
    return "1.0.0";
  }
}

router.post("/reboot", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    log.warn("Solicitud de REINICIO de sistema recibida.");
    res.json({ success: true, message: "Reiniciando sistema..." });
    if (process.platform !== "win32") {
      setTimeout(() => {
        exec("sudo /sbin/reboot", (err) => {
          if (err) log.error(`Error ejecutando reboot: ${err.message}`);
        });
      }, 1500);
    }
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post("/shutdown", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    log.warn("Solicitud de APAGADO de sistema recibida.");
    res.json({ success: true, message: "Apagando sistema..." });
    if (process.platform !== "win32") {
      setTimeout(() => {
        exec("sudo /sbin/shutdown -h now", (err) => {
          if (err) log.error(`Error ejecutando shutdown: ${err.message}`);
        });
      }, 1500);
    }
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/processes", requireAuth, async (_req: Request, res: Response) => {
  try {
    if (process.platform === "win32") {
      res.json({
        success: true,
        data: [
          { pid: 101, name: "Node.exe", cpu: 5.2, mem: 120, user: "System" },
          { pid: 202, name: "Chrome.exe", cpu: 2.1, mem: 450, user: "User" },
        ],
      });
      return;
    }

    const { stdout } = await execAsync("ps -aux --sort=-%cpu | head -n 13");
    const lines = stdout.trim().split("\n");
    lines.shift();

    const processes = lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        user: parts[0],
        pid: parseInt(parts[1] ?? "0", 10),
        cpu: parseFloat(parts[2] ?? "0"),
        mem: parseFloat(parts[3] ?? "0"),
        name: parts[10] ? parts.slice(10).join(" ").substring(0, 40) : "Unknown",
      };
    });

    res.json({ success: true, data: processes });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.delete("/processes/:pid", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const pid = req.params["pid"];
    if (process.platform !== "win32") {
      await execAsync(`sudo kill -9 ${pid}`);
    }
    res.json({ success: true, message: `Proceso ${pid} finalizado.` });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/notifications/history", requireAuth, async (_req: Request, res: Response) => {
  try {
    const history = await prisma.notificationActivity.findMany({
      where: { isRead: false },
      orderBy: { timestamp: "desc" },
      take: 20,
    });
    res.json({ success: true, data: history });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/events", requireAuth, async (req: Request, res: Response) => {
  try {
    const { level, category, search } = req.query;

    const where: Record<string, unknown> = {};
    if (level) where["level"] = level;
    if (category) where["category"] = category;
    if (search) {
      where["message"] = { contains: String(search) };
    }

    const events = await prisma.notificationActivity.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 200,
    });

    res.json({ success: true, data: events });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.patch("/events/read-all", requireAuth, async (_req: Request, res: Response) => {
  try {
    await prisma.notificationActivity.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: "Todas las notificaciones marcadas como leídas" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.delete("/events", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await prisma.notificationActivity.deleteMany({});
    res.json({ success: true, message: "Historial de eventos vaciado" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/version", async (_req: Request, res: Response) => {
  try {
    let commit = "unknown";
    if (process.platform !== "win32") {
      try {
        const { stdout } = await execAsync("git rev-parse HEAD");
        commit = stdout.trim();
      } catch (e) {
        log.warn("No se pudo obtener el hash de git");
      }
    }

    res.json({
      success: true,
      local: getPackageVersion(),
      commit: commit,
      arch: process.arch,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/summary", requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await TelemetryService.getSummary();
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/update/check", requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await UpdateService.checkForUpdates();
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/check-updates", requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await UpdateService.checkForUpdates();
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post("/update/apply", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await UpdateService.performUpdate();
    res.type("application/json").status(result.success ? 200 : 500).send(JSON.stringify(result));
  } catch (error: unknown) {
    res.type("application/json").status(500).send(JSON.stringify({ success: false, error: getMsg(error) }));
  }
});

router.post("/update", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await UpdateService.performUpdate();
    res.type("application/json").status(result.success ? 200 : 500).send(JSON.stringify(result));
  } catch (error: unknown) {
    res.type("application/json").status(500).send(JSON.stringify({ success: false, error: getMsg(error) }));
  }
});

router.post("/update/system", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await UpdateService.updateSystemPackages();
    res.status(result.success ? 200 : 500).json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/telemetry", requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = TelemetryService.getTelemetry();
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/logs", requireAuth, async (_req: Request, res: Response) => {
  try {
    if (process.platform === "win32") {
      res.json({
        success: true,
        data: "[WIN-SIM] [INFO] Registros simulados. En Raspberry Pi verás el output real de journalctl.\n[WIN-SIM] [DEBUG] Sistema arrancando sección de telemetría...\n[WIN-SIM] [OK] Dashboard listo.",
      });
      return;
    }

    const { stdout } = await execAsync("journalctl -u homevault -n 50 --no-pager");
    res.json({ success: true, data: stdout });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = getSystemStats();
    
    // Calcular agregados de disco
    const mainDisk = stats.disks[0] || { totalGB: 0, usedGB: 0, freeGB: 0, usagePercent: 0 };
    const healthyDisks = stats.disks.length; // Por ahora asumimos todos sanos si aparecen en df

    // Obtener info de docker de forma segura
    let activeContainers = 0;
    try {
      // Intentar importar sin bloquear
      const dockerModule = await import("../services/docker.service.js").catch(() => null);
      if (dockerModule && dockerModule.getContainers) {
        const containers = await dockerModule.getContainers();
        activeContainers = Array.isArray(containers) ? containers.filter(c => c.state === 'running').length : 0;
      }
    } catch (e: unknown) {
      log.warn(`Error leyendo contenedores para stats: ${getMsg(e)}`);
    }


    // Formatear uptime
    const uptimeSec = stats.uptime?.system || 0;
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const uptimeFormatted = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

    // Mapear al formato que espera el Dashboard.tsx (Asegurando valores por defecto)

    const dashboardStats = {
      cpu: {
        usage: stats.cpu?.usagePercent || 0,
        cores: stats.cpu?.cores || 1
      },
      ram: {
        percent: stats.memory?.usagePercent || 0,
        usedGb: ((stats.memory?.usedMB || 0) / 1024).toFixed(1),
        total: ((stats.memory?.totalMB || 0) / 1024).toFixed(1)
      },
      storage: {
        percent: mainDisk.usagePercent || 0,
        total: mainDisk.totalGB || 0,
        used: mainDisk.usedGB || 0,
        totalGb: mainDisk.totalGB || 0,
        freeGb: mainDisk.freeGB || 0,
        healthyDisks: healthyDisks || 1
      },
      docker: {
        active: activeContainers
      },
      security: {
        blockedToday: 0
      },
      system: {
        uptimeFormatted: uptimeFormatted || "---"
      }
    };


    res.status(200).json({
      success: true,
      data: dashboardStats,
    });
  } catch (error: unknown) {

    const message = error instanceof Error ? error.message : "Error desconocido";
    log.error(`Error obteniendo stats: ${message}`);

    res.status(500).json({
      success: false,
      error: `Error al obtener métricas del sistema: ${message}`,
    });
  }
});

router.get("/info", (_req: Request, res: Response) => {
  try {
    const info = getHardwareInfo();

    res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    log.error(`Error obteniendo info de hardware: ${message}`);

    res.status(500).json({
      success: false,
      error: `Error al obtener información del hardware: ${message}`,
    });
  }
});

export default router;
