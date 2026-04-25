import { Router } from "express";
import type { Request, Response } from "express";
import { 
  listConfigFiles, 
  readConfigFile, 
  saveConfigFile 
} from "../services/config.service.js";
import { requireAuth, requireOwner } from "../middlewares/authMiddleware.js";
import { logger } from "../utils/logger.js";

const router = Router();
const log = logger.child('config-routes');

// All config routes require authentication and OWNER role
router.use(requireAuth);
router.use(requireOwner);

/**
 * [GET] /api/config/files
 * Lists available config files.
 */
router.get("/files", async (_req: Request, res: Response) => {
  try {
    const files = await listConfigFiles();
    res.status(200).json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [GET] /api/config/read?path=file.conf
 */
router.get("/read", async (req: Request, res: Response) => {
  try {
    const filePath = req.query["path"] as string;
    if (!filePath) return res.status(400).json({ success: false, error: "Path is required" });
    
    const content = await readConfigFile(filePath);
    res.status(200).json({ success: true, data: content });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [POST] /api/config/save
 * Body: { path: "file.conf", content: "...", restartContainerId: "id" }
 */
router.post("/save", async (req: Request, res: Response) => {
  try {
    const { path: filePath, content, restartContainerId } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: "Path is required" });
    
    await saveConfigFile(filePath, content, restartContainerId);
    res.status(200).json({ success: true, message: "Configuration saved successfully" });
  } catch (err: any) {
    log.error(`Save config error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
