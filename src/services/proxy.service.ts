import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { config as appConfig } from "../config/index.js";

const execAsync = promisify(exec);
const log = logger.child("proxy-service");
const prisma = new PrismaClient();

export const ProxyService = {
  /**
   * Añade un nuevo dominio con Proxy Inverso
   */
  async addDomain(domain: string, targetPort: number) {
    // 1. Guardar en DB
    const proxy = await prisma.proxyDomain.create({
      data: { domain, targetPort }
    });

    if (appConfig.platform.isWindows) return proxy;

    try {
      // 2. Crear configuración de Nginx
      const nginxConfig = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
      const configPath = `/etc/nginx/sites-available/${domain}`;
      fs.writeFileSync(configPath, nginxConfig);
      
      // 3. Activar sitio (symlink)
      await execAsync(`sudo ln -s ${configPath} /etc/nginx/sites-enabled/`);
      await execAsync("sudo nginx -s reload");

      return proxy;
    } catch (err: any) {
      log.error("Error configurando Nginx:", err.message);
      throw err;
    }
  },

  /**
   * Emite certificado SSL usando Certbot
   */
  async issueSSL(id: string) {
    const proxy = await prisma.proxyDomain.findUnique({ where: { id } });
    if (!proxy) throw new Error("Dominio no encontrado");

    if (appConfig.platform.isWindows) {
      return await prisma.proxyDomain.update({
        where: { id },
        data: { sslEnabled: true }
      });
    }

    try {
      log.info(`Solicitando SSL para: ${proxy.domain}`);
      // El commando --nginx configura automáticamente el archivo de sitios-available
      await execAsync(`sudo certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email -d ${proxy.domain}`);
      
      return await prisma.proxyDomain.update({
        where: { id },
        data: { sslEnabled: true }
      });
    } catch (err: any) {
      log.error("Error con Certbot:", err.message);
      throw new Error("Fallo al obtener certificado SSL. Asegúrate de que el dominio apunta a esta IP.");
    }
  },

  async listDomains() {
    return await prisma.proxyDomain.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async deleteDomain(id: string) {
    const proxy = await prisma.proxyDomain.delete({ where: { id } });
    
    if (!appConfig.platform.isWindows) {
        await execAsync(`sudo rm /etc/nginx/sites-available/${proxy.domain}`);
        await execAsync(`sudo rm /etc/nginx/sites-enabled/${proxy.domain}`);
        await execAsync("sudo nginx -s reload");
    }
    return proxy;
  }
};
