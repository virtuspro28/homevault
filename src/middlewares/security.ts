/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Módulo de Seguridad Perimetral
 * ═══════════════════════════════════════════════════════════════
 *
 *  Responsabilidades:
 *  1. Helmet con política CSP estricta (defensa contra XSS, clickjacking, etc.)
 *  2. CORS dinámico: solo permite orígenes de redes locales (RFC 1918)
 *     y dominios .local / localhost. Rechaza cualquier otro origen.
 *
 *  Decisión de diseño: No usamos un wildcard "*" en CORS porque este
 *  dashboard está pensado EXCLUSIVAMENTE para acceso en red local.
 *  Un atacante externo que logre redirigir tráfico no podrá hacer
 *  peticiones cross-origin al panel.
 * ═══════════════════════════════════════════════════════════════
 */

import helmet from "helmet";
import cors from "cors";
import type { Request, Response, NextFunction, RequestHandler } from "express";

/* ─── Rangos de red local (RFC 1918 + link-local + loopback) ─── */
const LOCAL_NETWORK_PATTERNS: readonly RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,                    // localhost con cualquier puerto
  /^https?:\/\/127\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/, // loopback IPv4
  /^https?:\/\/\[::1\](:\d+)?$/,                     // loopback IPv6
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,  // clase C privada
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/, // clase A privada
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/, // clase B privada
  /^https?:\/\/[a-zA-Z0-9-]+\.local(:\d+)?$/,        // mDNS / dominios .local
] as const;

/**
 * Valida si un origen pertenece a una red local permitida.
 * Retorna `true` solo para orígenes que coincidan con los patrones RFC 1918.
 */
function isLocalNetworkOrigin(origin: string): boolean {
  return LOCAL_NETWORK_PATTERNS.some((pattern) => pattern.test(origin));
}

/* ─── Configuración de Helmet (CSP estricta) ─── */
export const helmetMiddleware: RequestHandler = helmet({
  /**
   * Content-Security-Policy: solo permite recursos del mismo origen.
   * En fases futuras se puede relajar para CDNs específicos de fuentes/estilos.
   */
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // inline necesario para estilos dinámicos del dashboard
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],             // impide que el dashboard sea embebido en iframes
      upgradeInsecureRequests: [],
    },
  },
  /* Previene que el navegador infiera MIME types incorrectos */
  crossOriginEmbedderPolicy: false, // desactivado para compatibilidad con recursos locales
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

/* ─── Configuración de CORS dinámica ─── */
export const corsMiddleware: RequestHandler = cors({
  /**
   * Función de validación dinámica de origen.
   *
   * - Sin origen (peticiones server-to-server, curl, apps móviles): permitido.
   * - Origen de red local: permitido.
   * - Cualquier otro origen: rechazado con error explícito.
   */
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Peticiones sin origen (curl, Postman, apps nativas, mismo servidor)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (isLocalNetworkOrigin(origin)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          `[CORS] Origen bloqueado: "${origin}" — Solo se permiten accesos desde redes locales.`
        )
      );
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600, // cache de preflight: 10 minutos (reduce peticiones OPTIONS en clientes)
});

/**
 * Middleware de manejo de errores CORS.
 * Captura los rechazos del middleware cors y devuelve un 403 limpio
 * en lugar de dejar que Express muestre un stack trace.
 */
export function corsErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err.message.includes("[CORS]")) {
    res.status(403).json({
      success: false,
      error: err.message,
    });
    return;
  }
  next(err);
}
