import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";
import { logger } from "../utils/logger.js";
import { config as appConfig } from "../config/index.js";
import { DdnsService } from "./ddns.service.js";

const execAsync = promisify(exec);
const log = logger.child("vpn-service");
const prisma = new PrismaClient();

const WG_INTERFACE = process.env["WG_INTERFACE"] ?? "wg0";
const WG_CONFIG_PATH = process.env["WG_CONFIG_PATH"] ?? `/etc/wireguard/${WG_INTERFACE}.conf`;
const WG_SERVER_PUBLIC_KEY_PATH = process.env["WG_SERVER_PUBLIC_KEY_PATH"] ?? "/etc/wireguard/public.key";
const WG_SERVER_PRIVATE_KEY_PATH = process.env["WG_SERVER_PRIVATE_KEY_PATH"] ?? "/etc/wireguard/private.key";
const WG_SUBNET_BASE = process.env["WG_SUBNET_BASE"] ?? "10.8.0";
const WG_DEFAULT_DNS = process.env["WG_DEFAULT_DNS"] ?? "1.1.1.1";
const WG_ENDPOINT = process.env["WG_ENDPOINT"] ?? "";
const WG_PORT = Number(process.env["WG_PORT"] ?? "51820");

export interface VpnServerStatus {
  mode: "mock" | "linux";
  enabled: boolean;
  installed: boolean;
  interfaceName: string;
  endpoint: string;
  publicKey: string | null;
  clientCount: number;
  configPath: string;
}

function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, "-");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCommand = appConfig.platform.isWindows ? `where ${command}` : `command -v ${command}`;
    await execAsync(checkCommand);
    return true;
  } catch {
    return false;
  }
}

async function readServerPublicKey(): Promise<string | null> {
  if (appConfig.platform.isWindows) {
    return "MOCK_SERVER_PUBLIC_KEY";
  }

  try {
    const key = await fs.readFile(WG_SERVER_PUBLIC_KEY_PATH, "utf-8");
    return key.trim();
  } catch {
    try {
      const { stdout } = await execAsync(`sudo wg show ${WG_INTERFACE} public-key`);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
}

async function resolveEndpoint(): Promise<string> {
  if (WG_ENDPOINT) {
    return WG_ENDPOINT;
  }

  const ddnsHostname = await DdnsService.getPreferredHostname();
  if (ddnsHostname) {
    return `${ddnsHostname}:${WG_PORT}`;
  }

  if (appConfig.platform.isWindows) {
    return `demo.homevault.local:${WG_PORT}`;
  }

  try {
    const { stdout } = await execAsync("hostname -f");
    const host = stdout.trim();
    if (host) {
      return `${host}:${WG_PORT}`;
    }
  } catch {
    // Fall through to platform hostname.
  }

  return `${appConfig.platform.hostname}:${WG_PORT}`;
}

async function readWireGuardConfig(): Promise<string> {
  try {
    return await fs.readFile(WG_CONFIG_PATH, "utf-8");
  } catch (error) {
    throw new Error(`No se pudo leer la configuracion de WireGuard en ${WG_CONFIG_PATH}.`);
  }
}

function buildClientConfig(privateKey: string, address: string, serverPublicKey: string, endpoint: string): string {
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${address}/24
DNS = ${WG_DEFAULT_DNS}

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpoint}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`;
}

async function allocateClientAddress(): Promise<string> {
  const clients = await prisma.vpnClient.findMany({ select: { address: true } });
  const usedHosts = new Set(
    clients
      .map((client) => Number(client.address.split(".").pop() ?? "0"))
      .filter((host) => Number.isFinite(host)),
  );

  for (let host = 2; host < 255; host += 1) {
    if (!usedHosts.has(host)) {
      return `${WG_SUBNET_BASE}.${host}`;
    }
  }

  throw new Error("No quedan direcciones libres en la subred WireGuard configurada.");
}

async function appendPeerToConfig(publicKey: string, address: string, name: string): Promise<void> {
  const peerBlock = `\n# HomeVault client: ${name}\n[Peer]\nPublicKey = ${publicKey}\nAllowedIPs = ${address}/32\n`;
  await fs.appendFile(WG_CONFIG_PATH, peerBlock, "utf-8");
}

async function removePeerFromConfig(publicKey: string): Promise<void> {
  const content = await readWireGuardConfig();
  const escapedKey = escapeRegExp(publicKey);
  const blockPattern = new RegExp(
    `\\n?# HomeVault client:.*?\\n\\[Peer\\]\\nPublicKey = ${escapedKey}\\nAllowedIPs = .*?\\n(?=\\n# HomeVault client:|\\n\\[Peer\\]|$)`,
    "gs",
  );
  const genericPattern = new RegExp(
    `\\n?\\[Peer\\]\\nPublicKey = ${escapedKey}\\nAllowedIPs = .*?\\n(?=\\n\\[Peer\\]|$)`,
    "gs",
  );

  const nextContent = content.replace(blockPattern, "\n").replace(genericPattern, "\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  await fs.writeFile(WG_CONFIG_PATH, nextContent, "utf-8");
}

export const VpnService = {
  async getServerStatus(): Promise<VpnServerStatus> {
    const [clientCount, installed, publicKey, endpoint] = await Promise.all([
      prisma.vpnClient.count(),
      commandExists("wg"),
      readServerPublicKey(),
      resolveEndpoint(),
    ]);

    if (appConfig.platform.isWindows) {
      return {
        mode: "mock",
        enabled: true,
        installed: true,
        interfaceName: WG_INTERFACE,
        endpoint,
        publicKey,
        clientCount,
        configPath: WG_CONFIG_PATH,
      };
    }

    let enabled = false;
    try {
      const { stdout } = await execAsync(`sudo wg show ${WG_INTERFACE}`);
      enabled = stdout.trim().length > 0;
    } catch {
      enabled = false;
    }

    return {
      mode: "linux",
      enabled,
      installed,
      interfaceName: WG_INTERFACE,
      endpoint,
      publicKey,
      clientCount,
      configPath: WG_CONFIG_PATH,
    };
  },

  async addClient(name: string) {
    const normalizedName = normalizeClientName(name);
    if (!normalizedName) {
      throw new Error("El nombre del cliente es obligatorio.");
    }

    const existing = await prisma.vpnClient.findFirst({
      where: { name: normalizedName },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`Ya existe un cliente WireGuard con el nombre ${normalizedName}.`);
    }

    const address = await allocateClientAddress();

    if (appConfig.platform.isWindows) {
      return prisma.vpnClient.create({
        data: {
          name: normalizedName,
          publicKey: `mock_public_${Math.random().toString(36).slice(2, 12)}`,
          privateKey: `mock_private_${Math.random().toString(36).slice(2, 12)}`,
          address,
        },
      });
    }

    try {
      const installed = await commandExists("wg");
      if (!installed) {
        throw new Error("WireGuard no esta instalado. Instala los paquetes wireguard y wireguard-tools en el servidor.");
      }

      const { stdout: privateKeyRaw } = await execAsync("wg genkey");
      const privateKey = privateKeyRaw.trim();
      const { stdout: publicKeyRaw } = await execAsync(`printf '%s' "${privateKey}" | wg pubkey`);
      const publicKey = publicKeyRaw.trim();

      const client = await prisma.vpnClient.create({
        data: {
          name: normalizedName,
          publicKey,
          privateKey,
          address,
        },
      });

      await appendPeerToConfig(publicKey, address, normalizedName);

      try {
        await execAsync(`sudo wg set ${WG_INTERFACE} peer ${publicKey} allowed-ips ${address}/32`);
      } catch (error) {
        log.warn("No se pudo cargar el peer en caliente; queda persistido en el fichero.", {
          interface: WG_INTERFACE,
        });
      }

      return client;
    } catch (error) {
      log.errorWithStack("Error creando cliente VPN", error);
      throw error;
    }
  },

  async getClientConfig(clientId: string) {
    const client = await prisma.vpnClient.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new Error("Cliente no encontrado");
    }
    if (!client.privateKey) {
      throw new Error("La clave privada del cliente ya no esta disponible para regenerar el fichero.");
    }

    const serverPublicKey = await readServerPublicKey();
    if (!serverPublicKey) {
      throw new Error("No se pudo resolver la clave publica del servidor WireGuard.");
    }

    const endpoint = await resolveEndpoint();
    return buildClientConfig(client.privateKey, client.address, serverPublicKey, endpoint);
  },

  async generateQR(clientId: string) {
    const config = await this.getClientConfig(clientId);
    return QRCode.toDataURL(config);
  },

  async listClients() {
    return prisma.vpnClient.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async deleteClient(id: string) {
    const client = await prisma.vpnClient.findUnique({ where: { id } });
    if (!client) {
      throw new Error("Cliente no encontrado");
    }

    if (!appConfig.platform.isWindows) {
      await removePeerFromConfig(client.publicKey);
      try {
        await execAsync(`sudo wg set ${WG_INTERFACE} peer ${client.publicKey} remove`);
      } catch (error) {
        log.warn("No se pudo eliminar el peer en caliente; se ha retirado del fichero.", {
          interface: WG_INTERFACE,
          publicKey: client.publicKey,
        });
      }
    }

    return prisma.vpnClient.delete({ where: { id } });
  },

  async getDownloadFilename(clientId: string) {
    const client = await prisma.vpnClient.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new Error("Cliente no encontrado");
    }

    return `${client.name || path.basename(clientId)}.conf`;
  },
};
