import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { NetworkService } from "../services/network.service.js";

const router = Router();
function getMsg(e: unknown): string { return e instanceof Error ? e.message : 'Error desconocido'; }

router.get("/status", requireAuth, async (_req, res) => {
  try {
    const status = await NetworkService.getStatus();
    res.json({ success: true, data: status });
  } catch (error: unknown) {
    res.json({
      success: true,
      data: {
        hostname: "homevault",
        ip: "0.0.0.0",
        isStatic: false,
        interface: "eth0",
      },
      warning: getMsg(error),
    });
  }
});

router.post("/hostname", requireAuth, async (req, res) => {
  try {
    const { hostname } = req.body;
    await NetworkService.setHostname(hostname);
    res.json({ success: true, message: "Hostname actualizado (requiere reinicio)" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post("/ip/static", requireAuth, async (req, res) => {
  try {
    const { ip, gateway, dns } = req.body;
    await NetworkService.setStaticIP(ip, gateway, dns);
    res.json({ success: true, message: "IP Estática configurada (requiere reinicio)" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post("/ip/dhcp", requireAuth, async (_req, res) => {
  try {
    await NetworkService.setDHCP();
    res.json({ success: true, message: "Cambiado a DHCP (requiere reinicio)" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

export default router;
