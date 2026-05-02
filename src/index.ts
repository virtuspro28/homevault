/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Punto de Entrada Principal
 * ═══════════════════════════════════════════════════════════════
 *
 *  REGLA: Este archivo SOLO orquesta. No contiene lógica de negocio.
 *
 *  Secuencia de arranque:
 *  1. Cargar configuración (detección de plataforma)
 *  2. Inicializar logger
 *  3. Inicializar base de datos + migraciones
 *  4. Configurar Express + middlewares + rutas
 *  5. Arrancar servidor HTTP
 *
 *  Cada paso delega en su módulo correspondiente.
 * ═══════════════════════════════════════════════════════════════
 */

import process from "node:process";
import { createServer } from "node:http";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { Server as SocketServer } from "socket.io";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/* ─── Módulos internos ─── */
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { getDatabase, registerShutdownHandlers } from "./database/connection.js";
import { runMigrations } from "./database/migrations.js";
import {
  helmetMiddleware,
  corsMiddleware,
  corsErrorHandler,
} from "./middlewares/security.js";
import apiRouter from "./routes/index.js";
import { startSystemWatcher } from "./modules/system-watcher.js";
import { HardwareService } from "./services/hardware.service.js";
import { BackupService } from './services/backup.service.js';
import { ensureStorageRootExists } from "./services/files.service.js";

const log = logger.child("server");

/* ═══════════════════════════════════════════════════════════════
   FASE 1: Inicialización de infraestructura
   ═══════════════════════════════════════════════════════════════ */

/**
 * Inicializa la base de datos y ejecuta migraciones pendientes.
 * Si falla, el servidor NO debe arrancar (fail-fast).
 */
function initDatabase(): void {
  try {
    log.info("Inicializando base de datos...");
    getDatabase(); // Fuerza la apertura de la conexión
    registerShutdownHandlers();

    const applied = runMigrations();
    if (applied > 0) {
      log.info(`${applied} migración(es) aplicada(s) correctamente`);
    }
  } catch (error: unknown) {
    log.errorWithStack("Error fatal al inicializar la base de datos", error);
    process.exit(1);
  }
}

async function initStorageRoot(): Promise<void> {
  try {
    const storagePath = await ensureStorageRootExists();
    log.info(`Raiz de almacenamiento lista en ${storagePath}`);
  } catch (error: unknown) {
    log.errorWithStack("Error fatal al preparar la raiz de almacenamiento", error);
    process.exit(1);
  }
}

async function ensureFrontendDistReady(frontendPath: string): Promise<void> {
  const indexPath = path.join(frontendPath, "index.html");

  try {
    await fs.access(frontendPath);
    await fs.access(indexPath);
    log.info(`Frontend estatico detectado en ${frontendPath}`);
  } catch (error: unknown) {
    log.errorWithStack(`No se encontró el build del frontend en ${indexPath}`, error);
    process.exit(1);
  }
}

/* ═══════════════════════════════════════════════════════════════
   FASE 2: Configuración de Express
   ═══════════════════════════════════════════════════════════════ */

const app = express();
const httpServer = createServer(app);
export const io = new SocketServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

/**
 * Middlewares de seguridad perimetral.
 * Orden: Helmet (headers) → CORS (orígenes) → Error handler CORS
 */
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(corsErrorHandler);

/** Parser JSON con límite configurable desde config */
app.use(express.json({ limit: config.server.jsonLimit }));
app.use(cookieParser());

/**
 * Montaje del router API bajo /api.
 * Todas las rutas del backend viven bajo este prefijo.
 * El "/" queda libre para servir el frontend estático en el futuro.
 */
app.use("/api", apiRouter);

/* ─── Ruta legacy /health (retrocompatibilidad con Fase 1) ─── */
app.get("/health", (_req: Request, res: Response) => {
  res.redirect(301, "/api/health");
});

/* ─── Servir Frontend Estático ─── */
const frontendPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendPath));

app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* ═══════════════════════════════════════════════════════════════
   MANEJO GLOBAL DE ERRORES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Middleware de error global.
 * Captura excepciones en handlers y devuelve JSON limpio.
 * En producción oculta detalles internos del error.
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error(`Error no manejado: ${err.message}`);
  if (config.isDev && err.stack) {
    log.error(err.stack);
  }

  res.status(500).json({
    success: false,
    error: config.isDev ? err.message : "Error interno del servidor",
  });
});

/**
 * Captura de errores fatales a nivel de proceso.
 * Loguea el error antes de salir para facilitar diagnóstico
 * en RPi donde no siempre hay un monitor conectado.
 */
process.on("uncaughtException", (error: Error) => {
  log.fatal(`Excepción no capturada: ${error.message}`);
  if (error.stack) log.fatal(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  log.fatal(`Promesa rechazada sin manejar: ${String(reason)}`);
  process.exit(1);
});

/* ═══════════════════════════════════════════════════════════════
   FASE 3: Arranque
   ═══════════════════════════════════════════════════════════════ */

/* ─── Inicializar Sockets de Terminal ─── */
import { setupTerminalSocket } from "./modules/terminal-socket.js";
import { setupMonitorSocket } from "./modules/monitor-socket.js";
setupTerminalSocket(io);
setupMonitorSocket(io);

getDatabase();

void Promise.all([initStorageRoot(), ensureFrontendDistReady(frontendPath)]).then(() => {
  httpServer.listen(config.server.port, () => {
    const p = config.platform;

    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    console.log("  🏠 HomeVault Dashboard v1.0.2");
    console.log("═══════════════════════════════════════════════════════");
    console.log("");
    console.log(`  ▸ Servidor:       http://${config.server.host}:${config.server.port}`);
    console.log(`  ▸ Entorno:        ${config.env}`);
    console.log(`  ▸ Arquitectura:   ${p.arch} ${p.isARM ? "(ARM — modo Raspberry Pi)" : "(x86_64 — modo servidor estándar)"}`);
    console.log(`  ▸ Plataforma:     ${p.os}`);
    console.log(`  ▸ CPU:            ${p.cpuCores} núcleos`);
    console.log(`  ▸ Memoria:        ${p.totalMemoryMB} MB (tier: ${p.memoryTier})`);
    console.log(`  ▸ Hostname:       ${p.hostname}`);
    console.log(`  ▸ Node.js:        ${p.nodeVersion}`);
    console.log(`  ▸ Base de datos:  ${config.paths.database}`);
    console.log("");

    if (p.memoryTier === "critical") {
      log.warn("⚠️  Memoria crítica (<512 MB). Optimizaciones de bajo consumo activas.");
    } else if (p.memoryTier === "low") {
      log.warn("⚠️  Memoria limitada (<1 GB). Cache de SQLite reducido.");
    }

    log.info("✅ Servidor listo. API disponible en /api/*");
    console.log("═══════════════════════════════════════════════════════");
    console.log("");

    startSystemWatcher();

    import("./services/ups.service.js").then(({ UpsService }) => {
      UpsService.startMonitoring();
    });

    HardwareService.init();
    BackupService.initScheduler();
  });
});

export default app;
