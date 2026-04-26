import { Router } from "express";
import { getDisks } from "../controllers/storageController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { DiskService } from "../services/disk.service.js";
import { SnapRaidService } from "../services/snapraid.service.js";

const router = Router();

router.use(requireAuth);

router.get("/disks", getDisks);

router.get("/pools", async (_req, res) => {
  try {
    const pools = await SnapRaidService.listPools();
    res.json({ success: true, data: pools });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/pool/status", async (_req, res) => {
  try {
    const status = await SnapRaidService.getStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/pool/sync", async (_req, res) => {
  try {
    SnapRaidService.runSync();
    res.json({ success: true, message: "Sincronizacion iniciada en segundo plano" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/pool/persist-pool", async (_req, res) => {
  try {
    await SnapRaidService.persistMergerFSPool();
    res.json({ success: true, message: "Pool de almacenamiento persistido en fstab" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/health", async (_req, res) => {
  try {
    const health = await DiskService.getHealthStatus();
    res.json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
