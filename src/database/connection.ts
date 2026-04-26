/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Conexión SQLite
 * ═══════════════════════════════════════════════════════════════
 *
 *  Gestiona la conexión singleton a better-sqlite3.
 *
 *  Decisiones clave:
 *  1. WAL mode: Reduce escrituras secuenciales en SD/eMMC (crítico en RPi)
 *  2. synchronous=NORMAL: Balance entre seguridad y rendimiento
 *  3. Cache adaptativo: Ajusta tamaño según memoria disponible (config)
 *  4. Lazy initialization: No abre la DB hasta que se necesite
 *  5. Cierre limpio en SIGINT/SIGTERM para evitar corrupción
 * ═══════════════════════════════════════════════════════════════
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const log = logger.child("database");

/** Instancia singleton de la base de datos */
let db: BetterSqlite3.Database | null = null;

/**
 * Asegura que el directorio de datos exista.
 * Crea la ruta completa recursivamente si no existe.
 */
function ensureDataDirectory(): void {
  const dir = path.dirname(config.paths.database);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info(`Directorio de datos creado: ${dir}`);
  }
}

/**
 * Aplica PRAGMAs de optimización a la conexión SQLite.
 *
 * Cada PRAGMA está documentado con su propósito específico
 * y su impacto en hardware ARM con almacenamiento lento.
 */
function applyPragmas(database: BetterSqlite3.Database): void {
  /**
   * WAL (Write-Ahead Logging):
   * En vez de escribir directamente al archivo .db, escribe a un log.
   * Esto permite lecturas concurrentes sin bloqueo y reduce la
   * fragmentación en tarjetas SD (que tienen ciclos de escritura limitados).
   */
  database.pragma("journal_mode = WAL");

  /**
   * synchronous = NORMAL:
   * - FULL: Cada escritura se sincroniza a disco (más seguro, más lento)
   * - NORMAL: Solo sincroniza en puntos críticos (buen balance)
   * - OFF: No sincroniza (rápido pero riesgo de corrupción en corte de luz)
   *
   * NORMAL es ideal para NAS doméstico: protege contra corrupción
   * en la mayoría de casos sin penalizar el rendimiento en SD/eMMC.
   */
  database.pragma("synchronous = NORMAL");

  /**
   * Cache adaptativo según la memoria del sistema.
   * Valores negativos = tamaño en KiB (ej: -2000 = ~2MB de caché).
   * En RPi con 512MB usamos menos cache para dejar RAM al SO.
   */
  database.pragma(`cache_size = ${config.database.cacheSize}`);

  /**
   * Timeout cuando la DB está bloqueada por otra operación.
   * 5000ms es generoso pero evita deadlocks en operaciones largas.
   */
  database.pragma(`busy_timeout = ${config.database.busyTimeout}`);

  /**
   * Integridad referencial con foreign keys.
   * Desactivada por defecto en SQLite; la activamos explícitamente.
   */
  database.pragma("foreign_keys = ON");

  /**
   * Almacenar strings temporales en memoria (no en disco).
   * Mejora rendimiento de queries con ORDER BY y GROUP BY.
   */
  database.pragma("temp_store = MEMORY");

  log.debug("PRAGMAs aplicados", {
    journal_mode: String(database.pragma("journal_mode", { simple: true })),
    synchronous: String(database.pragma("synchronous", { simple: true })),
    cache_size: String(database.pragma("cache_size", { simple: true })),
    foreign_keys: String(database.pragma("foreign_keys", { simple: true })),
  });
}

/**
 * Inicializa y devuelve la conexión singleton a SQLite.
 *
 * Patrón Lazy Singleton: La DB no se abre hasta la primera llamada.
 * Las llamadas posteriores devuelven la misma instancia.
 *
 * @throws {Error} Si no se puede crear/abrir la base de datos
 */
export function getDatabase(): BetterSqlite3.Database {
  if (db !== null) return db;

  ensureDataDirectory();

  log.info(`Abriendo base de datos: ${config.paths.database}`);

  try {
    db = new Database(config.paths.database, {
      /**
       * verbose en desarrollo: loguea cada query SQL ejecutada.
       * Desactivado en producción para no saturar los logs.
       */
      verbose: config.isDev
        ? (message?: unknown) => log.debug(`SQL: ${String(message ?? "")}`)
        : undefined,
    });

    applyPragmas(db);

    log.info("Base de datos inicializada correctamente", {
      path: config.paths.database,
      memoryTier: config.platform.memoryTier,
      cacheSize: config.database.cacheSize,
    });

    return db;
  } catch (error: unknown) {
    log.errorWithStack("Error fatal al abrir la base de datos", error);
    throw error;
  }
}

/**
 * Cierra la conexión a la base de datos de forma limpia.
 * Ejecuta un CHECKPOINT para sincronizar el WAL antes de cerrar.
 *
 * Llamado automáticamente en SIGINT/SIGTERM (ver registerShutdown).
 */
export function closeDatabase(): void {
  if (db === null) return;

  try {
    // Forzar checkpoint WAL antes de cerrar para no perder datos
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    db = null;
    log.info("Base de datos cerrada correctamente");
  } catch (error: unknown) {
    log.errorWithStack("Error al cerrar la base de datos", error);
  }
}

/**
 * Registra handlers de cierre limpio.
 * Debe llamarse una vez al arrancar el servidor.
 *
 * En RPi, un SIGTERM puede venir de systemd al reiniciar el servicio.
 * Sin este handler, la DB podría quedar con el WAL sin sincronizar.
 */
export function registerShutdownHandlers(): void {
  const shutdown = (signal: string): void => {
    log.warn(`Señal ${signal} recibida. Cerrando base de datos...`);
    closeDatabase();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  log.debug("Handlers de cierre limpio registrados (SIGINT, SIGTERM)");
}
