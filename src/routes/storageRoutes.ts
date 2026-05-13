import { Router } from "express";
import { getDisks } from "../controllers/storageController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { DiskService } from "../services/disk.service.js";
import { SnapRaidService } from "../services/snapraid.service.js";

const router = Router();
function getMsg(e: unknown): string { return e instanceof Error ? e.message : 'Error desconocido'; }

router.use(requireAuth);

router.get("/disks", getDisks);

router.get("/pools", async (_req, res) => {
  try {
    const pools = await SnapRaidService.listPools();
    res.json({ success: true, data: pools });
  } catch (error: unknown) {
    res.json({ success: true, data: [], warning: getMsg(error) });
  }
});

router.get("/pool/status", async (_req, res) => {
  try {
    const status = await SnapRaidService.getStatus();
    res.json({ success: true, data: status });
  } catch (error: unknown) {
    res.json({
      success: true,
      data: { status: "unavailable", progress: 0, pools: [] },
      warning: getMsg(error),
    });
  }
});

router.post("/pool/sync", async (_req, res) => {
  try {
    await SnapRaidService.runSync();
    res.json({ success: true, message: "Sincronizacion iniciada en segundo plano" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post("/pool/scrub", async (_req, res) => {
  try {
    await SnapRaidService.runScrub();
    res.json({ success: true, message: "Scrub iniciado en segundo plano" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post("/pool/persist-pool", async (_req, res) => {
  try {
    await SnapRaidService.persistMergerFSPool();
    res.json({ success: true, message: "Pool de almacenamiento persistido en fstab" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post("/pool/create", async (req, res) => {
  try {
    const { disks, parityDisk, mountPoint } = req.body;
    const pool = await SnapRaidService.createPool({
      disks: Array.isArray(disks) ? disks : [],
      parityDisk,
      mountPoint,
    });
    res.json({ success: true, data: pool, message: "Pool configurado correctamente" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get("/health", async (_req, res) => {
  try {
    const health = await DiskService.getHealthStatus();
    res.json({ success: true, data: health });
  } catch (error: unknown) {
    res.json({ success: true, data: [], warning: getMsg(error) });
  }
});

export default router;
