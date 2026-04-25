import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { SambaService } from '../services/samba.service.js';

const router = Router();

// Todas las rutas de Samba requieren autenticación
router.use(requireAuth);

/**
 * GET /api/samba/shares
 * Lista todos los recursos compartidos definidos
 */
router.get('/shares', async (req, res) => {
  try {
    const shares = await SambaService.listShares();
    res.json({ success: true, data: shares });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/samba/shares
 * Añade un nuevo recurso compartido Samba
 */
router.post('/shares', requireAdmin, async (req, res) => {
  try {
    const { name, path, readOnly } = req.body;
    if (!name || !path) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios (nombre, ruta)' });
    }
    await SambaService.addShare({ name, path, readOnly });
    res.json({ success: true, message: 'Recurso compartido Samba añadido correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/samba/shares/nfs
 * Añade un nuevo recurso compartido NFS
 */
router.post('/shares/nfs', requireAdmin, async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ success: false, error: 'La ruta es obligatoria' });
    }
    await SambaService.addNFSShare(path);
    res.json({ success: true, message: 'Recurso compartido NFS añadido correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/samba/protocol/toggle
 * Activa o desactiva SMB o NFS
 */
router.post('/protocol/toggle', requireAdmin, async (req, res) => {
  try {
    const { protocol, enabled } = req.body;
    if (!protocol) return res.status(400).json({ success: false, error: 'Protocolo requerido' });
    
    await SambaService.toggleProtocol(protocol, enabled);
    res.json({ success: true, message: `${protocol.toUpperCase()} ${enabled ? 'activado' : 'desactivado'} correctamente` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/samba/shares/:name
 * Elimina un recurso compartido
 */
router.delete('/shares/:name', requireAdmin, async (req, res) => {
  try {
    const name = req.params["name"] as string;
    await SambaService.deleteShare(name);
    res.json({ success: true, message: 'Recurso compartido eliminado correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
