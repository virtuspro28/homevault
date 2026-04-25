import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import QRCode from "qrcode";
import { config as appConfig } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("vpn-service");
const prisma = new PrismaClient();

export const VpnService = {
  /**
   * Genera llaves de cliente y registra en DB
   */
  async addClient(name: string) {
    // Simulación para Windows (el usuario suele estar en Windows desarrollando)
    if (appConfig.platform.isWindows) {
      const client = await prisma.vpnClient.create({
        data: {
          name,
          publicKey: "simulated_public_key_" + Math.random().toString(36).substring(7),
          privateKey: "simulated_private_key_" + Math.random().toString(36).substring(7),
          address: `10.0.0.${(await prisma.vpnClient.count()) + 2}`
        }
      });
      return client;
    }

    try {
      // 1. Generar llaves usando wg
      const { stdout: privateKey } = await execAsync("wg genkey");
      const { stdout: publicKey } = await execAsync(`echo "${privateKey.trim()}" | wg pubkey`);

      // 2. Determinar IP (10.0.0.x)
      const count = await prisma.vpnClient.count();
      const address = `10.0.0.${count + 2}`;

      // 3. Guardar en DB
      const client = await prisma.vpnClient.create({
        data: {
          name,
          publicKey: publicKey.trim(),
          privateKey: privateKey.trim(),
          address
        }
      });

      // 4. Actualizar wg0.conf
      const peerBlock = `\n[Peer]\nPublicKey = ${publicKey.trim()}\nAllowedIPs = ${address}/32\n`;
      fs.appendFileSync("/etc/wireguard/wg0.conf", peerBlock);
      await execAsync("sudo wg addconf wg0 <(echo \"" + peerBlock + "\")");

      return client;
    } catch (err: any) {
      log.error("Error creando cliente VPN:", err.message);
      throw err;
    }
  },

  /**
   * Genera el contenido del archivo .conf para un cliente
   */
  async getClientConfig(clientId: string) {
    const client = await prisma.vpnClient.findUnique({ where: { id: clientId } });
    if (!client) throw new Error("Cliente no encontrado");

    // Necesitamos la llave pública del servidor y el endpoint (IP pública/DDNS)
    // En un entorno real leeríamos /etc/wireguard/public.key
    const serverPubKey = "SERVER_PUBLIC_KEY_PLACEHOLDER"; 
    const endpoint = "tu-nas.duckdns.org:51820"; // Esto debería venir de los ajustes

    const config = `[Interface]
PrivateKey = ${client.privateKey}
Address = ${client.address}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPubKey}
Endpoint = ${endpoint}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;
    return config;
  },

  /**
   * Genera QR Code en base64 para la configuración
   */
  async generateQR(clientId: string) {
    const config = await this.getClientConfig(clientId);
    return await QRCode.toDataURL(config);
  },

  async listClients() {
    return await prisma.vpnClient.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async deleteClient(id: string) {
    const client = await prisma.vpnClient.delete({ where: { id } });
    // En Linux deberíamos eliminar el Peer de wg0.conf y recargar
    return client;
  }
};
