import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { UserService } from '../services/user.service.js';

const router = Router();

// Todas las rutas de usuarios requieren estar autenticado
router.use(requireAuth);

/**
 * GET /api/users
 * Lista todos los usuarios (Solo Admin)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await UserService.listUsers();
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users
 * Crea un nuevo usuario (Solo Admin)
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, password, role, storageQuota } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Usuario y contraseña son obligatorios' });
    }
    const user = await UserService.createUser({ username, password, role, storageQuota });
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/users/:id
 * Actualiza permisos o cuota (Solo Admin)
 */
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { role, storageQuota } = req.body;
    const user = await UserService.updatePermissions(req.params["id"] as string, { role, storageQuota });
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Restablece contraseña (Solo Admin)
 */
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'La nueva contraseña es obligatoria' });
    }
    await UserService.resetPassword(req.params["id"] as string, password);
    res.json({ success: true, message: 'Contraseña restablecida correctamente' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/users/:id
 * Elimina un usuario (Solo Admin)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await UserService.deleteUser(req.params["id"] as string);
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
