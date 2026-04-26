/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Ruta /api/health
 * ═══════════════════════════════════════════════════════════════
 *
 *  Endpoint de salud del sistema.
 *  Pensado para monitoreo externo (Uptime Kuma, healthchecks.io).
 *
 *  Responde estatus del servidor + info básica del hardware.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { getHardwareInfo } from "../modules/system-monitor.js";
import { logger } from "../utils/logger.js";

const log = logger.child("route:health");
const router = Router();

/**
 * GET /api/health
 *
 * Devuelve un JSON con:
 * - success: siempre true si el servidor responde
 * - status: "online"
 * - timestamp: ISO 8601
 * - system: información estática del hardware
 */
router.get("/", (_req: Request, res: Response) => {
  try {
    const hardwareInfo = getHardwareInfo();

    res.status(200).json({
      success: true,
      status: "online",
      timestamp: new Date().toISOString(),
      system: hardwareInfo,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    log.error(`Error en /health: ${message}`);

    res.status(500).json({
      success: false,
      error: `Error al obtener información del sistema: ${message}`,
    });
  }
});

export default router;
