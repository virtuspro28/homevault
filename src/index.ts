import process from "node:process";
import { createServer } from "node:http";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { Server as SocketServer } from "socket.io";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { getDatabase, registerShutdownHandlers } from "./database/connection.js";
import { runMigrations } from "./database/migrations.js";
import { waitForPrismaReady } from "./database/prisma.js";
import {
  corsErrorHandler,
  corsMiddleware,
  helmetMiddleware,
} from "./middlewares/security.js";
import apiRouter from "./routes/index.js";
import { startSystemWatcher } from "./modules/system-watcher.js";
import { setupTerminalSocket } from "./modules/terminal-socket.js";
import { setupMonitorSocket } from "./modules/monitor-socket.js";
import { HardwareService } from "./services/hardware.service.js";
import { BackupService } from "./services/backup.service.js";
import { ensureStorageRootExists } from "./services/files.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../frontend/dist");
const log = logger.child("server");

async function initDatabase(): Promise<void> {
  log.info("Inicializando base de datos...");
  await waitForPrismaReady();
  getDatabase();
  registerShutdownHandlers();

  const applied = runMigrations();
  if (applied > 0) {
    log.info(`${applied} migracion(es) aplicada(s) correctamente`);
  }
}

async function initStorageRoot(): Promise<void> {
  const storagePath = await ensureStorageRootExists();
  log.info(`Raiz de almacenamiento lista en ${storagePath}`);
}

async function ensureFrontendDistReady(targetFrontendPath: string): Promise<void> {
  const indexPath = path.join(targetFrontendPath, "index.html");
  await fs.access(targetFrontendPath);
  await fs.access(indexPath);
  log.info(`Frontend estatico detectado en ${targetFrontendPath}`);
}

const app = express();
const httpServer = createServer(app);
export const io = new SocketServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(corsErrorHandler);
app.use(express.json({ limit: config.server.jsonLimit }));
app.use(cookieParser());
app.use("/api", apiRouter);

app.get("/health", (_req: Request, res: Response) => {
  res.redirect(301, "/api/health");
});

app.use(express.static(frontendPath));
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

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

process.on("uncaughtException", (error: Error) => {
  log.fatal(`Excepcion no capturada: ${error.message}`);
  if (error.stack) {
    log.fatal(error.stack);
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  log.fatal(`Promesa rechazada sin manejar: ${String(reason)}`);
  process.exit(1);
});

setupTerminalSocket(io);
setupMonitorSocket(io);

function printStartupBanner(): void {
  if (!config.isDev) {
    return;
  }

  const p = config.platform;
  log.debug("HomeVault arrancando en modo desarrollo", {
    host: config.server.host,
    port: config.server.port,
    environment: config.env,
    architecture: p.arch,
    platform: p.os,
    cpuCores: p.cpuCores,
    memoryMB: p.totalMemoryMB,
    memoryTier: p.memoryTier,
    hostname: p.hostname,
    nodeVersion: p.nodeVersion,
    database: config.paths.database,
    remoteMounts: config.paths.remote,
  });
}

async function bootstrap(): Promise<void> {
  try {
    await Promise.all([
      initDatabase(),
      initStorageRoot(),
      ensureFrontendDistReady(frontendPath),
    ]);

    httpServer.listen(config.server.port, () => {
      printStartupBanner();
      log.info("Servidor listo. API disponible en /api/*");

      startSystemWatcher();
      import("./services/ups.service.js").then(({ UpsService }) => {
        UpsService.startMonitoring();
      });

      HardwareService.init();
      BackupService.initScheduler();
    });
  } catch (error: unknown) {
    log.errorWithStack("Arranque abortado. HomeVault no pudo inicializar sus dependencias criticas.", error);
    process.exit(1);
  }
}

void bootstrap();

export default app;
