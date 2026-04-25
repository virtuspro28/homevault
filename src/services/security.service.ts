import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { config as appConfig } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("security-service");
const prisma = new PrismaClient();

export const SecurityService = {
  /**
   * Obtiene la lista de IPs baneadas por Fail2Ban
   */
  async getBannedList() {
    if (appConfig.platform.isWindows) {
      return [
        { ip: "185.22.14.5", date: new Date(), reason: "auth-failure" },
        { ip: "45.122.1.99", date: new Date(), reason: "port-scanning" }
      ];
    }

    try {
      const { stdout } = await execAsync("sudo fail2ban-client status homepinas");
      // El output suele ser algo como: "`- Banned IP list:  1.2.3.4 5.6.7.8"
      const match = stdout.match(/Banned IP list:\s+(.*)/);
      if (match && match[1]) {
        return match[1].trim().split(/\s+/).map(ip => ({
          ip,
          date: new Date(), // Fail2Ban no da la fecha fácil aquí, estimamos
          reason: "Intento de intrusión"
        }));
      }
      return [];
    } catch (err) {
      log.debug("Fail2Ban no instalado o configurado aún.");
      return [];
    }
  },

  async unbanIP(ip: string) {
    log.warn(`Desbloqueando IP: ${ip}`);
    if (appConfig.platform.isWindows) return;
    await execAsync(`sudo fail2ban-client set homepinas unbanip ${ip}`);
  },

  /**
   * Implementación de bloqueo por país (Geo-Blocking)
   */
  async blockCountry(countryCode: string) {
    log.warn(`Bloqueando país: ${countryCode}`);
    if (appConfig.platform.isWindows) return;

    try {
      // Usamos ipdeny.com para obtener los CIDR de un país
      const url = `https://www.ipdeny.com/ipblocks/data/countries/${countryCode.toLowerCase()}.zone`;
      const { stdout } = await execAsync(`curl -s ${url}`);
      const cidrs = stdout.split("\n").filter(line => line.trim().length > 0);

      log.info(`Bloqueando ${cidrs.length} rangos de IP para ${countryCode}`);
      
      // Añadimos cada rango a UFW (esta operación puede ser lenta)
      for (const cidr of cidrs) {
        await execAsync(`sudo ufw insert 1 deny from ${cidr}`);
      }
    } catch (err: any) {
      log.error(`Error bloqueando país ${countryCode}:`, err.message);
      throw err;
    }
  },

  async getConfig() {
    let config = await prisma.securityConfig.findUnique({ where: { id: "global" } });
    if (!config) {
      config = await prisma.securityConfig.create({
        data: { id: "global", firewallEnabled: true, fail2banEnabled: true, blockedCountries: "" }
      });
    }
    return config;
  }
};
