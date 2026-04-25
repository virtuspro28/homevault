import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { RCloneService } from '../services/rclone.service.js';

const router = Router();

/**
 * GET /api/cloud/remotes
 */
router.get('/remotes', requireAuth, async (req, res) => {
  try {
    const remotes = await RCloneService.getRemotes();
    res.json({ success: true, data: remotes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cloud/mount/:name
 */
router.post('/mount/:name', requireAuth, async (req, res) => {
  try {
    const name = req.params["name"] as string;
    await RCloneService.mountRemote(name);
    res.json({ success: true, message: `Remoto ${name} montado correctamente` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/cloud/mount/:name
 */
router.delete('/mount/:name', requireAuth, async (req, res) => {
  try {
    const name = req.params["name"] as string;
    await RCloneService.unmountRemote(name);
    res.json({ success: true, message: `Remoto ${name} desmontado` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
