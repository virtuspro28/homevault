import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const log = logger.child("ddns-service");
const DDNS_FILE = path.join(config.paths.data, "ddns-profiles.json");

export type DdnsProvider = "duckdns" | "noip" | "custom";

export interface DdnsProfile {
  id: string;
  name: string;
  provider: DdnsProvider;
  domain: string;
  username?: string;
  password?: string;
  token?: string;
  updateUrl?: string;
  enabled: boolean;
  lastStatus?: "success" | "error";
  lastMessage?: string;
  lastCheckedAt?: string;
}

export interface DdnsPayload {
  name: string;
  provider: DdnsProvider;
  domain: string;
  username?: string;
  password?: string;
  token?: string;
  updateUrl?: string;
  enabled?: boolean;
}

function sanitizeProfileInput(payload: DdnsPayload, current?: DdnsProfile): DdnsProfile {
  const provider = payload.provider;
  if (!["duckdns", "noip", "custom"].includes(provider)) {
    throw new Error("Proveedor DDNS no soportado.");
  }

  const profile: DdnsProfile = {
    id: current?.id ?? randomUUID(),
    name: payload.name.trim(),
    provider,
    domain: payload.domain.trim(),
    enabled: payload.enabled ?? current?.enabled ?? true,
  };

  const username = payload.username?.trim();
  const password = payload.password?.trim();
  const token = payload.token?.trim();
  const updateUrl = payload.updateUrl?.trim();

  if (username) profile.username = username;
  if (password) profile.password = password;
  if (token) profile.token = token;
  if (updateUrl) profile.updateUrl = updateUrl;
  if (current?.lastStatus) profile.lastStatus = current.lastStatus;
  if (current?.lastMessage) profile.lastMessage = current.lastMessage;
  if (current?.lastCheckedAt) profile.lastCheckedAt = current.lastCheckedAt;

  if (!profile.name) throw new Error("El nombre del perfil DDNS es obligatorio.");
  if (!profile.domain) throw new Error("El dominio DDNS es obligatorio.");

  if (provider === "duckdns" && !profile.token) {
    throw new Error("DuckDNS requiere token.");
  }
  if (provider === "noip" && (!profile.username || !profile.password)) {
    throw new Error("No-IP requiere usuario y contraseña.");
  }
  if (provider === "custom" && !profile.updateUrl) {
    throw new Error("El proveedor manual requiere URL de actualización.");
  }

  return profile;
}

async function readProfiles(): Promise<DdnsProfile[]> {
  try {
    const raw = await fs.readFile(DDNS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return [];
    }
    log.errorWithStack("Error leyendo perfiles DDNS", error);
    return [];
  }
}

async function writeProfiles(profiles: DdnsProfile[]): Promise<void> {
  await fs.mkdir(config.paths.data, { recursive: true });
  await fs.writeFile(DDNS_FILE, JSON.stringify(profiles, null, 2), "utf-8");
}

function buildUpdateRequest(profile: DdnsProfile): { url: string; init?: RequestInit } {
  if (profile.provider === "duckdns") {
    return {
      url: `https://www.duckdns.org/update?domains=${encodeURIComponent(profile.domain)}&token=${encodeURIComponent(profile.token ?? "")}&ip=`,
    };
  }

  if (profile.provider === "noip") {
    return {
      url: `https://dynupdate.no-ip.com/nic/update?hostname=${encodeURIComponent(profile.domain)}`,
      init: {
        headers: {
          Authorization: `Basic ${Buffer.from(`${profile.username}:${profile.password}`).toString("base64")}`,
          "User-Agent": "homevault-ddns/1.0",
        },
      },
    };
  }

  const url = (profile.updateUrl ?? "")
    .replace("{domain}", encodeURIComponent(profile.domain))
    .replace("{username}", encodeURIComponent(profile.username ?? ""))
    .replace("{password}", encodeURIComponent(profile.password ?? ""))
    .replace("{token}", encodeURIComponent(profile.token ?? ""));

  return { url };
}

async function updateProfileStatus(profileId: string, data: Partial<DdnsProfile>): Promise<void> {
  const profiles = await readProfiles();
  const nextProfiles = profiles.map((profile) =>
    profile.id === profileId ? { ...profile, ...data } : profile,
  );
  await writeProfiles(nextProfiles);
}

export const DdnsService = {
  getProviderOptions() {
    return [
      { id: "duckdns", name: "DuckDNS" },
      { id: "noip", name: "No-IP" },
      { id: "custom", name: "Manual / Custom URL" },
    ];
  },

  async listProfiles(): Promise<DdnsProfile[]> {
    return readProfiles();
  },

  async createProfile(payload: DdnsPayload): Promise<DdnsProfile> {
    const profiles = await readProfiles();
    const profile = sanitizeProfileInput(payload);
    profiles.push(profile);
    await writeProfiles(profiles);
    return profile;
  },

  async updateProfile(id: string, payload: DdnsPayload): Promise<DdnsProfile> {
    const profiles = await readProfiles();
    const current = profiles.find((profile) => profile.id === id);
    if (!current) {
      throw new Error("Perfil DDNS no encontrado.");
    }

    const nextProfile = sanitizeProfileInput(payload, current);
    const nextProfiles = profiles.map((profile) => (profile.id === id ? nextProfile : profile));
    await writeProfiles(nextProfiles);
    return nextProfile;
  },

  async deleteProfile(id: string): Promise<void> {
    const profiles = await readProfiles();
    const nextProfiles = profiles.filter((profile) => profile.id !== id);
    if (nextProfiles.length === profiles.length) {
      throw new Error("Perfil DDNS no encontrado.");
    }
    await writeProfiles(nextProfiles);
  },

  async syncProfile(id: string): Promise<DdnsProfile> {
    const profiles = await readProfiles();
    const profile = profiles.find((item) => item.id === id);
    if (!profile) {
      throw new Error("Perfil DDNS no encontrado.");
    }

    const { url, init } = buildUpdateRequest(profile);
    const checkedAt = new Date().toISOString();

    try {
      const response = await fetch(url, init);
      const text = await response.text();
      const success = response.ok && !/badauth|911|dnserr|badagent|notfqdn/i.test(text);

      const nextProfile = {
        ...profile,
        lastStatus: success ? "success" : "error",
        lastMessage: text.trim() || response.statusText,
        lastCheckedAt: checkedAt,
      } satisfies DdnsProfile;

      await writeProfiles(profiles.map((item) => (item.id === id ? nextProfile : item)));
      return nextProfile;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido actualizando DDNS";
      await updateProfileStatus(id, {
        lastStatus: "error",
        lastMessage: message,
        lastCheckedAt: checkedAt,
      });
      throw new Error(message);
    }
  },

  async getPreferredHostname(): Promise<string | null> {
    const profiles = await readProfiles();
    const preferred = profiles.find((profile) => profile.enabled && profile.domain);
    return preferred?.domain ?? null;
  },
};
