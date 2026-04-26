import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const execAsync = promisify(exec);
const log = logger.child('update-service');

export const UpdateService = {
  private: {
    repoUrl: 'https://api.github.com/repos/homevault/homevault/commits/main',
    currentVersion: '1.2.5' // Payload de ejemplo, en un sistema real se lee del package.json o git rev-parse
  },

  /**
   * Compara la versión local con el repositorio remoto (GitHub)
   */
  async checkForUpdates(): Promise<{ available: boolean; latestVersion: string; currentVersion: string }> {
    try {
      if (config.platform.isWindows) {
        // Simulación en desarrollo
        return { available: true, latestVersion: '1.2.6', currentVersion: this.private.currentVersion };
      }

      // En RPi, comprobamos el hash de git
      const { stdout: localHash } = await execAsync('git rev-parse HEAD');
      
      // Llamada a la API de GitHub (usamos fetch nativo)
      const response = await fetch(this.private.repoUrl);
      const data: any = await response.json();
      const remoteHash = data.sha;

      const isUpdateAvailable = localHash.trim() !== remoteHash.trim();

      return {
        available: isUpdateAvailable,
        latestVersion: remoteHash.substring(0, 7),
        currentVersion: localHash.trim().substring(0, 7)
      };
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Error comprobando actualizaciones:', errData);
      return { available: false, latestVersion: 'unknown', currentVersion: this.private.currentVersion };
    }
  },

  /**
   * Ejecuta el proceso de actualización (Git pull + Restart)
   */
  async performUpdate(): Promise<void> {
    log.info('Iniciando proceso de actualización OTA...');
    
    if (config.platform.isWindows) {
      log.warn('Actualización OTA no disponible en Windows (Dev Mode)');
      return;
    }

    try {
      // 1. Git pull
      await execAsync('git pull origin main');
      log.info('Git pull completado.');

      // 2. NPM Install (si es necesario)
      // Podríamos comparar el package.json anterior, pero un install rápido es más seguro
      await execAsync('npm install');
      log.info('Dependencias actualizadas.');

      // 3. Reinicio del servicio via Systemd después de 3 segundos
      log.info('Reiniciando servicio en 3 segundos...');
      setTimeout(() => {
        exec('sudo systemctl restart homevault.service');
      }, 3000);

    } catch (error: any) {
      log.error('Fallo en la actualización OTA:', error.message);
      throw new Error(`Error en actualización: ${error.message}`);
    }
  }
};
