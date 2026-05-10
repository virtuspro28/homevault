import { exec } from "node:child_process";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);
const log = logger.child("rclone-service");

const RCLONE_STATE_DIR = path.join(config.paths.data, "rclone");
const RCLONE_CONFIG_FILE = path.join(RCLONE_STATE_DIR, "rclone.conf");
const REMOTE_PROFILES_FILE = path.join(RCLONE_STATE_DIR, "network-drives.json");
const MOUNT_ROOT = process.env["HOMEVAULT_REMOTE_ROOT"]?.trim() || path.join(config.paths.root, "remote");

export type RemoteProvider = "webdav" | "smb" | "ftp" | "sftp" | "drive" | "onedrive";

export interface CloudRemote {
  name: string;
  provider: RemoteProvider;
  isMounted: boolean;
  mountPath: string;
  remotePath?: string | undefined;
  summary: string;
  usage?: {
    total: number;
    used: number;
    free: number;
  } | undefined;
}

export interface RemoteProfile {
  name: string;
  provider: RemoteProvider;
  mountPath: string;
  remotePath?: string | undefined;
  summary: string;
  host?: string | undefined;
  port?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
  vendor?: string | undefined;
  url?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  token?: string | undefined;
  manualOptions?: Record<string, string> | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderField {
  key: keyof RemoteProfile | "manualOptionsJson";
  label: string;
  type: "text" | "password" | "number" | "textarea";
  placeholder?: string;
  required?: boolean;
  help?: string;
}

export interface ProviderDefinition {
  id: RemoteProvider;
  label: string;
  description: string;
  fields: ProviderField[];
}

const PROVIDERS: ProviderDefinition[] = [
  {
    id: "webdav",
    label: "WebDAV",
    description: "Ideal para Nextcloud, ownCloud, SharePoint WebDAV y otros servicios compatibles.",
    fields: [
      { key: "url", label: "URL WebDAV", type: "text", required: true, placeholder: "https://cloud.midominio.com/remote.php/dav/files/usuario" },
      { key: "vendor", label: "Vendor", type: "text", placeholder: "nextcloud, owncloud, sharepoint..." },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
      { key: "remotePath", label: "Subruta remota", type: "text", placeholder: "Documentos/Media" },
    ],
  },
  {
    id: "smb",
    label: "SMB / CIFS",
    description: "Conecta recursos compartidos Samba o carpetas Windows montadas a través de Rclone.",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "192.168.1.50" },
      { key: "port", label: "Puerto", type: "number", placeholder: "445" },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
      { key: "remotePath", label: "Share / subruta", type: "text", required: true, placeholder: "multimedia/series" },
    ],
  },
  {
    id: "ftp",
    label: "FTP",
    description: "Montaje de servidores FTP clásicos con soporte de usuario, clave y ruta remota.",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "ftp.midominio.com" },
      { key: "port", label: "Puerto", type: "number", placeholder: "21" },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
      { key: "remotePath", label: "Ruta remota", type: "text", placeholder: "public_html/media" },
    ],
  },
  {
    id: "sftp",
    label: "SFTP",
    description: "Acceso seguro por SSH a otro NAS o VPS, montando carpetas remotas como si fueran locales.",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "mi-servidor.example.com" },
      { key: "port", label: "Puerto", type: "number", placeholder: "22" },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
      { key: "remotePath", label: "Ruta remota", type: "text", placeholder: "srv/media" },
    ],
  },
  {
    id: "drive",
    label: "Google Drive",
    description: "Usa credenciales OAuth ya generadas: client ID, secret y token JSON de Rclone.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Google OAuth client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Google OAuth client secret" },
      { key: "token", label: "Token JSON", type: "textarea", required: true, placeholder: "{\"access_token\":\"...\"}" },
      { key: "remotePath", label: "Carpeta remota", type: "text", placeholder: "Media" },
    ],
  },
  {
    id: "onedrive",
    label: "OneDrive",
    description: "Usa token OAuth de OneDrive/SharePoint generado con Rclone y, si quieres, tus credenciales de app.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Azure app client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Azure app client secret" },
      { key: "token", label: "Token JSON", type: "textarea", required: true, placeholder: "{\"access_token\":\"...\"}" },
      { key: "remotePath", label: "Carpeta remota", type: "text", placeholder: "Documentos/Media" },
    ],
  },
];

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function quoteShellValue(value: string): string {
  return value.replace(/(["`\\$])/g, "\\$1");
}

function formatSummary(profile: Partial<RemoteProfile>): string {
  if (profile.provider === "webdav") {
    return profile.url || "WebDAV remoto";
  }

  if (profile.provider === "drive") {
    return "Google Drive OAuth";
  }

  if (profile.provider === "onedrive") {
    return "OneDrive OAuth";
  }

  const host = profile.host || "host-remoto";
  const port = profile.port ? `:${profile.port}` : "";
  return `${host}${port}`;
}

function getMountPath(name: string): string {
  return path.join(MOUNT_ROOT, name);
}

async function ensureRuntimeDirs(): Promise<void> {
  await fs.mkdir(RCLONE_STATE_DIR, { recursive: true });
  await fs.mkdir(MOUNT_ROOT, { recursive: true });
}

async function ensureRcloneAvailable(): Promise<void> {
  if (config.platform.isWindows) {
    return;
  }

  try {
    await execAsync("rclone version");
  } catch {
    throw new Error("Rclone no está instalado. Instálalo desde el panel o con apt install rclone.");
  }
}

async function obscureSecret(secret: string): Promise<string> {
  const escaped = quoteShellValue(secret);
  const { stdout } = await execAsync(`rclone obscure "${escaped}"`);
  return stdout.trim();
}

async function readProfiles(): Promise<RemoteProfile[]> {
  try {
    await ensureRuntimeDirs();
    const raw = await fs.readFile(REMOTE_PROFILES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as RemoteProfile[] : [];
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return [];
    }

    log.errorWithStack("Error leyendo perfiles Rclone", error);
    throw new Error("No se pudieron cargar las unidades de red.");
  }
}

async function writeProfiles(profiles: RemoteProfile[]): Promise<void> {
  await ensureRuntimeDirs();
  await fs.writeFile(REMOTE_PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
}

function serializeManualOptions(options?: Record<string, string>): string[] {
  if (!options) {
    return [];
  }

  return Object.entries(options)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key} = ${value}`);
}

async function buildRemoteSection(profile: RemoteProfile): Promise<string[]> {
  const lines = [`[${profile.name}]`];

  switch (profile.provider) {
    case "webdav": {
      lines.push("type = webdav");
      lines.push(`url = ${profile.url || ""}`);
      lines.push(`vendor = ${profile.vendor || "other"}`);
      lines.push(`user = ${profile.username || ""}`);
      if (profile.password) {
        lines.push(`pass = ${await obscureSecret(profile.password)}`);
      }
      break;
    }
    case "smb": {
      lines.push("type = smb");
      lines.push(`host = ${profile.host || ""}`);
      lines.push(`user = ${profile.username || ""}`);
      lines.push(`port = ${profile.port || "445"}`);
      if (profile.password) {
        lines.push(`pass = ${await obscureSecret(profile.password)}`);
      }
      break;
    }
    case "ftp": {
      lines.push("type = ftp");
      lines.push(`host = ${profile.host || ""}`);
      lines.push(`user = ${profile.username || ""}`);
      lines.push(`port = ${profile.port || "21"}`);
      if (profile.password) {
        lines.push(`pass = ${await obscureSecret(profile.password)}`);
      }
      break;
    }
    case "sftp": {
      lines.push("type = sftp");
      lines.push(`host = ${profile.host || ""}`);
      lines.push(`user = ${profile.username || ""}`);
      lines.push(`port = ${profile.port || "22"}`);
      if (profile.password) {
        lines.push(`pass = ${await obscureSecret(profile.password)}`);
      }
      lines.push("shell_type = unix");
      break;
    }
    case "drive": {
      lines.push("type = drive");
      lines.push("scope = drive");
      if (profile.clientId) {
        lines.push(`client_id = ${profile.clientId}`);
      }
      if (profile.clientSecret) {
        lines.push(`client_secret = ${profile.clientSecret}`);
      }
      if (profile.token) {
        lines.push(`token = ${profile.token}`);
      }
      break;
    }
    case "onedrive": {
      lines.push("type = onedrive");
      lines.push("drive_type = personal");
      if (profile.clientId) {
        lines.push(`client_id = ${profile.clientId}`);
      }
      if (profile.clientSecret) {
        lines.push(`client_secret = ${profile.clientSecret}`);
      }
      if (profile.token) {
        lines.push(`token = ${profile.token}`);
      }
      break;
    }
  }

  lines.push(...serializeManualOptions(profile.manualOptions));
  return lines;
}

async function writeRcloneConfig(profiles: RemoteProfile[]): Promise<void> {
  await ensureRuntimeDirs();
  const sections = await Promise.all(profiles.map((profile) => buildRemoteSection(profile)));
  const contents = sections.map((lines) => lines.join("\n")).join("\n\n");
  await fs.writeFile(RCLONE_CONFIG_FILE, contents, "utf-8");
}

async function isMounted(mountPath: string): Promise<boolean> {
  if (config.platform.isWindows) {
    return false;
  }

  try {
    const { stdout } = await execAsync(`mount | grep "${quoteShellValue(mountPath)}"`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function getUsage(mountPath: string): Promise<CloudRemote["usage"] | undefined> {
  if (config.platform.isWindows) {
    return undefined;
  }

  try {
    const { stdout } = await execAsync(`df -B1 "${quoteShellValue(mountPath)}" | tail -n 1`);
    const parts = stdout.trim().split(/\s+/);
    const total = Number(parts[1] || "0");
    const used = Number(parts[2] || "0");
    const free = Number(parts[3] || "0");

    if (!total) {
      return undefined;
    }

    return { total, used, free };
  } catch {
    return undefined;
  }
}

function sanitizeManualOptions(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, rawValue]) => [key.trim(), String(rawValue ?? "").trim()] as const)
    .filter(([key, rawValue]) => key && rawValue);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function validateProfileInput(input: Partial<RemoteProfile>): RemoteProfile {
  const name = normalizeName(String(input.name || ""));
  const provider = String(input.provider || "") as RemoteProvider;
  const providerDefinition = PROVIDERS.find((item) => item.id === provider);

  if (!name) {
    throw new Error("El nombre de la unidad es obligatorio.");
  }

  if (!providerDefinition) {
    throw new Error("Proveedor de unidad no soportado.");
  }

  const mountPath = getMountPath(name);
  const profile: RemoteProfile = {
    name,
    provider,
    mountPath,
    remotePath: String(input.remotePath || "").trim() || undefined,
    summary: formatSummary(input),
    host: String(input.host || "").trim() || undefined,
    port: String(input.port || "").trim() || undefined,
    username: String(input.username || "").trim() || undefined,
    password: String(input.password || "").trim() || undefined,
    vendor: String(input.vendor || "").trim() || undefined,
    url: String(input.url || "").trim() || undefined,
    clientId: String(input.clientId || "").trim() || undefined,
    clientSecret: String(input.clientSecret || "").trim() || undefined,
    token: String(input.token || "").trim() || undefined,
    manualOptions: sanitizeManualOptions(input.manualOptions),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  for (const field of providerDefinition.fields) {
    const value = String((profile as unknown as Record<string, unknown>)[field.key] || "").trim();
    if (field.required && !value) {
      throw new Error(`El campo ${field.label} es obligatorio para ${providerDefinition.label}.`);
    }
  }

  profile.summary = formatSummary(profile);
  return profile;
}

function getRemoteTarget(profile: RemoteProfile): string {
  const suffix = profile.remotePath?.trim();
  return suffix ? `${profile.name}:${suffix}` : `${profile.name}:`;
}

export const RCloneService = {
  getProviders(): ProviderDefinition[] {
    return PROVIDERS;
  },

  async listProfiles(): Promise<RemoteProfile[]> {
    return readProfiles();
  },

  async getRemotes(): Promise<CloudRemote[]> {
    const profiles = await readProfiles();

    return Promise.all(
      profiles.map(async (profile) => {
        const mounted = await isMounted(profile.mountPath);
        return {
          name: profile.name,
          provider: profile.provider,
          isMounted: mounted,
          mountPath: profile.mountPath,
          remotePath: profile.remotePath,
          summary: profile.summary,
          usage: mounted ? await getUsage(profile.mountPath) : undefined,
        };
      }),
    );
  },

  async saveRemote(input: Partial<RemoteProfile>): Promise<RemoteProfile> {
    if (config.platform.isWindows) {
      const mockProfile = validateProfileInput(input);
      return mockProfile;
    }

    await ensureRcloneAvailable();
    const profiles = await readProfiles();
    const normalizedName = normalizeName(String(input.name || ""));
    const existingIndex = profiles.findIndex((profile) => profile.name === normalizedName);
    const existing = existingIndex >= 0 ? profiles[existingIndex] : undefined;
    const nextProfile = validateProfileInput({
      ...existing,
      ...input,
      password: input.password || existing?.password,
      clientSecret: input.clientSecret || existing?.clientSecret,
      token: input.token || existing?.token,
    });

    if (existingIndex >= 0) {
      nextProfile.createdAt = profiles[existingIndex]?.createdAt || nextProfile.createdAt;
      profiles[existingIndex] = {
        ...profiles[existingIndex],
        ...nextProfile,
        updatedAt: new Date().toISOString(),
      };
    } else {
      profiles.push(nextProfile);
    }

    await writeProfiles(profiles);
    await writeRcloneConfig(profiles);
    return profiles[existingIndex >= 0 ? existingIndex : profiles.length - 1]!;
  },

  async deleteRemote(name: string): Promise<void> {
    const remoteName = normalizeName(name);
    const profiles = await readProfiles();
    const profile = profiles.find((item) => item.name === remoteName);

    if (!profile) {
      throw new Error("La unidad de red no existe.");
    }

    if (await isMounted(profile.mountPath)) {
      await this.unmountRemote(remoteName);
    }

    const filtered = profiles.filter((item) => item.name !== remoteName);
    await writeProfiles(filtered);
    await writeRcloneConfig(filtered);
    await fs.rm(profile.mountPath, { recursive: true, force: true });
  },

  async mountRemote(name: string): Promise<void> {
    const remoteName = normalizeName(name);
    const profiles = await readProfiles();
    const profile = profiles.find((item) => item.name === remoteName);

    if (!profile) {
      throw new Error("La unidad de red no existe.");
    }

    if (config.platform.isWindows) {
      return;
    }

    await ensureRcloneAvailable();
    await writeRcloneConfig(profiles);
    await fs.mkdir(profile.mountPath, { recursive: true });

    const mountTarget = getRemoteTarget(profile);
    const command = [
      "rclone mount",
      `"${mountTarget}"`,
      `"${profile.mountPath}"`,
      `--config "${RCLONE_CONFIG_FILE}"`,
      "--daemon",
      "--vfs-cache-mode full",
      "--dir-cache-time 5m",
      "--poll-interval 30s",
      "--umask 002",
    ].join(" ");

    log.info(`Montando ${mountTarget} en ${profile.mountPath}`);
    await execAsync(command);
  },

  async unmountRemote(name: string): Promise<void> {
    const remoteName = normalizeName(name);
    const profiles = await readProfiles();
    const profile = profiles.find((item) => item.name === remoteName);

    if (!profile) {
      throw new Error("La unidad de red no existe.");
    }

    if (config.platform.isWindows) {
      return;
    }

    try {
      await execAsync(`fusermount -u "${profile.mountPath}"`);
    } catch {
      await execAsync(`umount "${profile.mountPath}"`);
    }
  },
};
