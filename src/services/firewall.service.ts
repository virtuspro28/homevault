import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import { config as appConfig } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("firewall-service");

export interface FirewallRule {
  index: number;
  to: string;
  action: string;
  from: string;
}

export const FirewallService = {
  /**
   * Obtiene la lista de reglas de UFW
   */
  async getRules(): Promise<FirewallRule[]> {
    if (appConfig.platform.isWindows) {
      return [
        { index: 1, to: "80/tcp", action: "ALLOW", from: "Anywhere" },
        { index: 2, to: "443/tcp", action: "ALLOW", from: "Anywhere" },
        { index: 3, to: "51820/udp", action: "ALLOW", from: "Anywhere" }
      ];
    }

    try {
      const { stdout } = await execAsync("sudo ufw status numbered");
      const lines = stdout.split("\n");
      const rules: FirewallRule[] = [];

      // Parsear líneas como: "[ 1] 80/tcp                     ALLOW IN    Anywhere"
      const ruleRegex = /\[\s*(\d+)\]\s+(\S+)\s+(ALLOW|DENY)\s+IN\s+(\S+)/;
      
      for (const line of lines) {
        const match = line.match(ruleRegex);
        if (match) {
          rules.push({
            index: parseInt(match[1] ?? "0"),
            to: match[2] ?? "",
            action: match[3] ?? "",
            from: match[4] ?? ""
          });
        }
      }
      return rules;
    } catch (err: any) {
      log.error("Error obteniendo reglas UFW:", err.message);
      return [];
    }
  },

  async addRule(port: string, proto: string, action: "allow" | "deny") {
    log.warn(`Añadiendo regla UFW: ${action} ${port}/${proto}`);
    if (appConfig.platform.isWindows) return;
    await execAsync(`sudo ufw ${action} ${port}/${proto}`);
  },

  async deleteRule(index: number) {
    log.warn(`Borrando regla UFW índice: ${index}`);
    if (appConfig.platform.isWindows) return;
    // Usamos --force para evitar el prompt de confirmación
    await execAsync(`sudo ufw --force delete ${index}`);
  },

  async setStatus(enabled: boolean) {
    log.info(`Cambiando estado Firewall a: ${enabled ? 'ON' : 'OFF'}`);
    if (appConfig.platform.isWindows) return;
    await execAsync(`sudo ufw ${enabled ? 'enable' : 'disable'}`);
  }
};
