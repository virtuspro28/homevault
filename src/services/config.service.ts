import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = logger.child('config-service');

const ALLOWED_EXTENSIONS = ['.yml', '.yaml', '.conf', '.txt', '.json'];
const CONFIG_ROOT = path.join(config.paths.data, 'configs');

/**
 * Ensures the target path is safe and within allowed boundaries.
 */
function validatePath(relativeOrPath: string): string {
  // If it's an absolute path, we must ensure it's in a whitelisted system directory
  // For now, we mainly focus on files inside our own data/configs directory
  // or specific system config paths if they were requested.
  
  const absolutePath = path.isAbsolute(relativeOrPath) 
    ? path.normalize(relativeOrPath)
    : path.normalize(path.join(CONFIG_ROOT, relativeOrPath));

  // Security: Check extension
  const ext = path.extname(absolutePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Extension ${ext} not allowed for editing.`);
  }

  // Security: Prevent path traversal
  // Allow paths within CONFIG_ROOT or /etc/homepinas (if it was a real Linux system)
  const isInData = absolutePath.startsWith(path.normalize(config.paths.data));
  const isInEtc = absolutePath.startsWith(path.normalize('/etc/homepinas'));

  if (!isInData && !isInEtc && !config.platform.isWindows) {
    log.warn(`Blocked access to unauthorized config path: ${absolutePath}`);
    throw new Error('Access Denied: Path not whitelisted for configuration editing.');
  }

  return absolutePath;
}

/**
 * Lists all editable configuration files.
 */
export async function listConfigFiles(): Promise<{ name: string; path: string }[]> {
  try {
    // Ensure the directory exists
    await fs.mkdir(CONFIG_ROOT, { recursive: true });
    
    const files = await fs.readdir(CONFIG_ROOT);
    return files
      .filter(f => ALLOWED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .map(f => ({
        name: f,
        path: f // Returning relative to CONFIG_ROOT
      }));
  } catch (err: unknown) {
    const errData = err instanceof Error ? { error: err.message } : { error: String(err) };
    log.error('Error listing config files:', errData);
    return [];
  }
}

/**
 * Reads a config file.
 */
export async function readConfigFile(filePath: string): Promise<string> {
  const target = validatePath(filePath);
  try {
    return await fs.readFile(target, 'utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') throw new Error('File not found');
    throw err;
  }
}

/**
 * Saves a config file and optionally restarts a container.
 */
export async function saveConfigFile(filePath: string, content: string, restartContainerId?: string): Promise<void> {
  const target = validatePath(filePath);
  
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
  log.info(`Config file saved: ${target}`);

  if (restartContainerId) {
    try {
      log.info(`Restarting container ${restartContainerId} after config change...`);
      await execAsync(`docker restart ${restartContainerId}`);
      log.info(`Container ${restartContainerId} restarted successfully.`);
    } catch (err: any) {
      log.error(`Failed to restart container ${restartContainerId}: ${err.message}`);
      throw new Error(`File saved, but failed to restart container: ${err.message}`);
    }
  }
}
