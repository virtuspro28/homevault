import { Router } from "express";
import { requireAdmin, requireAuth } from "../middlewares/authMiddleware.js";
import { RCloneService } from "../services/rclone.service.js";

const router = Router();

function redactProfileSecrets<T extends object>(profile: T) {
  return {
    ...profile,
    password: "",
    clientSecret: "",
    token: "",
  } as T & { password: string; clientSecret: string; token: string };
}

router.get("/providers", requireAuth, async (_req, res) => {
  try {
    res.json({ success: true, data: RCloneService.getProviders() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

router.get("/profiles", requireAuth, async (_req, res) => {
  try {
    const profiles = await RCloneService.listProfiles();
    res.json({ success: true, data: profiles.map((profile) => redactProfileSecrets(profile)) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

router.get("/remotes", requireAuth, async (_req, res) => {
  try {
    const remotes = await RCloneService.getRemotes();
    res.json({ success: true, data: remotes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/profiles", requireAuth, requireAdmin, async (req, res) => {
  try {
    const remote = await RCloneService.saveRemote(req.body);
    res.status(201).json({ success: true, data: redactProfileSecrets(remote) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

router.put("/profiles/:name", requireAuth, requireAdmin, async (req, res) => {
  try {
    const remote = await RCloneService.saveRemote({ ...req.body, name: req.params["name"] });
    res.json({ success: true, data: redactProfileSecrets(remote) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

router.delete("/profiles/:name", requireAuth, requireAdmin, async (req, res) => {
  try {
    await RCloneService.deleteRemote(req.params["name"] as string);
    res.json({ success: true, message: "Unidad de red eliminada" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/mount/:name", requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = req.params["name"] as string;
    await RCloneService.mountRemote(name);
    res.json({ success: true, message: `Unidad ${name} montada correctamente` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

router.delete("/mount/:name", requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = req.params["name"] as string;
    await RCloneService.unmountRemote(name);
    res.json({ success: true, message: `Unidad ${name} desmontada` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
