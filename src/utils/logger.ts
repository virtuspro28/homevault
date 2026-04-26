/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Logger Estructurado
 * ═══════════════════════════════════════════════════════════════
 *
 *  Logger propio ultra-ligero. No usa winston, pino ni bunyan.
 *  En una RPi con 512MB de RAM, cada dependencia cuenta.
 *
 *  Características:
 *  - Niveles: debug, info, warn, error, fatal
 *  - Colores ANSI en desarrollo (desactivables)
 *  - Sub-loggers con contexto de módulo via .child("nombre")
 *  - Sin buffering: escribe directo a stdout/stderr
 *  - Mínimo overhead de memoria
 * ═══════════════════════════════════════════════════════════════
 */

import { config } from "../config/index.js";

/* ─── Niveles de log con prioridad numérica ─── */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

/* ─── Códigos ANSI para colores en terminal ─── */
const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  // Colores por nivel
  debug: "\x1b[36m",   // cyan
  info: "\x1b[32m",    // verde
  warn: "\x1b[33m",    // amarillo
  error: "\x1b[31m",   // rojo
  fatal: "\x1b[41m\x1b[37m", // fondo rojo, texto blanco
} as const;

/* ─── Iconos por nivel (mejora legibilidad en terminal) ─── */
const ICONS: Record<LogLevel, string> = {
  debug: "🔍",
  info: "ℹ️ ",
  warn: "⚠️ ",
  error: "❌",
  fatal: "💀",
} as const;

/**
 * Formatea un timestamp ISO compacto.
 * Usa formato HH:MM:SS.mmm en dev (más legible) e ISO completo en prod.
 */
function formatTimestamp(): string {
  const now = new Date();
  if (config.isDev) {
    return now.toLocaleTimeString("es-ES", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`;
  }
  return now.toISOString();
}

/**
 * Colorea texto si los colores están activados.
 */
function colorize(text: string, color: string): string {
  if (!config.logger.colors) return text;
  return `${color}${text}${COLORS.reset}`;
}

/**
 * Clase Logger.
 * Cada instancia tiene un módulo de contexto opcional.
 * Se crean sub-loggers con .child("módulo").
 */
class Logger {
  private readonly module: string | null;
  private readonly minLevel: number;

  constructor(module: string | null = null) {
    this.module = module;
    this.minLevel = LOG_LEVELS[config.logger.level];
  }

  /**
   * Crea un sub-logger con contexto de módulo.
   * Ejemplo: logger.child("database") → logs con prefijo [DATABASE]
   */
  child(module: string): Logger {
    return new Logger(module);
  }

  /**
   * Método interno que formatea y escribe el mensaje.
   * Escribe a stdout para debug/info, stderr para warn/error/fatal.
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Filtrar por nivel mínimo configurado
    if (LOG_LEVELS[level] < this.minLevel) return;

    const timestamp = formatTimestamp();
    const levelTag = level.toUpperCase().padEnd(5);
    const moduleTag = this.module ? `[${this.module.toUpperCase()}]` : "";

    // Construir línea de log
    let line: string;
    if (config.logger.colors) {
      const coloredLevel = colorize(levelTag, COLORS[level]);
      const coloredTimestamp = colorize(timestamp, COLORS.dim);
      const coloredModule = moduleTag ? colorize(` ${moduleTag}`, COLORS.dim) : "";
      line = `${coloredTimestamp} ${ICONS[level]} ${coloredLevel}${coloredModule} ${message}`;
    } else {
      line = `${timestamp} [${levelTag}]${moduleTag ? ` ${moduleTag}` : ""} ${message}`;
    }

    // Datos adicionales (solo si existen)
    if (data !== undefined && Object.keys(data).length > 0) {
      line += ` ${JSON.stringify(data)}`;
    }

    // Escribir al stream correcto
    if (LOG_LEVELS[level] >= LOG_LEVELS.warn) {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    this.log("fatal", message, data);
  }

  /**
   * Helper para loguear errores con stack trace.
   * Extrae el mensaje y stack del Error de forma segura.
   */
  errorWithStack(message: string, error: unknown): void {
    if (error instanceof Error) {
      this.error(message, {
        error: error.message,
        stack: error.stack ?? "sin stack",
      });
    } else {
      this.error(message, { error: String(error) });
    }
  }
}

/**
 * Logger raíz exportado.
 * Uso directo: logger.info("mensaje")
 * Sub-logger: const dbLog = logger.child("database"); dbLog.info("conectado")
 */
export const logger = new Logger();
