import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const log = logger.child("prisma");
const RETRY_DELAY_MS = 2_000;
const RETRY_ATTEMPTS = 5;

declare global {
  // eslint-disable-next-line no-var
  var __homevaultPrisma__: PrismaClient | undefined;
}

export const prisma = globalThis.__homevaultPrisma__ ?? new PrismaClient();

if (!globalThis.__homevaultPrisma__) {
  globalThis.__homevaultPrisma__ = prisma;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureDatabaseDirectory(): Promise<void> {
  await fs.mkdir(path.dirname(config.paths.database), { recursive: true });
}

async function logDatabaseFileState(): Promise<void> {
  try {
    const stats = await fs.stat(config.paths.database);
    log.info(`SQLite detectada en ${config.paths.database} (${stats.size} bytes)`);
  } catch {
    log.warn(`SQLite todavia no existe en ${config.paths.database}; se creara al inicializar Prisma.`);
  }
}

export async function waitForPrismaReady(attempts = RETRY_ATTEMPTS): Promise<void> {
  await ensureDatabaseDirectory();
  await logDatabaseFileState();

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      log.info(`Prisma operativo en el intento ${attempt}/${attempts}`);
      return;
    } catch (error: unknown) {
      lastError = error;
      log.warn(
        `Prisma aun no esta listo (intento ${attempt}/${attempts}): ${error instanceof Error ? error.message : String(error)}`,
      );

      if (attempt < attempts) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error
    ? new Error(`No se pudo inicializar Prisma tras ${attempts} intentos: ${lastError.message}`)
    : new Error(`No se pudo inicializar Prisma tras ${attempts} intentos.`);
}

