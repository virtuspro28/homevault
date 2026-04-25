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
    try {
      return appInventory;
    } catch (error: any) {
      log.errorWithStack("Error obteniendo catálogo", error);
      throw new Error("No se pudo cargar el catálogo de aplicaciones");
    }
  },

  /**
   * Verifica si una aplicación está instalada (basado en el nombre del contenedor)
   */
  async getInstalledStatus(): Promise<string[]> {
    try {
      const containers = await getContainers();
      return containers.map(c => {
        const name = c.name || '';
        return name.toLowerCase().replace(/^\//, '');
      });
    } catch (error: any) {
      log.warn("Error verificando estado de instalación:", error.message);
      return [];
    }
  },

  /**
   * Valida que una aplicación existe en el catálogo
   */
  validateAppExists(appId: string): AppInventoryItem | null {
    if (!appId || typeof appId !== 'string') return null;
    if (!/^[a-zA-Z0-9_\-]{2,32}$/.test(appId)) return null;
    
    const app = appInventory.find(a => a.id === appId);
    return app || null;
  },

  /**
   * Despliega una aplicación usando docker run
   * Implementa manejo robusto de errores y validaciones
   */
  async deployApp(appId: string): Promise<void> {
    // 1. VALIDACIÓN DE ENTRADA
    const app = this.validateAppExists(appId);
    if (!app) {
      throw new Error(`Aplicación ${appId} no encontrada en el catálogo`);
    }

    log.info(`Iniciando despliegue de: ${app.name} (${app.id})`);

    // 2. VERIFICAR DISPONIBILIDAD DE DOCKER
    try {
      await execAsync('docker ps --no-trunc');
    } catch {
      throw new Error("Docker no está disponible o no se puede acceder al socket");
    }

    // 3. RUTA DE PERSISTENCIA
    const appDataPath = path.join(config.storage.basePath, 'appdata', app.id);
    
    try {
      // 4. CREAR DIRECTORIO DE PERSISTENCIA
      log.info(`Creando directorio de persistencia en: ${appDataPath}`);
      await fs.mkdir(appDataPath, { recursive: true });

      // 5. VERIFICAR QUE EL CONTENEDOR NO EXISTA
      try {
        const { stdout } = await execAsync(`docker ps -a --filter "name=${app.id}" --format "{{.Names}}"`);
        if (stdout.includes(app.id)) {
          log.warn(`Contenedor ${app.id} ya existe`);
          throw new Error(`El contenedor '${app.id}' ya existe. Usa docker rm para eliminarlo.`);
        }
      } catch (err: any) {
        if (!err.message.includes("ya existe")) {
          log.warn("No se pudo verificar contenedores existentes:", err.message);
        } else {
          throw err;
        }
      }

      // 6. CONSTRUIR COMANDO DOCKER RUN (escapado correctamente)
      const portMapping = (app.ports || [])
        .map(p => `-p ${p}`)
        .join(' ');

      const envMapping = Object.entries(app.env || {})
        .map(([k, v]) => {
          // Escapar comillas en valores de entorno
          const escaped = String(v).replace(/"/g, '\\"');
          return `-e "${k}=${escaped}"`;
        })
        .join(' ');
      
      const dockerCmd = [
        'docker run -d',
        `--name ${app.id}`,
        '--restart unless-stopped',
        `--volume "${appDataPath}:/config"`,
        '-e PUID=1000',
        '-e PGID=1000',
        portMapping,
        envMapping,
        app.image
      ]
        .filter(Boolean)
        .join(' ');

      log.info(`Ejecutando: docker run...`);
      
      // 7. EJECUTAR DESPLIEGUE (spawn para streaming)
      return new Promise((resolve, reject) => {
        const child = spawn(dockerCmd, [], { shell: true });
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
          const line = data.toString();
          stdout += line;
          log.debug(`[${app.id}] stdout: ${line.trim()}`);
          io.emit(`app:install:log:${app.id}`, { stream: 'stdout', text: line });
        });

        child.stderr?.on('data', (data: Buffer) => {
          const line = data.toString();
          stderr += line;
          log.debug(`[${app.id}] stderr: ${line.trim()}`);
          io.emit(`app:install:log:${app.id}`, { stream: 'stderr', text: line });
        });

        child.on('close', async (code: number | null) => {
          try {
            if (code === 0) {
              log.info(`✅ ${app.name} desplegado correctamente`);
              
              // Notificar éxito
              await NotificationService.sendAlert(
                `🚀 INSTALACIÓN COMPLETADA\n\nLa aplicación <b>${app.name}</b> se ha desplegado correctamente y ya está en ejecución.`,
                'INFO'
              );
              
              resolve();
            } else {
              const errorMsg = stderr || `Docker salió con código ${code}`;
              log.error(`❌ Error desplegando ${app.id}: ${errorMsg}`);
              reject(new Error(`Fallo en el despliegue (código ${code}): ${errorMsg}`));
            }
          } catch (err: any) {
            reject(new Error(`Error en post-procesamiento: ${err.message}`));
          }
        });

        child.on('error', (err: Error) => {
          log.error(`❌ Error ejecutando docker: ${err.message}`);
          reject(new Error(`Error al ejecutar Docker: ${err.message}`));
        });

        // Timeout de 5 minutos
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error("Timeout en la instalación (5 minutos)"));
        }, 5 * 60 * 1000);

        child.on('close', () => clearTimeout(timeout));
      });

    } catch (error: any) {
      log.errorWithStack(`Error desplegando ${appId}`, error);

      // Intentar limpiar en caso de error parcial
      try {
        await execAsync(`docker rm -f ${app.id}`);
        log.info(`Contenedor fallido limpiado: ${app.id}`);
      } catch {
        // Ignorar errores de limpieza
      }

      // Notificar fallo
      try {
        await NotificationService.sendAlert(
          `❌ INSTALACIÓN FALLIDA\n\nHubo un error instalando <b>${app.name}</b>:\n\n${error.message}`,
          'WARNING'
        );
      } catch {
        // Ignorar errores de notificación
      }

      throw error;
    }
  },

  /**
   * Alias para mantener compatibilidad con llamadas previas
   */
  async installApp(appId: string): Promise<void> {
    return this.deployApp(appId);
  }
};
