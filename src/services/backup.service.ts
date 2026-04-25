import { PrismaClient } from '@prisma/client';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { NotificationService } from './notification.service.js';

const prisma = new PrismaClient();
const execAsync = promisify(exec);
const log = logger.child('backup-service');

const SSH_KEYS_DIR = path.join(config.paths.data, 'ssh');
const PRIVATE_KEY_PATH = path.join(SSH_KEYS_DIR, 'id_rsa');
const PUBLIC_KEY_PATH = path.join(SSH_KEYS_DIR, 'id_rsa.pub');

export const BackupService = {
  /**
   * Asegura que existan las llaves SSH para que el servidor pueda autorizar rsync
   */
  async ensureSSHKeys(): Promise<string> {
    try {
      await fs.mkdir(SSH_KEYS_DIR, { recursive: true });

      try {
        const publicKey = await fs.readFile(PUBLIC_KEY_PATH, 'utf-8');
        return publicKey;
      } catch {
        log.info('Generando nuevas llaves SSH para Active Backup...');
        // Generar llave RSA sin contraseña
        await execAsync(`ssh-keygen -t rsa -b 4096 -f "${PRIVATE_KEY_PATH}" -N "" -q`);
        const publicKey = await fs.readFile(PUBLIC_KEY_PATH, 'utf-8');
        return publicKey;
      }
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Error gestionando llaves SSH:', errData);
      throw new Error('Fallo al inicializar claves SSH para el sistema de backup');
    }
  },

  /**
   * Registra una nueva máquina agente
   */
  async registerMachine(machineName: string, storagePath: string) {
    try {
      const task = await prisma.backupTask.upsert({
        where: { machineName },
        update: { storagePath }, // Si ya existe, actualizamos la ruta por si cambió
        create: {
          machineName,
          storagePath,
          status: 'idle'
        }
      });
      
      log.info(`Agente registrado: ${machineName} -> ${storagePath}`);
      return task;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Error registrando máquina ${machineName}:`, errData);
      throw error;
    }
  },

  /**
   * Actualiza el estado de una copia de seguridad y guarda el log
   */
  async reportStatus(machineName: string, status: 'success' | 'failed', details?: string) {
    try {
      const task = await prisma.backupTask.findUnique({ where: { machineName } });
      if (!task) throw new Error(`Máquina ${machineName} no registrada`);

      // Crear entrada en el historial
      await prisma.backupLog.create({
        data: {
          taskId: task.id,
          status,
          details: details ?? null
        }
      });

      // Actualizar la tarea principal
      const updatedTask = await prisma.backupTask.update({
        where: { id: task.id },
        data: {
          status: status === 'success' ? 'idle' : 'failed',
          lastBackup: new Date()
        }
      });

      // Notificar si hay fallo crítico
      if (status === 'failed') {
        await NotificationService.sendAlert(
          `💾 ERROR DE COPIA DE SEGURIDAD\n\nLa máquina <b>${machineName}</b> ha informado de un error en su última copia.\n\nDetalles: ${details || 'Sin detalles proporcionados.'}`,
          'CRITICAL'
        );
      }

      return updatedTask;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Error reportando estado para ${machineName}:`, errData);
      throw error;
    }
  },

  /**
   * Obtiene la lista de tareas de backup con sus últimos logs
   */
  async listTasks() {
    return await prisma.backupTask.findMany({
      include: {
        logs: {
          take: 5,
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { machineName: 'asc' }
    });
  },

  /**
   * Detecta discos USB / Externos montados
   */
  async findExternalDrives() {
    try {
      if (config.platform.isWindows) {
        return [{ label: 'USB_BACKUP (Mock)', path: 'D:/', size: '500GB' }];
      }

      const { stdout } = await execAsync('lsblk -J -o NAME,MOUNTPOINT,SIZE,LABEL');
      const data = JSON.parse(stdout);
      
      // Filtrar dispositivos que tengan punto de montaje y no sean el sistema principal
      const drives: any[] = [];
      const processDevices = (devices: any[]) => {
        devices.forEach(dev => {
          if (dev.mountpoint && (dev.mountpoint.startsWith('/media') || dev.mountpoint.startsWith('/mnt'))) {
            drives.push({
              label: dev.label || dev.name,
              path: dev.mountpoint,
              size: dev.size
            });
          }
          if (dev.children) processDevices(dev.children);
        });
      };
      
      if (data.blockdevices) processDevices(data.blockdevices);
      return drives;
    } catch (err: unknown) {
      const errData = err instanceof Error ? { error: err.message } : { error: String(err) };
      log.error('Error detectando USBs:', errData);
      return [];
    }
  },

  /**
   * Ejecuta una tarea de Rsync (Local o USB)
   */
  async executeRsyncTask(taskId: string) {
    const task = await prisma.backupTask.findUnique({ where: { id: taskId } });
    if (!task || !task.sourcePath || !task.destinationPath) return;

    log.info(`Iniciando Rsync: ${task.machineName} (${task.sourcePath} -> ${task.destinationPath})`);
    
    // Actualizar estado a 'running'
    await prisma.backupTask.update({
      where: { id: taskId },
      data: { status: 'running' }
    });

    try {
      // rsync -avz --delete source destination
      // Nos aseguramos que el origen termine en / para copiar contenido, no carpeta
      const src = task.sourcePath.endsWith('/') ? task.sourcePath : `${task.sourcePath}/`;
      const child = spawn('rsync', ['-avz', '--delete', src, task.destinationPath]);

      let output = '';
      child.stdout.on('data', (data) => { output += data.toString(); });
      child.stderr.on('data', (data) => { output += data.toString(); });

      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) resolve(true);
          else reject(new Error(`Rsync falló con código ${code}`));
        });
      });

      await this.reportStatus(task.machineName, 'success', 'Sincronización Rsync completada con éxito.');
      log.info(`Rsync completado: ${task.machineName}`);
    } catch (error: any) {
      await this.reportStatus(task.machineName, 'failed', error.message);
      log.error(`Fallo en Rsync ${task.machineName}:`, error.message);
    }
  },

  /**
   * Inicializa el planificador de tareas
   */
  initScheduler() {
    log.info('Inicializando Planificador de Backups (3-2-1 Rule)...');
    
    // Check cada hora
    setInterval(async () => {
      const now = new Date();
      const tasks = await prisma.backupTask.findMany({
        where: { 
          status: 'idle',
          schedule: { not: 'MANUAL' } 
        }
      });

      for (const task of tasks) {
        if (!task.lastBackup) {
          this.executeRsyncTask(task.id);
          continue;
        }

        const diffMs = now.getTime() - task.lastBackup.getTime();
        const diffHours = diffMs / (1000 * 3600);

        if (task.schedule === 'DAILY' && diffHours >= 24) {
          this.executeRsyncTask(task.id);
        } else if (task.schedule === 'WEEKLY' && diffHours >= 24 * 7) {
          this.executeRsyncTask(task.id);
        } else if (task.schedule === 'MONTHLY' && diffHours >= 24 * 30) {
          this.executeRsyncTask(task.id);
        }
      }
    }, 3600000); // 1 hora
  }
};

