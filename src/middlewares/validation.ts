/**
 * ═══════════════════════════════════════════════════════════════
 *  HomePiNAS Dashboard — Middleware de Validación
 * ═══════════════════════════════════════════════════════════════
 *
 *  Valida entrada de datos con esquemas seguros.
 *  Previene inyección de SQL, XSS, y otros ataques comunes.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

const log = logger.child("validation-middleware");

// Patrones de validación
const PATTERNS = {
  username: /^[a-zA-Z0-9_\-]{3,32}$/, // 3-32 chars, alphanumeric + _ -
  password: /^.{8,128}$/, // 8-128 chars cualquier caracter
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Email básico
  port: /^(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3})$/, // 1-65535
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/, // IPv4 básico
  hostname: /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/, // Hostname
  domainName: /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/, // Dominio
};

/**
 * Valida que un valor cumpla con un patrón
 */
export function validatePattern(value: string, pattern: keyof typeof PATTERNS): boolean {
  return PATTERNS[pattern].test(value);
}

/**
 * Valida credenciales de login
 */
export function validateLoginCredentials(username: string, password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!username || typeof username !== "string") {
    errors.push("Usuario requerido");
  } else if (!validatePattern(username, "username")) {
    errors.push("Usuario inválido (3-32 caracteres, solo letras, números, - y _)");
  }

  if (!password || typeof password !== "string") {
    errors.push("Contraseña requerida");
  } else if (password.length < 8 || password.length > 128) {
    errors.push("Contraseña debe tener entre 8 y 128 caracteres");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida datos de setup
 */
export function validateSetupData(username: string, password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!username || typeof username !== "string") {
    errors.push("Usuario requerido");
  } else if (!validatePattern(username, "username")) {
    errors.push("Usuario inválido (3-32 caracteres, solo letras, números, - y _)");
  }

  if (!password || typeof password !== "string") {
    errors.push("Contraseña requerida");
  } else if (password.length < 12) {
    errors.push("Contraseña debe tener al menos 12 caracteres para el setup inicial");
  } else if (password.length > 128) {
    errors.push("Contraseña demasiado larga (máx 128 caracteres)");
  }

  // Verificar que no sea una contraseña débil
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumbers) {
    errors.push("Contraseña debe contener mayúsculas, minúsculas y números");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Middleware para validar el body de login
 */
export function validateLoginBody(req: Request, res: Response, next: NextFunction): void {
  try {
    const { username, password } = req.body;
    const validation = validateLoginCredentials(username, password);

    if (!validation.valid) {
      log.warn(`Validación fallida en login: ${validation.errors.join(", ")}`);
      res.status(400).json({ 
        success: false, 
        error: "Credenciales inválidas",
        details: validation.errors 
      });
      return;
    }

    next();
  } catch (error) {
    log.errorWithStack("Error en middleware de validación", error);
    res.status(500).json({ success: false, error: "Error validando entrada" });
  }
}

/**
 * Middleware para validar el body de setup
 */
export function validateSetupBody(req: Request, res: Response, next: NextFunction): void {
  try {
    const { username, password } = req.body;
    const validation = validateSetupData(username, password);

    if (!validation.valid) {
      log.warn(`Validación fallida en setup: ${validation.errors.join(", ")}`);
      res.status(400).json({ 
        success: false, 
        error: "Datos de setup inválidos",
        details: validation.errors 
      });
      return;
    }

    next();
  } catch (error) {
    log.errorWithStack("Error en middleware de validación", error);
    res.status(500).json({ success: false, error: "Error validando entrada" });
  }
}

/**
 * Valida direcciones IP (IPv4 básico)
 */
export function validateIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Valida puertos
 */
export function validatePort(port: unknown): boolean {
  const p = parseInt(String(port), 10);
  return p > 0 && p <= 65535;
}

/**
 * Sanitiza input para prevenir XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Eliminar < y >
    .trim()
    .substring(0, 512); // Limitar tamaño
}

/**
 * Valida que el JSON body no sea demasiado grande
 */
export function validateBodySize(maxBytes: number = 10240): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get("content-length") || "0", 10);
    if (contentLength > maxBytes) {
      log.warn(`Body demasiado grande: ${contentLength} bytes`);
      res.status(413).json({ success: false, error: "Payload demasiado grande" });
      return;
    }
    next();
  };
}
