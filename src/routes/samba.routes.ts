import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { SambaService } from '../services/samba.service.js';
import { NfsService } from '../services/nfs.js';

const router = Router();

function getMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Error desconocido";
}

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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.get('/protocol/status', async (_req, res) => {
  try {
    const status = await SambaService.getProtocolStatus();
    res.json({ success: true, data: status });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

router.post('/protocol/status', requireAdmin, async (req, res) => {
  try {
    const { protocol, enabled } = req.body as { protocol?: 'smb' | 'nfs'; enabled?: boolean };

    if (protocol !== 'smb' && protocol !== 'nfs') {
      res.status(400).json({ success: false, error: 'Protocolo requerido' });
      return;
    }

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'Estado requerido' });
      return;
    }

    await SambaService.toggleProtocol(protocol, enabled);
    const status = await SambaService.getProtocolStatusByName(protocol);
    res.json({
      success: true,
      data: status,
      message: `${protocol.toUpperCase()} ${enabled ? 'activado' : 'desactivado'} correctamente`,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

/**
 * POST /api/samba/shares/nfs
 * Añade un nuevo recurso compartido NFS
 */
router.post('/shares/nfs', requireAdmin, async (req, res) => {
  try {
    const { path, clients, options } = req.body as { path?: string; clients?: string; options?: string[] };
    if (!path) {
      return res.status(400).json({ success: false, error: 'La ruta es obligatoria' });
    }
    const payload: { path: string; clients?: string; options?: string[] } = { path };
    if (typeof clients === 'string' && clients.trim()) {
      payload.clients = clients;
    }
    if (Array.isArray(options) && options.length > 0) {
      payload.options = options;
    }
    const result = await NfsService.ensureShare(payload);
    res.json({
      success: true,
      data: result,
      message: result.changed ? 'Recurso compartido NFS añadido correctamente' : 'El recurso NFS ya estaba configurado',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

/**
 * POST /api/samba/protocol/toggle
 * Activa o desactiva SMB o NFS
 */
router.post('/protocol/toggle', requireAdmin, async (req, res) => {
  try {
    const { protocol, enabled } = req.body as { protocol?: 'smb' | 'nfs'; enabled?: boolean };

    if (protocol !== 'smb' && protocol !== 'nfs') {
      res.status(400).json({ success: false, error: 'Protocolo requerido' });
      return;
    }

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'Estado requerido' });
      return;
    }

    await SambaService.toggleProtocol(protocol, enabled);
    const status = await SambaService.getProtocolStatusByName(protocol);
    res.json({
      success: true,
      data: status,
      message: `${protocol.toUpperCase()} ${enabled ? 'activado' : 'desactivado'} correctamente`,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getMsg(error) });
  }
});

export default router;
