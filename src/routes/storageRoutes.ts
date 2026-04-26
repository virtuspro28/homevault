import { Router } from "express";
import { getDisks } from "../controllers/storageController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { DiskService } from "../services/disk.service.js";
import { SnapRaidService } from "../services/snapraid.service.js";

const router = Router();

// Aplicamos el middleware requireAuth a nivel de enrutador.
router.use(requireAuth);

router.get("/disks", getDisks);

/**
 * GET /api/storage/pools
 * Lista los pools de almacenamiento configurados
 */
router.get("/pools", async (_req, res) => {
  try {
    // Por ahora devolvemos un array vacío o simulado si no hay lógica de detección real implementada aún
    // En el futuro esto leerá de la DB o de archivos de config de mergerfs/zfs
    const pools: any[] = []; 
    res.json({ success: true, data: pools });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/storage/pool/status
 * Obtiene el estado de sincronización y protección del Pool
 */
router.get("/pool/status", async (_req, res) => {
  try {
    const status = await SnapRaidService.getStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/storage/pool/sync
 * Dispara una sincronización de paridad
 */
router.post("/pool/sync", async (_req, res) => {
  try {
    SnapRaidService.runSync(); // No esperamos, corre en background
    res.json({ success: true, message: "Sincronización iniciada en segundo plano" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/storage/pool/persist
 * Configura MergerFS en fstab
 */
router.post("/pool/persist-pool", async (_req, res) => {
  try {
    await SnapRaidService.persistMergerFSPool();
    res.json({ success: true, message: "Pool de almacenamiento persistido en fstab" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/storage/health
 * Obtiene el estado de salud SMART de los discos físicos
 */
router.get("/health", async (req, res) => {
  try {
    const health = await DiskService.getHealthStatus();
    res.json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
