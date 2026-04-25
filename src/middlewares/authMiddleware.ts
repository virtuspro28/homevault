import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth.js";
import { logger } from "../utils/logger.js";

const log = logger.child("auth-middleware");

// Extendemos Express Request para inyectar el usuario validado de forma nativa
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; role: string };
    }
  }
}

/**
 * Middleware para bloquear el acceso sin autenticación.
 * Verifica la existencia de la cookie HttpOnly e integridad del JWT.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.cookies?.["jwt"];

    if (!token) {
      log.warn(`Acceso denegado. No hay cookie [IP: ${req.ip}]`);
      res.status(401).json({ success: false, error: "No autorizado. Por favor haz login." });
      return;
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded["id"]) {
      log.warn(`Intento de acceso con token inválido [IP: ${req.ip}]`);
      res.clearCookie("jwt");
      res.status(401).json({ success: false, error: "Sesión inválida o expirada." });
      return;
    }

    // El token ahora incluye el rol
    req.user = {
      id: decoded["id"] as string,
      username: decoded["username"] as string,
      role: decoded["role"] as string,
    };

    next();
  } catch (error) {
    log.errorWithStack("Error inesperado en authMiddleware", error);
    res.status(500).json({ success: false, error: "Error interno verificando la sesión" });
  }
}

/**
 * Middleware para restringir acceso solo a administradores.
 * Debe usarse DESPUÉS de requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "ADMIN") {
    log.warn(`Acceso administrativo denegado para: ${req.user?.username || "Desconocido"} [IP: ${req.ip}]`);
    res.status(403).json({ success: false, error: "Acceso denegado. Se requieren permisos de Administrador." });
    return;
  }
  next();
}

/**
 * Middleware para restringir acceso solo al Propietario (OWNER).
 * El rol OWNER tiene privilegios absolutos sobre configuraciones del sistema.
 */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "OWNER") {
    log.warn(`Acceso restringido (OWNER REQ) denegado para: ${req.user?.username || "Desconocido"}`);
    res.status(403).json({ success: false, error: "Acceso denegado. Se requieren permisos de Propietario (OWNER)." });
    return;
  }
  next();
}
