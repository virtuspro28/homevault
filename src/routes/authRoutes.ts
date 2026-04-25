import { Router } from "express";
import { login, logout, me, status, setup, initialStatus } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

// Endpoints públicos de Estado Inicial
router.get("/initial-status", initialStatus);
router.get("/status", status);
router.post("/setup", setup);

// Login tradicional
router.post("/login", login);

// Protegidos
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);

export default router;
