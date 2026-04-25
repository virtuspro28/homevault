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

/**
 * GET /api/docker/store/apps
 * Lista aplicaciones disponibles para instalar desde la tienda
 */
router.get("/store/apps", async (_req: Request, res: Response) => {
  try {
    const catalog = await StoreService.getCatalog();
    const installedList = await StoreService.getInstalledStatus();

    const appsWithStatus = catalog.map(app => ({
      ...app,
      isInstalled: installedList.includes(app.id.toLowerCase())
    }));

    res.status(200).json({ success: true, data: appsWithStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error listando apps';
    log.error(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/docker/store/install/:id
 * Instala una aplicación del catálogo
 */
router.post("/store/install/:id", async (req: Request, res: Response) => {
  try {
    const appId = req.params["id"] as string;
    
    if (!appId || !/^[a-zA-Z0-9_\-]{2,32}$/.test(appId)) {
      res.status(400).json({ success: false, error: "ID de aplicación inválido" });
      return;
    }

    // Iniciar instalación de forma asincrónica
    StoreService.deployApp(appId)
      .then(() => {
        log.info(`Instalación de ${appId} completada`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        log.error(`Error instalando ${appId}: ${msg}`);
      });

    res.status(202).json({ 
      success: true, 
      message: `Instalación de ${appId} iniciada. Consulta los logs para el estado.` 
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error iniciando instalación';
    log.error(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
