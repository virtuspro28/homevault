import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const execAsync = promisify(exec);
const log = logger.child('rclone-service');

export interface CloudRemote {
  name: string;
  type: string;
  isMounted: boolean;
  mountPath?: string;
  usage?: {
    total: number;
    used: number;
    free: number;
  };
}

export const RCloneService = {
  /**
   * Obtiene la lista de remotos configurados en rclone
   */
  async getRemotes(): Promise<CloudRemote[]> {
    try {
      if (config.platform.isWindows) {
        // Mock en desarrollo
        return [
          { name: 'GoogleDrive', type: 'drive', isMounted: true, mountPath: '/cloud/drive', usage: { total: 15 * 1024**3, used: 8 * 1024**3, free: 7 * 1024**3 } },
          { name: 'OneDrive', type: 'onedrive', isMounted: false }
        ];
      }

      const { stdout } = await execAsync('rclone config dump');
      const remotesObj = JSON.parse(stdout);
      
      const remotes: CloudRemote[] = [];
      for (const [name, data] of Object.entries(remotesObj as Record<string, any>)) {
        // En un sistema real verificaríamos si está montado via 'df' o tracking interno
        const isMounted = await this.isRemoteMounted(name);
        
        const remote: CloudRemote = {
          name,
          type: data.type,
          isMounted,
        };
        if (isMounted) {
          remote.mountPath = path.join(config.storage.basePath, 'cloud', name);
        }
        remotes.push(remote);
      }

      return remotes;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Error listando remotos:', errData);
      return [];
    }
  },

  /**
   * Verifica si un remoto está montado actualmente
   */
  async isRemoteMounted(name: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('mount');
      return stdout.includes(`rclone:${name}`);
    } catch {
      return false;
    }
  },

  /**
   * Monta un remoto en el sistema de archivos local
   */
  async mountRemote(name: string): Promise<void> {
    const mountPath = path.join(config.storage.basePath, 'cloud', name);
    
    try {
      log.info(`Montando remoto ${name} en ${mountPath}...`);
      
      // 1. Crear directorio de montaje
      await fs.mkdir(mountPath, { recursive: true });

      // 2. Ejecutar comando de montaje en segundo plano
      // --vfs-cache-mode full es recomendado para compatibilidad con apps de streaming
      const mountCmd = `rclone mount ${name}: ${mountPath} --vfs-cache-mode full --daemon`;
      
      await execAsync(mountCmd);
      log.info(`Remoto ${name} montado correctamente.`);
      
    } catch (error: any) {
      log.error(`Fallo al montar remoto ${name}:`, error.message);
      throw new Error(`Error de montaje: ${error.message}`);
    }
  },

  /**
   * Desmonta un remoto
   */
  async unmountRemote(name: string): Promise<void> {
    const mountPath = path.join(config.storage.basePath, 'cloud', name);
    try {
      if (config.platform.isWindows) return;
      await execAsync(`fusermount -u ${mountPath}`);
      log.info(`Remoto ${name} desmontado.`);
    } catch (error: any) {
      log.error(`Error al desmontar ${name}:`, error.message);
    }
  }
};
