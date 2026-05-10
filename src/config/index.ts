/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Configuración Centralizada
 * ═══════════════════════════════════════════════════════════════
 *
 *  Fuente única de verdad para todas las constantes del sistema.
 *  No usa .env parser externo (dotenv) para evitar dependencias.
 *  Lee directamente de process.env con fallbacks seguros.
 *
 *  Decisión de diseño: Objeto inmutable (Object.freeze) para
 *  prevenir modificaciones accidentales en runtime.
 * ═══════════════════════════════════════════════════════════════
 */

import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/* ─── Resolución del directorio raíz del proyecto ─── */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/* ─── Detección de arquitectura ─── */
const arch = os.arch();
const totalMemoryMB = Math.round(os.totalmem() / 1024 / 1024);

/**
 * Umbrales de memoria para optimización automática:
 * - < 512 MB  → "critical" (RPi Zero, RPi 1)
 * - < 1024 MB → "low" (RPi 2, RPi 3 con 1GB)
 * - >= 1024   → "normal" (RPi 4+, Mini PCs, servidores)
 */
type MemoryTier = "critical" | "low" | "normal";
function detectMemoryTier(memMB: number): MemoryTier {
  if (memMB < 512) return "critical";
  if (memMB < 1024) return "low";
  return "normal";
}

/* ─── Tipo de configuración ─── */
export interface AppConfig {
  /** Entorno de ejecución */
  readonly env: "development" | "production";
  readonly isDev: boolean;

  /** Servidor HTTP */
  readonly server: {
    readonly port: number;
    readonly host: string;
    readonly jsonLimit: string;
  };

  /** Rutas del sistema de archivos */
  readonly paths: {
    readonly root: string;
    readonly data: string;
    readonly database: string;
    readonly logs: string;
  };

  /** Configuración del Gestor de Archivos (Fase 10) */
  readonly storage: {
    readonly basePath: string;
  };

  /** Información de plataforma (calculada una vez) */
  readonly platform: {
    readonly arch: string;
    readonly os: NodeJS.Platform;
    readonly isARM: boolean;
    readonly isLinux: boolean;
    readonly isWindows: boolean;
    readonly totalMemoryMB: number;
    readonly memoryTier: MemoryTier;
    readonly cpuCores: number;
    readonly hostname: string;
    readonly nodeVersion: string;
  };

  /** Base de datos SQLite */
  readonly database: {
    /** Tamaño de caché en páginas (-2000 = ~8MB, -500 = ~2MB) */
    readonly cacheSize: number;
    /** Timeout de espera si la DB está bloqueada (ms) */
    readonly busyTimeout: number;
  };

  /** Autenticación */
  readonly auth: {
    readonly jwtSecret: string;
  };

  /** Logger */
  readonly logger: {
    readonly level: "debug" | "info" | "warn" | "error";
    readonly colors: boolean;
  };
}

/* ─── Construcción del objeto de configuración ─── */

const env = process.env["NODE_ENV"] === "production" ? "production" : "development";
const dataDir = process.env["DATA_DIR"] ?? path.join(PROJECT_ROOT, "data");
const storageRoot = process.env["STORAGE_BASE_PATH"] ?? dataDir;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/**
 * Cache de SQLite adaptativo según la memoria disponible.
 * En RPi con poca RAM, reducimos el cache para no competir
 * con el sistema operativo y otros procesos.
 */
const memoryTier = detectMemoryTier(totalMemoryMB);
const sqliteCacheSize = memoryTier === "critical" ? -250    // ~1 MB
  : memoryTier === "low" ? -500     // ~2 MB
  : -2000;  // ~8 MB

export const config: AppConfig = Object.freeze({
  env,
  isDev: env === "development",

  server: Object.freeze({
    port: Number(process.env["PORT"]) || 3000,
    host: process.env["HOST"] ?? "0.0.0.0",
    jsonLimit: "1mb",
  }),

  paths: Object.freeze({
    root: PROJECT_ROOT,
    data: dataDir,
    database: path.join(dataDir, "homevault.db"),
    logs: path.join(dataDir, "logs"),
  }),

  storage: Object.freeze({
    basePath: storageRoot,
  }),

  platform: Object.freeze({
    arch,
    os: os.platform(),
    isARM: arch === "arm" || arch === "arm64",
    isLinux: os.platform() === "linux",
    isWindows: os.platform() === "win32",
    totalMemoryMB,
    memoryTier,
    cpuCores: os.cpus().length,
    hostname: os.hostname(),
    nodeVersion: process.version,
  }),

  database: Object.freeze({
    cacheSize: sqliteCacheSize,
    busyTimeout: 5000,
  }),

  auth: Object.freeze({
    jwtSecret: requireEnv("JWT_SECRET"),
  }),

  logger: Object.freeze({
    level: (process.env["LOG_LEVEL"] as AppConfig["logger"]["level"]) ?? (env === "development" ? "debug" : "info"),
    colors: env === "development",
  }),
});
