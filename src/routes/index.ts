/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Router Principal
 * ═══════════════════════════════════════════════════════════════
 *
 *  Orquesta todos los sub-routers bajo el prefijo /api.
 *  Para añadir nuevas rutas en el futuro:
 *  1. Crear un archivo en src/routes/nombre.ts
 *  2. Importarlo aquí
 *  3. Montarlo con router.use("/nombre", nombreRouter)
 *
 *  Mantener este archivo como un simple mapa de rutas.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import healthRouter from "./health.js";
import systemRouter from "./system.js";
import dockerRouter from "./docker.routes.js";
import fsRouter from "./fs.routes.js";
import authRouter from "./authRoutes.js";
import sambaRouter from "./samba.routes.js";
import backupRouter from "./backup.routes.js";
import userRouter from "./user.routes.js";
import storeRouter from "./store.routes.js";
import settingsRouter from "./settings.routes.js";
import networkRouter from "./network.routes.js";
import vpnRouter from "./vpn.routes.js";
import proxyRouter from "./proxy.routes.js";
import securityRouter from "./security.routes.js";
import upsRouter from "./ups.routes.js";
import configRouter from "./config.routes.js";
import cloudRouter from "./cloud.routes.js";
import storageRouter from "./storageRoutes.js";
import hardwareRouter from "./hardware.routes.js";

import { logger } from "../utils/logger.js";

const log = logger.child("router");
const router = Router();

/* ─── Montaje de sub-routers ─── */
router.use("/health", healthRouter);
router.use("/system", systemRouter);
router.use("/docker", dockerRouter);
router.use("/files", fsRouter);
router.use("/auth", authRouter);
router.use("/samba", sambaRouter);
router.use("/backup", backupRouter);
router.use("/users", userRouter);
router.use("/store", storeRouter);
router.use("/settings", settingsRouter);
router.use("/network", networkRouter);
router.use("/vpn", vpnRouter);
router.use("/proxy", proxyRouter);
router.use("/security", securityRouter);
router.use("/ups", upsRouter);
router.use("/config", configRouter);
router.use("/cloud", cloudRouter);
router.use("/storage", storageRouter);
router.use("/hardware", hardwareRouter);


log.info("Rutas API registradas: /api/health, /api/system/*, /api/docker, /api/files, /api/auth, /api/samba, /api/backup, /api/users, /api/store, /api/settings, /api/network, /api/vpn, /api/proxy, /api/security, /api/ups, /api/cloud, /api/hardware");

export default router;
