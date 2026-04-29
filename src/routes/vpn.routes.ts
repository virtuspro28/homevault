import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";
import { VpnService } from "../services/vpn.service.js";
import { DdnsService } from "../services/ddns.service.js";

const router = Router();

router.use(requireAuth);

router.get("/status", async (_req, res) => {
  try {
    const status = await VpnService.getServerStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/clients", async (_req, res) => {
  try {
    const clients = await VpnService.listClients();
    res.json({ success: true, data: clients });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/clients", requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const client = await VpnService.addClient(name);
    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/clients/:id/qr", async (req, res) => {
  try {
    const clientId = req.params["id"];
    if (!clientId || Array.isArray(clientId)) {
      res.status(400).json({ success: false, error: "ID de cliente requerido" });
      return;
    }
    const qrData = await VpnService.generateQR(clientId);
    res.json({ success: true, data: qrData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/clients/:id/config", async (req, res) => {
  try {
    const clientId = req.params["id"];
    if (!clientId || Array.isArray(clientId)) {
      res.status(400).json({ success: false, error: "ID de cliente requerido" });
      return;
    }
    const config = await VpnService.getClientConfig(clientId);
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/clients/:id/download", async (req, res) => {
  try {
    const clientId = req.params["id"];
    if (!clientId || Array.isArray(clientId)) {
      res.status(400).json({ success: false, error: "ID de cliente requerido" });
      return;
    }
    const config = await VpnService.getClientConfig(clientId);
    const filename = await VpnService.getDownloadFilename(clientId);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(config);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/clients/:id", requireAdmin, async (req, res) => {
  try {
    const clientId = req.params["id"];
    if (!clientId || Array.isArray(clientId)) {
      res.status(400).json({ success: false, error: "ID de cliente requerido" });
      return;
    }
    await VpnService.deleteClient(clientId);
    res.json({ success: true, message: "Cliente eliminado" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ddns/providers", async (_req, res) => {
  try {
    res.json({ success: true, data: DdnsService.getProviderOptions() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ddns/profiles", async (_req, res) => {
  try {
    const profiles = await DdnsService.listProfiles();
    res.json({ success: true, data: profiles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ddns/profiles", requireAdmin, async (req, res) => {
  try {
    const profile = await DdnsService.createProfile(req.body);
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/ddns/profiles/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, error: "ID de perfil requerido" });
      return;
    }
    const profile = await DdnsService.updateProfile(id, req.body);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ddns/profiles/:id/sync", requireAdmin, async (req, res) => {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, error: "ID de perfil requerido" });
      return;
    }
    const profile = await DdnsService.syncProfile(id);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/ddns/profiles/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, error: "ID de perfil requerido" });
      return;
    }
    await DdnsService.deleteProfile(id);
    res.json({ success: true, message: "Perfil DDNS eliminado" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
