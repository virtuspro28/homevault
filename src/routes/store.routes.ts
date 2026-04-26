import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { StoreService } from '../services/store.service.js';

const router = Router();

/**
 * GET /api/store/apps
 * Lista catálogo de apps con estado de instalación
 */
router.get('/apps', requireAuth, async (req, res) => {
  try {
    const catalog = await StoreService.getCatalog();
    
    // Obtener estado de instalación de forma segura sin bloquear si Docker falla
    let installedList: string[] = [];
    try {
      installedList = await Promise.race([
        StoreService.getInstalledStatus(),
        new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
    } catch (e) {
      // Ignorar fallo de docker para no bloquear la store
    }

    const appsWithStatus = catalog.map(app => ({
      ...app,
      isInstalled: installedList.includes(app.id.toLowerCase())
    }));

    res.json({ success: true, data: appsWithStatus });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * POST /api/store/install/:id
 * Instala una aplicación del catálogo
 */
router.post('/install/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params["id"] as string;
    await StoreService.installApp(id);
    res.json({ success: true, message: `Instalación de ${id} iniciada correctamente` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
