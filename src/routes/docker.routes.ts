import { Router } from "express";
import type { Request, Response } from "express";
import {
  getContainers,
  getContainerDetails,
  getContainerLogs,
  getContainerStats,
  removeContainer,
  restartContainer,
  startContainer,
  stopContainer,
} from "../services/docker.service.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { logger } from "../utils/logger.js";

const router = Router();
const log = logger.child("docker-routes");

router.use(requireAuth);

router.get("/containers", async (_req: Request, res: Response) => {
  try {
    const containers = await getContainers();
    res.status(200).json({ success: true, data: containers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error listando containers";
    log.warn(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/containers/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, error: "ID de contenedor requerido" });
      return;
    }
    const details = await getContainerDetails(id);
    res.status(200).json({ success: true, data: details });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error inspeccionando el contenedor";
    log.warn(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/containers/:id/stats", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, error: "ID de contenedor requerido" });
      return;
    }
    const stats = await getContainerStats(id);
    res.status(200).json({ success: true, data: stats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error leyendo metricas del contenedor";
    log.warn(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/containers/:id/logs", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, error: "ID de contenedor requerido" });
      return;
    }
    const tail = Number(req.query["tail"] ?? "120");
    const logs = await getContainerLogs(id, Number.isFinite(tail) ? tail : 120);
    res.status(200).json({ success: true, data: logs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error leyendo logs del contenedor";
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
    const msg = err instanceof Error ? err.message : "Error iniciando container";
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
    const msg = err instanceof Error ? err.message : "Error deteniendo container";
    log.error(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/containers/:id/restart", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    if (!id) {
      res.status(400).json({ success: false, error: "ID de contenedor requerido" });
      return;
    }
    await restartContainer(id);
    res.status(200).json({ success: true, message: "Contenedor reiniciado" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error reiniciando container";
    log.error(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.delete("/containers/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, error: "ID de contenedor requerido" });
      return;
    }

    const deleteData = req.body && typeof req.body === "object" && "deleteData" in req.body
      ? req.body.deleteData === true
      : false;

    await removeContainer(id, { deleteData });
    res.status(200).json({
      success: true,
      message: deleteData
        ? "Contenedor y carpeta de datos eliminados."
        : "Contenedor eliminado. Los datos persistentes se han conservado.",
      data: { id, dataDeleted: deleteData },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error eliminando container";
    log.error(msg);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
