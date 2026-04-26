import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword, generateToken } from "../utils/auth.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { LoggerService } from "../services/logger.service.js";

const prisma = new PrismaClient();
const log = logger.child("auth-controller");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.env === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  domain: undefined,
};

async function getInitialStatusPayload() {
  const userCount = await prisma.user.count();

  return {
    success: true,
    initialized: userCount > 0,
    userCount,
  };
}

export async function initialStatus(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await getInitialStatusPayload());
  } catch (error) {
    log.errorWithStack("Error verificando estado inicial", error);
    res.status(500).json({ success: false, error: "Error consultando estado inicial" });
  }
}

export async function status(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await getInitialStatusPayload());
  } catch (error) {
    log.errorWithStack("Error verificando estado de auth", error);
    res.status(500).json({ success: false, error: "Error consultando estado inicial" });
  }
}

export async function setup(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: "Usuario y contraseña requeridos" });
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
      res.status(400).json({
        success: false,
        error: "Usuario inválido: debe tener 3-32 caracteres (letras, números, - y _)",
      });
      return;
    }

    if (password.length < 4 || password.length > 128) {
      res.status(400).json({
        success: false,
        error: "Contraseña debe tener entre 4 y 128 caracteres",
      });
      return;
    }


    const count = await prisma.user.count();
    if (count > 0) {
      log.warn("[SECURITY] Intento de setup con sistema ya configurado");
      res.status(403).json({ success: false, error: "El sistema NAS ya ha sido configurado" });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      res.status(409).json({ success: false, error: "Usuario ya existe" });
      return;
    }

    const hashed = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashed,
        role: "OWNER",
      },
    });

    log.info(`Administrador OWNER configurado: ${newUser.username}`);

    await LoggerService.log({
      message: `Sistema configurado con usuario OWNER: ${newUser.username}`,
      level: "INFO",
      category: "SECURITY",
    });

    res.status(201).json({
      success: true,
      message: "Cuenta maestra configurada con éxito",
      data: { username: newUser.username, role: "OWNER" },
    });
  } catch (error) {
    log.errorWithStack("Error configurando nodo", error);
    res.status(500).json({ success: false, error: "Fallo durante el Setup" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string" || !password || typeof password !== "string") {
      res.status(400).json({ success: false, error: "Usuario y contraseña requeridos." });
      return;
    }

    if (username.length > 32 || password.length > 128) {
      res.status(400).json({ success: false, error: "Credenciales inválidas." });
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || "0.0.0.0";
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      log.warn(`[SECURITY] Failed login attempt from IP: ${clientIp} (User ${username} not found)`);
      await LoggerService.log({
        message: `Intento de acceso fallido: Usuario '${username}' no encontrado desde IP ${clientIp}`,
        level: "WARNING",
        category: "SECURITY",
      });
      res.status(401).json({ success: false, error: "Credenciales incorrectas." });
      return;
    }

    const isMatch = await verifyPassword(password, user.password);

    if (!isMatch) {
      log.warn(`[SECURITY] Failed login attempt from IP: ${clientIp} (Wrong password for ${username})`);
      await LoggerService.log({
        message: `Contraseña incorrecta para el usuario '${username}' desde IP ${clientIp}`,
        level: "WARNING",
        category: "SECURITY",
      });
      res.status(401).json({ success: false, error: "Credenciales incorrectas." });
      return;
    }

    const token = generateToken(user.id, user.username, user.role);
    const cookieOptions = { ...COOKIE_OPTIONS };
    if (config.env === "production") {
      cookieOptions.secure = true;
    }

    res.cookie("jwt", token, cookieOptions);

    await LoggerService.log({
      message: `Usuario '${username}' ha iniciado sesión correctamente desde IP ${clientIp}`,
      level: "INFO",
      category: "SECURITY",
    });

    log.info(`Acceso concedido a: ${username}`);
    res.status(200).json({
      success: true,
      data: {
        username: user.username,
        role: user.role,
        id: user.id,
      },
    });
  } catch (error) {
    log.errorWithStack("Error procesando login", error);
    res.status(500).json({ success: false, error: "Error en el servidor." });
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie("jwt", COOKIE_OPTIONS);
  res.status(200).json({ success: true, message: "Sesión cerrada." });
}

export function me(req: Request, res: Response): void {
  res.status(200).json({ success: true, data: req.user });
}
