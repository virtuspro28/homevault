/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Sistema de Migraciones SQLite
 * ═══════════════════════════════════════════════════════════════
 *
 *  Sistema de migraciones versionado y transaccional.
 *  Cada migración se ejecuta en una transacción atómica:
 *  si falla una, se hace rollback completo sin dejar la DB rota.
 *
 *  Las migraciones son idempotentes: se puede re-ejecutar
 *  runMigrations() sin riesgo de duplicar cambios.
 * ═══════════════════════════════════════════════════════════════
 */

import type BetterSqlite3 from "better-sqlite3";
import { getDatabase } from "./connection.js";
import { logger } from "../utils/logger.js";

const log = logger.child("migrations");

/* ─── Definición de una migración ─── */
interface Migration {
  /** Versión secuencial (1, 2, 3...). Debe ser única y ascendente. */
  readonly version: number;
  /** Descripción legible para logs */
  readonly description: string;
  /** SQL de aplicación (up) */
  readonly up: string;
}

/* ─── Registro de migraciones ─── */
/**
 * TODAS las migraciones se definen aquí, en orden ascendente.
 * Para añadir una nueva migración en el futuro:
 * 1. Añadir un objeto al final del array con version = último + 1
 * 2. Escribir el SQL en `up`
 * 3. Reiniciar el servidor (las migraciones se aplican al arrancar)
 */
const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: "Tabla de configuración clave-valor",
    up: `
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Valores iniciales del sistema
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('app.version', '1.0.0'),
        ('app.name', 'HomeVault Dashboard'),
        ('setup.completed', 'false');
    `,
  },
  {
    version: 2,
    description: "Tabla de sesiones de usuario",
    up: `
      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );

      -- Índice para limpieza de sesiones expiradas
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `,
  },
  {
    version: 3,
    description: "Tabla de log de eventos del sistema",
    up: `
      CREATE TABLE IF NOT EXISTS system_events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        type       TEXT NOT NULL CHECK(type IN ('info', 'warn', 'error', 'security')),
        message    TEXT NOT NULL,
        metadata   TEXT,  -- JSON con datos extra opcionales
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Índice para consultas por tipo y fecha
      CREATE INDEX IF NOT EXISTS idx_events_type_date ON system_events(type, created_at);
    `,
  },
] as const;

/**
 * Crea la tabla interna de tracking de migraciones si no existe.
 * Esta tabla registra qué migraciones se han aplicado y cuándo.
 */
function ensureMigrationsTable(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version     INTEGER PRIMARY KEY NOT NULL,
      description TEXT NOT NULL,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Obtiene la versión más alta ya aplicada.
 * Retorna 0 si no hay migraciones aplicadas.
 */
function getCurrentVersion(db: BetterSqlite3.Database): number {
  const row = db.prepare(
    "SELECT MAX(version) as version FROM _migrations"
  ).get() as { version: number | null } | undefined;

  return row?.version ?? 0;
}

/**
 * Ejecuta todas las migraciones pendientes.
 *
 * Proceso:
 * 1. Crea la tabla _migrations si no existe
 * 2. Determina la versión actual
 * 3. Filtra migraciones con versión > actual
 * 4. Ejecuta cada una en una transacción individual
 * 5. Registra la migración aplicada en _migrations
 *
 * @returns Número de migraciones aplicadas
 */
export function runMigrations(): number {
  const db = getDatabase();

  ensureMigrationsTable(db);

  const currentVersion = getCurrentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    log.info(`Base de datos actualizada (v${currentVersion}). Sin migraciones pendientes.`);
    return 0;
  }

  log.info(`${pending.length} migración(es) pendiente(s). Versión actual: v${currentVersion}`);

  let applied = 0;

  for (const migration of pending) {
    log.info(`Aplicando migración v${migration.version}: ${migration.description}...`);

    /**
     * Transacción atómica para cada migración.
     * Si el SQL falla, se revierte todo y se lanza error.
     * Esto previene estados intermedios corruptos.
     */
    const applyMigration = db.transaction(() => {
      // Ejecutar el SQL de la migración
      db.exec(migration.up);

      // Registrar en la tabla de tracking
      db.prepare(
        "INSERT INTO _migrations (version, description) VALUES (?, ?)"
      ).run(migration.version, migration.description);
    });

    try {
      applyMigration();
      applied++;
      log.info(`✅ Migración v${migration.version} aplicada correctamente`);
    } catch (error: unknown) {
      log.errorWithStack(
        `Error al aplicar migración v${migration.version}: ${migration.description}`,
        error
      );
      throw error; // Re-throw para detener el arranque
    }
  }

  const finalVersion = getCurrentVersion(db);
  log.info(`Migraciones completadas. Versión actual: v${finalVersion}`);

  return applied;
}
