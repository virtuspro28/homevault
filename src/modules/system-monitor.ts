/**
 * ═══════════════════════════════════════════════════════════════
 *  HomeVault Dashboard — Monitor del Sistema Multi-Plataforma
 * ═══════════════════════════════════════════════════════════════
 *
 *  Recopila métricas de hardware usando SOLO módulos nativos de Node.
 *  Compatible con:
 *  - Linux ARM (Raspberry Pi, Orange Pi)
 *  - Linux x64 (servidores, Mini PCs)
 *  - Windows x64 (desarrollo)
 *
 *  Decisión de diseño: Caché con TTL para evitar lecturas
 *  excesivas al filesystem en RPi (reduce I/O en SD cards).
 * ═══════════════════════════════════════════════════════════════
 */

import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const log = logger.child("system-monitor");

/* ═══════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════ */

export interface CpuInfo {
  model: string;
  cores: number;
  usagePercent: number;
}

export interface MemoryInfo {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  usagePercent: number;
}

export interface DiskInfo {
  filesystem: string;
  mountpoint: string;
  totalGB: number;
  usedGB: number;
  freeGB: number;
  usagePercent: number;
}

export interface TemperatureInfo {
  celsius: number | null;
  source: string;
  available: boolean;
}

export interface NetworkInfo {
  rxSpeed: number; // bytes por segundo
  txSpeed: number;
  interface: string;
}

export interface DiskBreakdown {
  media: number; // porcentaje
  apps: number;
  system: number;
  other: number;
}

export interface SystemStats {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disks: DiskInfo[];
  network: NetworkInfo;
  diskBreakdown: DiskBreakdown;
  temperature: TemperatureInfo;
  uptime: {
    system: number;
    process: number;
  };
  loadAverage: number[];
  timestamp: string;
}

export interface SystemHardwareInfo {
  architecture: string;
  platform: string;
  isARM: boolean;
  cpuModel: string;
  cpuCores: number;
  totalMemoryMB: number;
  memoryTier: string;
  hostname: string;
  nodeVersion: string;
}

/* ═══════════════════════════════════════════════════════════════
   CACHÉ DE MÉTRICAS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Caché simple con TTL para métricas.
 * Evita lecturas repetidas al filesystem en intervalos cortos.
 * TTL por defecto: 2 segundos (suficiente para dashboards con polling).
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_CACHE_TTL_MS = 2000;

function getCached<T>(key: string, ttl: number = DEFAULT_CACHE_TTL_MS): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry === undefined) return null;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/* ═══════════════════════════════════════════════════════════════
   CPU
   ═══════════════════════════════════════════════════════════════ */

/** Snapshot previo de CPU para cálculo de porcentaje */
let previousCpuTimes: { idle: number; total: number } | null = null;

/**
 * Calcula los tiempos agregados de CPU.
 * Suma todos los cores para obtener un valor total.
 */
function getCpuTimes(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }

  return { idle, total };
}

/**
 * Calcula el uso de CPU como porcentaje entre dos snapshots.
 *
 * En la primera llamada devuelve 0 porque no hay snapshot previo.
 * A partir de la segunda, calcula el delta real de uso.
 * No bloquea el event loop.
 */
function getCpuUsage(): CpuInfo {
  const cached = getCached<CpuInfo>("cpu");
  if (cached !== null) return cached;

  const cpus = os.cpus();
  const currentTimes = getCpuTimes();
  let usagePercent = 0;

  if (previousCpuTimes !== null) {
    const idleDelta = currentTimes.idle - previousCpuTimes.idle;
    const totalDelta = currentTimes.total - previousCpuTimes.total;

    if (totalDelta > 0) {
      usagePercent = Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
    }
  }

  previousCpuTimes = currentTimes;

  const result: CpuInfo = {
    model: cpus[0]?.model ?? "Desconocido",
    cores: cpus.length,
    usagePercent,
  };

  setCache("cpu", result);
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   MEMORIA
   ═══════════════════════════════════════════════════════════════ */

function getMemoryInfo(): MemoryInfo {
  const cached = getCached<MemoryInfo>("memory");
  if (cached !== null) return cached;

  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  const result: MemoryInfo = {
    totalMB: Math.round(totalBytes / 1024 / 1024),
    usedMB: Math.round(usedBytes / 1024 / 1024),
    freeMB: Math.round(freeBytes / 1024 / 1024),
    usagePercent: Math.round((usedBytes / totalBytes) * 100),
  };

  setCache("memory", result);
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   DISCO
   ═══════════════════════════════════════════════════════════════ */

/**
 * Obtiene información de discos montados.
 *
 * Multi-plataforma:
 * - Linux: Ejecuta `df -BG` y parsea la salida
 * - Windows: Ejecuta `wmic logicaldisk` y parsea la salida
 *
 * Los errores se capturan silenciosamente y devuelven array vacío.
 * Esto es importante en ARM donde ciertos discos pueden no estar montados.
 */
function getDiskInfo(): DiskInfo[] {
  const cached = getCached<DiskInfo[]>("disks", 10000); // Cache 10s para disco
  if (cached !== null) return cached;

  try {
    let disks: DiskInfo[];

    if (config.platform.isLinux) {
      disks = getDiskInfoLinux();
    } else if (config.platform.isWindows) {
      disks = getDiskInfoWindows();
    } else {
      log.warn("Plataforma no soportada para métricas de disco");
      disks = [];
    }

    setCache("disks", disks);
    return disks;
  } catch (error: unknown) {
    log.errorWithStack("Error al obtener información de disco", error);
    return [];
  }
}

function getDiskInfoLinux(): DiskInfo[] {
  /**
   * df -BG: Muestra tamaños en gigabytes enteros
   * --output: Selecciona columnas específicas
   * Filtramos /dev/ y /media/ para mostrar solo discos reales
   */
  const output = execSync("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null", {
    encoding: "utf-8",
    timeout: 5000,
  });

  const lines = output.trim().split("\n").slice(1); // Skip header
  const disks: DiskInfo[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;

    const filesystem = parts[0] ?? "";
    // Solo discos reales (excluir tmpfs, devtmpfs, etc.)
    if (!filesystem.startsWith("/dev/") && !filesystem.includes("://")) continue;

    const mountpoint = parts[1] ?? "";
    const totalGB = parseFloat(parts[2] ?? "0");
    const usedGB = parseFloat(parts[3] ?? "0");
    const freeGB = parseFloat(parts[4] ?? "0");
    const usagePercent = parseInt(parts[5] ?? "0", 10);

    disks.push({ filesystem, mountpoint, totalGB, usedGB, freeGB, usagePercent });
  }

  return disks;
}

function getDiskInfoWindows(): DiskInfo[] {
  /**
   * wmic está deprecado en Windows 11+.
   * Usamos PowerShell con Get-CimInstance que funciona en Win10/11.
   * -NoProfile evita cargar perfil de usuario (más rápido).
   * ConvertTo-Json asegura un parseo fiable de la salida.
   */
  const psCommand = `powershell.exe -NoProfile -Command "Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, Size, FreeSpace | ConvertTo-Json -Compress"`;
  const output = execSync(psCommand, { encoding: "utf-8", timeout: 10000 });

  const disks: DiskInfo[] = [];

  try {
    // PowerShell devuelve un objeto si hay 1 disco, o un array si hay varios
    const parsed: unknown = JSON.parse(output.trim());
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    for (const entry of entries) {
      const disk = entry as { DeviceID?: string; Size?: number; FreeSpace?: number };
      const caption = disk.DeviceID ?? "??";
      const totalBytes = disk.Size ?? 0;
      const freeBytes = disk.FreeSpace ?? 0;

      if (totalBytes === 0) continue;

      const usedBytes = totalBytes - freeBytes;
      const totalGB = Math.round(totalBytes / 1024 / 1024 / 1024);
      const usedGB = Math.round(usedBytes / 1024 / 1024 / 1024);
      const freeGB = Math.round(freeBytes / 1024 / 1024 / 1024);
      const usagePercent = Math.round((usedBytes / totalBytes) * 100);

      disks.push({
        filesystem: caption,
        mountpoint: caption,
        totalGB,
        usedGB,
        freeGB,
        usagePercent,
      });
    }
  } catch {
    log.warn("No se pudo parsear la información de disco en Windows");
  }

  return disks;
}

/* ═══════════════════════════════════════════════════════════════
   TEMPERATURA
   ═══════════════════════════════════════════════════════════════ */

/**
 * Lee la temperatura del CPU.
 *
 * Multi-plataforma:
 * - Linux (RPi): Lee de /sys/class/thermal/thermal_zone0/temp
 * - Linux (general): Intenta lm-sensors via sysfs
 * - Windows: No disponible nativamente → devuelve null
 *
 * En RPi, esta lectura es directa y sin overhead.
 */
function getTemperature(): TemperatureInfo {
  const cached = getCached<TemperatureInfo>("temperature", 5000); // Cache 5s
  if (cached !== null) return cached;

  const result: TemperatureInfo = {
    celsius: null,
    source: "unavailable",
    available: false,
  };

  if (config.platform.isLinux) {
    try {
      // Ruta estándar en Raspberry Pi y la mayoría de SBCs ARM
      const thermalPath = "/sys/class/thermal/thermal_zone0/temp";
      if (fs.existsSync(thermalPath)) {
        const raw = fs.readFileSync(thermalPath, "utf-8").trim();
        const millidegrees = parseInt(raw, 10);
        if (!isNaN(millidegrees)) {
          result.celsius = Math.round(millidegrees / 100) / 10; // ej: 54312 → 54.3
          result.source = "thermal_zone0";
          result.available = true;
        }
      }
    } catch {
      log.debug("No se pudo leer temperatura del CPU");
    }
  }

  // En Windows no hay acceso nativo a la temperatura sin herramientas externas
  if (config.platform.isWindows) {
    result.source = "not_supported_on_windows";
  }

  setCache("temperature", result);
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   RED (NETWORK)
   ═══════════════════════════════════════════════════════════════ */

let lastNetFetch = 0;
let lastRxBytes = 0;
let lastTxBytes = 0;

/**
 * Calcula la velocidad de red (Rx/Tx) leyendo /proc/net/dev en Linux.
 * En Windows devuelve 0.
 */
function getNetworkInfo(): NetworkInfo {
  const result: NetworkInfo = { rxSpeed: 0, txSpeed: 0, interface: "default" };
  
  if (config.platform.isLinux) {
    try {
      const data = fs.readFileSync("/proc/net/dev", "utf-8");
      const lines = data.split("\n");
      
      let currentRx = 0;
      let currentTx = 0;
      
      // Sumamos todas las interfaces físicas (excluimos lo)
      for (const line of lines) {
        if (line.includes(":") && !line.includes("lo:")) {
          const parts = line.trim().split(/\s+/);
          currentRx += parseInt(parts[1] || "0", 10);
          currentTx += parseInt(parts[9] || "0", 10);
        }
      }

      const now = Date.now();
      const deltaSec = (now - lastNetFetch) / 1000;

      if (lastNetFetch > 0 && deltaSec > 0) {
        result.rxSpeed = Math.round((currentRx - lastRxBytes) / deltaSec);
        result.txSpeed = Math.round((currentTx - lastTxBytes) / deltaSec);
      }

      lastNetFetch = now;
      lastRxBytes = currentRx;
      lastTxBytes = currentTx;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.debug("Error leyendo métricas de red:", errData);
    }
  }

  return result;
}

/**
 * Simula el desglose de uso de disco para la UI avanzado
 */
function getDiskBreakdown(): DiskBreakdown {
  // Simulación: En un futuro esto vendrá de un escaneo periódico de directorios
  return {
    media: 45,
    apps: 20,
    system: 15,
    other: 20
  };
}

/* ═══════════════════════════════════════════════════════════════
   API PÚBLICA
   ═══════════════════════════════════════════════════════════════ */

/**
 * Devuelve todas las métricas del sistema en tiempo real.
 * Diseñado para ser llamado desde rutas API con polling periódico.
 */
export function getSystemStats(): SystemStats {
  return {
    cpu: getCpuUsage(),
    memory: getMemoryInfo(),
    disks: getDiskInfo(),
    network: getNetworkInfo(),
    diskBreakdown: getDiskBreakdown(),
    temperature: getTemperature(),
    uptime: {
      system: Math.round(os.uptime()),
      process: Math.round(process.uptime()),
    },
    /**
     * Load average: solo disponible en Linux/macOS.
     * En Windows devuelve [0, 0, 0].
     * En RPi, valores > número de cores indican saturación.
     */
    loadAverage: os.loadavg().map((v) => Math.round(v * 100) / 100),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Devuelve información estática del hardware.
 * No cambia durante la vida del proceso → no necesita caché.
 */
export function getHardwareInfo(): SystemHardwareInfo {
  return {
    architecture: config.platform.arch,
    platform: config.platform.os,
    isARM: config.platform.isARM,
    cpuModel: os.cpus()[0]?.model ?? "Desconocido",
    cpuCores: config.platform.cpuCores,
    totalMemoryMB: config.platform.totalMemoryMB,
    memoryTier: config.platform.memoryTier,
    hostname: config.platform.hostname,
    nodeVersion: config.platform.nodeVersion,
  };
}
