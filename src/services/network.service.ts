import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import { logger } from "../utils/logger.js";
import { config as appConfig } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("network-service");

export interface NetworkInfo {
  hostname: string;
  ip: string;
  isStatic: boolean;
  interface: string;
}

export const NetworkService = {
  /**
   * Obtiene la configuración de red actual
   */
  async getStatus(): Promise<NetworkInfo> {
    const info: NetworkInfo = {
      hostname: os.hostname(),
      ip: "0.0.0.0",
      isStatic: false,
      interface: "eth0"
    };

    try {
      // IP Actual
      const { stdout: ipOut } = await execAsync("hostname -I | awk '{print $1}'");
      info.ip = ipOut.trim();

      // Detectar si es estática leyendo dhcpcd.conf (RPi OS standard)
      if (appConfig.platform.isLinux) {
        const content = fs.readFileSync("/etc/dhcpcd.conf", "utf-8");
        info.isStatic = content.includes("static ip_address=");
      }
    } catch (err: unknown) {
      const errData = err instanceof Error ? { error: err.message } : { error: String(err) };
      log.debug("Error obteniendo detalles de red (posible Windows):", errData);
    }

    return info;
  },

  /**
   * Cambia el Hostname del sistema
   */
  async setHostname(newName: string): Promise<void> {
    log.warn(`Cambiando hostname a: ${newName}`);
    if (appConfig.platform.isWindows) return;

    try {
      // 1. Cambiar mediante hostnamectl
      await execAsync(`sudo hostnamectl set-hostname ${newName}`);
      // 2. Actualizar /etc/hosts para evitar warnings de sudo
      const hostsContent = fs.readFileSync("/etc/hosts", "utf-8");
      const newHosts = hostsContent.replace(os.hostname(), newName);
      fs.writeFileSync("/etc/hosts", newHosts);
    } catch (err: any) {
       throw new Error(`Fallo al cambiar hostname: ${err.message}`);
    }
  },

  /**
   * Configura IP Estática (RPi OS /etc/dhcpcd.conf)
   */
  async setStaticIP(ip: string, gateway: string, dns: string): Promise<void> {
    log.warn(`Configurando IP Estática: ${ip}`);
    if (appConfig.platform.isWindows) return;

    try {
      const filePath = "/etc/dhcpcd.conf";
      let content = fs.readFileSync(filePath, "utf-8");

      // Backup de seguridad
      fs.writeFileSync(`${filePath}.bak`, content);

      // Eliminar configuración previa si existe
      content = content.replace(/interface eth0[\s\S]*?(?=\n\n|\n$|$)/g, "");

      const staticBlock = `\ninterface eth0\nstatic ip_address=${ip}/24\nstatic routers=${gateway}\nstatic domain_name_servers=${dns}\n`;
      
      fs.writeFileSync(filePath, content + staticBlock);
    } catch (err: any) {
      throw new Error(`Fallo al configurar IP Estática: ${err.message}`);
    }
  },

  /**
   * Vuelve a IP Dinámica (DHCP)
   */
  async setDHCP(): Promise<void> {
    log.warn("Cambiando a DHCP (IP Dinámica)");
    if (appConfig.platform.isWindows) return;

    try {
      const filePath = "/etc/dhcpcd.conf";
      let content = fs.readFileSync(filePath, "utf-8");
      
      // Eliminar el bloque estático de eth0
      const newContent = content.replace(/interface eth0[\s\S]*?(?=\n\n|\n$|$)/g, "");
      fs.writeFileSync(filePath, newContent);
    } catch (err: any) {
      throw new Error(`Fallo al volver a DHCP: ${err.message}`);
    }
  }
};
