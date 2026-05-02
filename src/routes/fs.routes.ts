import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { 
  listFiles, 
  createDirectory, 
  deleteItem, 
  renameItem, 
  searchFiles,
  resolveStoragePath,
} from "../services/files.service.js";
import { QuotaService } from "../services/quota.service.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

const log = logger.child('fs-routes');
const router = Router();

// Storage protection
router.use(requireAuth);

/**
 * Multer Config for uploads
 */
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const requestPath = typeof req.query["path"] === "string" ? req.query["path"] : "";
      const dest = resolveStoragePath(requestPath);
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid destination path";
      cb(new Error(message), config.storage.basePath);
    }
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB limit
});

/**
 * [GET] /api/files/list?path=/folder
 */
router.get("/list", async (req: Request, res: Response) => {

  try {
    const targetPath = typeof req.query['path'] === 'string' ? req.query['path'] : '/';
    const items = await listFiles(targetPath);
    res.status(200).json({ success: true, data: items, path: targetPath || '/' });
  } catch (err: any) {
    log.error(`Browse error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [POST] /api/files/upload?path=/folder
 */
router.post("/upload", upload.array("files"), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const files = req.files as Express.Multer.File[];
    
    // Calculate total size of new files
    const totalNewSize = files.reduce((acc, f) => acc + f.size, 0);

    // Check Quota
    const hasSpace = await QuotaService.canUpload(user.id, user.username, totalNewSize);
    if (!hasSpace) {
      // If quota exceeded, we should ideally delete the just-uploaded files
      files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Ignore cleanup failures after quota rejection.
        }
      });
      return res.status(403).json({ success: false, error: "Quota Exceeded: You do not have enough space." });
    }

    res.status(200).json({ success: true, message: "Files uploaded successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [GET] /api/files/download?path=/folder/file.ext
 */
router.get("/download", (req: Request, res: Response) => {
  const filePath = req.query["path"] as string;
  if (!filePath) return res.status(400).json({ success: false, error: "Path is required" });

  let absolutePath: string;
  try {
    absolutePath = resolveStoragePath(filePath);
  } catch {
    return res.status(403).json({ success: false, error: "Access Denied" });
  }

  res.download(absolutePath, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(404).json({ success: false, error: "File not found" });
      }
    }
  });
});

/**
 * [POST] /api/files/mkdir
 * Body: { path: "/folder", name: "new-dir" }
 */
router.post("/mkdir", async (req: Request, res: Response) => {
  try {
    const { path: folderPath, name } = req.body;
    await createDirectory(folderPath || '', name);
    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [DELETE] /api/files/delete?path=/folder/file.ext
 */
router.delete("/delete", async (req: Request, res: Response) => {
  try {
    const filePath = req.query["path"] as string;
    await deleteItem(filePath);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [PATCH] /api/files/rename
 * Body: { oldPath: "/folder/old.ext", newPath: "/folder/new.ext" }
 */
router.patch("/rename", async (req: Request, res: Response) => {
  try {
    const { oldPath, newPath } = req.body;
    await renameItem(oldPath, newPath);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [GET] /api/files/search?q=query
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query["q"] as string;
    if (!query) return res.status(400).json({ success: false, error: "Query is required" });
    const results = await searchFiles(query);
    res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
