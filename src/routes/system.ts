/**
 * ═══════════════════════════════════════════════════════════════
 *  HomePiNAS Dashboard — Rutas /api/system/*
 * ═══════════════════════════════════════════════════════════════
 *
 *  Endpoints de monitorización del sistema en tiempo real.
 *  Diseñados para ser consumidos por el dashboard frontend
 *  con polling periódico (ej: cada 2-5 segundos).
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from "express";
import { exec } from "node:child_process";
import { NotificationService } from "../services/notification.service.js";
import { UpdateService } from "../services/update.service.js";
import { logger } from "../utils/logger.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";
import { getDatabase } from "../database/connection.js";
import { TelemetryService } from "../services/telemetry.service.js";
import { promisify } from "node:util";
import { getSystemStats, getHardwareInfo } from "../modules/system-monitor.js";
import { PrismaClient } from "@prisma/client";

const execAsync = promisify(exec);
const router = Router();
const log = logger.child("system-routes");
const prisma = new PrismaClient();

router.post("/reboot", requireAuth, async (_req: Request, res: Response) => {
  try {
    log.warn("Solicitud de REINICIO de sistema recibida.");
    if (process.platform !== 'win32') {
      exec('sudo reboot');
    }
    res.json({ success: true, message: "Reiniciando sistema..." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/system/shutdown
 */
router.post("/shutdown", requireAuth, async (_req: Request, res: Response) => {
  try {
    log.warn("Solicitud de APAGADO de sistema recibida.");
    if (process.platform !== 'win32') {
      exec('sudo shutdown -h now');
    }
    res.json({ success: true, message: "Apagando sistema..." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system/processes
 * Lista los 12 procesos con más consumo de CPU
 */
router.get("/processes", requireAuth, async (_req: Request, res: Response) => {
  try {
    if (process.platform === 'win32') {
      return res.json({ 
        success: true, 
        data: [
          { pid: 101, name: "Node.exe", cpu: 5.2, mem: 120, user: "System" },
          { pid: 202, name: "Chrome.exe", cpu: 2.1, mem: 450, user: "User" }
        ] 
      });
    }

    const { stdout } = await execAsync('ps -aux --sort=-%cpu | head -n 13');
    const lines = stdout.trim().split('\n');
    lines.shift(); // Cabecera

    const processes = lines.map(line => {
      const p = line.trim().split(/\s+/);
      return {
        user: p[0],
        pid: parseInt(p[1] ?? "0"),
        cpu: parseFloat(p[2] ?? "0"),
        mem: parseFloat(p[3] ?? "0"),
        name: p[10] ? p.slice(10).join(' ').substring(0, 40) : "Unknown"
      };
    });

    res.json({ success: true, data: processes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/system/processes/:pid
 */
router.delete("/processes/:pid", requireAuth, async (req: Request, res: Response) => {
  try {
    const { pid } = req.params;
    if (process.platform !== 'win32') {
      await execAsync(`sudo kill -9 ${pid}`);
    }
    res.json({ success: true, message: `Proceso ${pid} finalizado.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system/notifications/history
 */
router.get("/notifications/history", requireAuth, async (_req: Request, res: Response) => {
  try {
    const history = await prisma.notificationActivity.findMany({
      where: { isRead: false },
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system/events
 * Visor de eventos avanzado con filtros
 */
router.get("/events", requireAuth, async (req: Request, res: Response) => {
  try {
    const { level, category, search } = req.query;
    
    const where: any = {};
    if (level) where.level = level;
    if (category) where.category = category;
    if (search) {
      where.message = { contains: String(search) };
    }

    const events = await prisma.notificationActivity.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200 // Límite razonable para el visor
    });

    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/system/events/read-all
 */
router.patch("/events/read-all", requireAuth, async (_req: Request, res: Response) => {
  try {
    await prisma.notificationActivity.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true, message: "Todas las notificaciones marcadas como leídas" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/system/events
 * Limpiar historial de eventos (Solo Admin)
 */
router.delete("/events", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await prisma.notificationActivity.deleteMany({});
    res.json({ success: true, message: "Historial de eventos vaciado" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system/summary
 */
router.get("/summary", requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await TelemetryService.getSummary();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system/update/check
 */
router.get("/update/check", requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await UpdateService.checkForUpdates();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/system/update/apply
 */
router.post("/update/apply", requireAuth, async (_req: Request, res: Response) => {
  try {
    await UpdateService.performUpdate();
    res.json({ success: true, message: "Actualización iniciada" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system/telemetry
 */


router.get("/telemetry", requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = TelemetryService.getTelemetry();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});



/**
 * GET /api/system/stats

/**
 * GET /api/system/logs
 * Obtiene las últimas 50 líneas de log del servicio homepinas
 */
router.get("/logs", requireAuth, async (_req: Request, res: Response) => {
  try {
    // Si estamos en Windows, simulamos, si estamos en Linux usamos journalctl
    if (process.platform === 'win32') {
      return res.json({ 
        success: true, 
        data: "[WIN-SIM] [INFO] Registros simulados. En Raspberry Pi verás el output real de journalctl.\n[WIN-SIM] [DEBUG] Sistema arrancando sección de telemetría...\n[WIN-SIM] [OK] Dashboard listo." 
      });
    }

    const { stdout } = await execAsync('journalctl -u homepinas -n 50 --no-pager');
    res.json({ success: true, data: stdout });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system/stats
 *
 * Métricas en tiempo real: CPU, RAM, disco, temperatura, uptime.
 * Respuestas cacheadas internamente por el system-monitor (TTL 2s).
 */
router.get("/stats", (_req: Request, res: Response) => {
  try {
    const stats = getSystemStats();

    res.status(200).json({
      success: true,
      data: stats,
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

/**
 * GET /api/system/info
 *
 * Información estática del hardware. No cambia en runtime.
 * Ideal para mostrar en la sección "Acerca de" del dashboard.
 */
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
