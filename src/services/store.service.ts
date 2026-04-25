import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { io } from '../index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { getContainers } from './docker.service.js';
import { NotificationService } from './notification.service.js';
import { appInventory, AppInventoryItem } from '../data/appInventory.js';

const execAsync = promisify(exec);
const log = logger.child('store-service');

export const StoreService = {
  /**
   * Lee el catálogo de aplicaciones desde el archivo TypeScript
   */
  async getCatalog(): Promise<AppInventoryItem[]> {
    return appInventory;
  },

  /**
   * Verifica si una aplicación está instalada (basado en el nombre del contenedor)
   */
  async getInstalledStatus() {
    const containers = await getContainers();
    return containers.map(c => c.name.toLowerCase().replace(/^\//, ''));
  },

  /**
   * Despliega una aplicación usando docker run
   */
  async deployApp(appId: string): Promise<void> {
    const app = appInventory.find(a => a.id === appId);
    if (!app) throw new Error(`Aplicación ${appId} no encontrada.`);

    // Ruta de persistencia: /mnt/storage/appdata/[nombre-app]
    const appDataPath = path.join(config.storage.basePath, 'appdata', app.id);
    
    try {
      // 1. Crear directorio de persistencia
      log.info(`Creando directorio de persistencia en: ${appDataPath}`);
      await fs.mkdir(appDataPath, { recursive: true });

      // 2. Construir comando docker run
      const portMapping = app.ports.map(p => `-p ${p}`).join(' ');
      const envMapping = Object.entries(app.env || {})
        .map(([k, v]) => `-e ${k}="${v}"`)
        .join(' ');
      
      const dockerCmd = [
        'docker run -d',
        `--name ${app.id}`,
        '--restart unless-stopped',
        `-v "${appDataPath}:/config"`,
        `-e PUID=1000 -e PGID=1000`,
        portMapping,
        envMapping,
        app.image
      ].filter(Boolean).join(' ');

      log.info(`Ejecutando despliegue: ${dockerCmd}`);
      
      // 3. Ejecutar con spawn para streaming de logs
      const child = spawn(dockerCmd, [], { shell: true });

      child.stdout?.on('data', (data: Buffer) => {
        const line = data.toString();
        log.info(`[BUILD:${appId}] ${line.trim()}`);
        io.emit(`app:install:log:${appId}`, { stream: 'stdout', text: line });
      });

      child.stderr?.on('data', (data: Buffer) => {
        const line = data.toString();
        log.warn(`[BUILD:${appId}] ${line.trim()}`);
        io.emit(`app:install:log:${appId}`, { stream: 'stderr', text: line });
      });

      await new Promise<boolean>((resolve, reject) => {
        child.on('close', (code: number | null) => {
          if (code === 0) resolve(true);
          else reject(new Error(`Docker falló con código ${code}`));
        });
      });

      log.info(`${app.name} desplegado correctamente.`);

      // 4. Notificar éxito
      await NotificationService.sendAlert(
        `🚀 INSTALACIÓN COMPLETADA\n\nLa aplicación <b>${app.name}</b> se ha desplegado correctamente y ya está en ejecución.`,
        'INFO'
      );
      
    } catch (error: any) {
      log.error(`Error desplegando ${appId}:`, error);
      // Si el error es que el contenedor ya existe, informamos pero no lanzamos excepción crítica
      if (error.message.includes('already in use')) {
        throw new Error(`El contenedor '${app.id}' ya existe o el puerto está ocupado.`);
      }
      throw new Error(`Fallo en el despliegue: ${error.message}`);
    }
  },

  /**
   * Alias para mantener compatibilidad si se requiere (legacy)
   */
  async installApp(appId: string): Promise<void> {
    return this.deployApp(appId);
  }
};
