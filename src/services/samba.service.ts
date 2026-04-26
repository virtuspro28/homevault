import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { logger } from '../utils/logger.js';
import { config as appConfig } from '../config/index.js';

const execAsync = promisify(exec);
const log = logger.child('samba-service');

const SMB_CONF_PATH = '/etc/samba/smb.conf';
const NFS_EXPORTS_PATH = '/etc/exports';

export interface SambaShare {
  name: string;
  path: string;
  comment?: string;
  browseable: boolean;
  readOnly: boolean;
  guestOk: boolean;
}

export interface ProtocolStatus {
  protocol: "smb" | "nfs";
  active: boolean;
  enabled: boolean;
}

/**
 * Servicio para gestionar compartidos de Samba y NFS.
 */
export const SambaService = {
  async getProtocolStatus(): Promise<ProtocolStatus[]> {
    if (appConfig.platform.isWindows) {
      return [
        { protocol: "smb", active: true, enabled: true },
        { protocol: "nfs", active: false, enabled: false },
      ];
    }

    const inspectService = async (protocol: "smb" | "nfs", serviceName: string): Promise<ProtocolStatus> => {
      let active = false;
      let enabled = false;

      try {
        const { stdout } = await execAsync(`systemctl is-active ${serviceName}`);
        active = stdout.trim() === "active";
      } catch {
        active = false;
      }

      try {
        const { stdout } = await execAsync(`systemctl is-enabled ${serviceName}`);
        enabled = stdout.trim() === "enabled";
      } catch {
        enabled = false;
      }

      return { protocol, active, enabled };
    };

    return Promise.all([
      inspectService("smb", "smbd"),
      inspectService("nfs", "nfs-kernel-server"),
    ]);
  },

  /**
   * Lista los recursos compartidos definidos en smb.conf
   */
  async listShares(): Promise<SambaShare[]> {
    if (appConfig.platform.isWindows) {
      return [
        { name: 'Multimedia', path: 'C:\\NasStorage\\Movies', browseable: true, readOnly: false, guestOk: true },
        { name: 'Backups', path: 'C:\\NasStorage\\Backups', browseable: true, readOnly: true, guestOk: false }
      ];
    }
    
    try {
      const content = await fs.readFile(SMB_CONF_PATH, 'utf-8');
      const shares: SambaShare[] = [];
      const sections = content.split(/^\[(.+?)\]/m);

      for (let i = 1; i < sections.length; i += 2) {
        const name = sections[i]?.trim() ?? '';
        const config = sections[i + 1] || '';

        if (['global', 'homes', 'printers', 'print$'].includes(name.toLowerCase())) {
          continue;
        }

        const pathMatch = config.match(/^\s*path\s*=\s*(.+)$/m);
        if (pathMatch) {
          shares.push({
            name,
            path: pathMatch[1]?.trim() ?? '',
            browseable: !/browseable\s*=\s*no/i.test(config),
            readOnly: /read only\s*=\s*yes/i.test(config),
            guestOk: /guest ok\s*=\s*yes/i.test(config),
          });
        }
      }

      return shares;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Error al leer smb.conf:', errData);
      return [];
    }
  },

  /**
   * Añade un nuevo recurso compartido a Samba.
   */
  async addShare(share: { name: string; path: string; readOnly?: boolean }): Promise<void> {
    const { name, path, readOnly } = share;
    
    const currentShares = await this.listShares();
    if (currentShares.find(s => s.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`El recurso compartido [${name}] ya existe.`);
    }

    const shareConfig = `
[${name}]
   path = ${path}
   browseable = yes
   read only = ${readOnly ? 'yes' : 'no'}
   guest ok = yes
   create mask = 0644
   directory mask = 0755
   force user = root
`;

    try {
      await fs.appendFile(SMB_CONF_PATH, shareConfig);
      await this.restartService('smbd');
      log.info(`Samba share [${name}] added.`);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Error adding Samba share [${name}]:`, errData);
      throw new Error('Could not update smb.conf');
    }
  },

  /**
   * Gestiona el protocolo NFS (/etc/exports).
   */
  async addNFSShare(path: string): Promise<void> {
    if (appConfig.platform.isWindows) return;

    const entry = `${path} *(rw,sync,no_subtree_check,no_root_squash)\n`;
    try {
      await fs.appendFile(NFS_EXPORTS_PATH, entry);
      await execAsync('sudo exportfs -ra');
      log.info(`NFS export added for ${path}`);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Error adding NFS share:', errData);
      throw new Error('Failed to update NFS exports');
    }
  },

  /**
   * Elimina un recurso de Samba.
   */
  async deleteShare(name: string): Promise<void> {
    try {
      const content = await fs.readFile(SMB_CONF_PATH, 'utf-8');
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^\\[${escapedName}\\][\\s\\S]*?(?=^\\s*\\[|$)`, 'm');
      
      const newContent = content.replace(regex, '').trim() + '\n';
      
      await fs.writeFile(SMB_CONF_PATH, newContent);
      await this.restartService('smbd');
      log.info(`Samba share [${name}] deleted.`);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Error deleting share [${name}]:`, errData);
      throw new Error('Error modifying smb.conf');
    }
  },

  /**
   * Reinicia servicios (smbd, nfs-kernel-server).
   */
  async restartService(serviceName: string): Promise<void> {
    try {
      await execAsync(`sudo systemctl restart ${serviceName}`);
    } catch (error) {
      log.warn(`Could not restart ${serviceName}.`);
    }
  },

  /**
   * Activa/Desactiva protocolos.
   */
  async toggleProtocol(protocol: 'smb' | 'nfs', enabled: boolean): Promise<void> {
    const service = protocol === 'smb' ? 'smbd' : 'nfs-kernel-server';
    const action = enabled ? 'start' : 'stop';
    const enableDisable = enabled ? 'enable' : 'disable';

    try {
      await execAsync(`sudo systemctl ${action} ${service}`);
      await execAsync(`sudo systemctl ${enableDisable} ${service}`);
      log.info(`Protocol ${protocol} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Failed to toggle protocol ${protocol}:`, errData);
      throw new Error(`Failed to manage ${service}`);
    }
  }
};
