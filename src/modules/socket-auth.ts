import type { Namespace, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const log = logger.child("socket-auth");

export interface SocketUser {
  id: string;
  username: string;
  role: string;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, chunk) => {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    if (!rawKey || rawValue.length === 0) {
      return acc;
    }

    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

function getHandshakeToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth["token"];
  if (typeof authToken === "string" && authToken.length > 0) {
    return authToken;
  }

  const queryToken = socket.handshake.query["token"];
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }

  const cookies = parseCookies(socket.handshake.headers.cookie);
  return cookies["jwt"] ?? null;
}

export function attachSocketAuth(namespace: Namespace, adminOnly: boolean): void {
  namespace.use((socket, next) => {
    const token = getHandshakeToken(socket);

    if (!token) {
      log.warn(`Socket sin token/cookie en namespace ${namespace.name}`);
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      if (typeof decoded !== "object" || decoded === null) {
        return next(new Error("Authentication error: Invalid token"));
      }

      const user: SocketUser = {
        id: String(decoded["id"] ?? ""),
        username: String(decoded["username"] ?? ""),
        role: String(decoded["role"] ?? ""),
      };

      if (!user.id || !user.username || !user.role) {
        return next(new Error("Authentication error: Invalid token"));
      }

      if (adminOnly && user.role !== "ADMIN" && user.role !== "OWNER") {
        log.warn(`Usuario ${user.username} intentó acceder a ${namespace.name} sin permisos`);
        return next(new Error("Security error: Admin role required"));
      }

      socket.data.user = user;
      next();
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      log.error(`Fallo de validación JWT en ${namespace.name}: ${errMessage}`);
      next(new Error("Authentication error: Invalid token"));
    }
  });
}
