import { Router } from "express";
import type { Request, Response } from "express";
import { getContainers, startContainer, stopContainer } from "../services/docker.service.js";
import { StoreService } from "../services/store.service.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { logger } from "../utils/logger.js";

const router = Router();
const log = logger.child('docker-routes');

// Blindaje global
router.use(requireAuth);

router.get("/containers", async (_req: Request, res: Response) => {
  try {
    const containers = await getContainers();
    res.status(200).json({ success: true, data: containers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error listando containers';
    log.warn(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/containers/:id/start", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    if (!id) {
      res.status(400).json({ success: false, error: "ID de contenedor requerido" });
      return;
    }
    await startContainer(id);
    res.status(200).json({ success: true, message: "Contenedor iniciado" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error iniciando container';
    log.error(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/containers/:id/stop", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    if (!id) {
      res.status(400).json({ success: false, error: "ID de contenedor requerido" });
      return;
    }
    await stopContainer(id);
    res.status(200).json({ success: true, message: "Contenedor detenido" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deteniendo container';
    log.error(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

// Nota: Las rutas de Store se han movido a /api/store para mayor claridad y evitar colisiones.


export default router;
