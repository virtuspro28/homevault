import type { Server, Socket } from "socket.io";
import { exec, spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { attachSocketAuth } from "./socket-auth.js";
import { getSystemStats } from "./system-monitor.js";

const execAsync = promisify(exec);
const log = logger.child("monitor-socket");

async function buildDashboardStats() {
  const stats = getSystemStats();
  const mainDisk = stats.disks[0] || { totalGB: 0, usedGB: 0, freeGB: 0, usagePercent: 0 };
  const healthyDisks = stats.disks.length;

  let activeContainers = 0;
  try {
    const dockerModule = await import("../services/docker.service.js").catch(() => null);
    if (dockerModule && dockerModule.getContainers) {
      const containers = await dockerModule.getContainers();
      activeContainers = Array.isArray(containers) ? containers.filter((container) => container.state === "running").length : 0;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Error leyendo contenedores para telemetría del dashboard: ${message}`);
  }

  const uptimeSec = stats.uptime?.system || 0;
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const uptimeFormatted = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

  return {
    cpu: {
      usage: stats.cpu?.usagePercent || 0,
      cores: stats.cpu?.cores || 1,
    },
    ram: {
      percent: stats.memory?.usagePercent || 0,
      usedGb: ((stats.memory?.usedMB || 0) / 1024).toFixed(1),
      total: ((stats.memory?.totalMB || 0) / 1024).toFixed(1),
    },
    storage: {
      percent: mainDisk.usagePercent || 0,
      total: mainDisk.totalGB || 0,
      used: mainDisk.usedGB || 0,
      totalGb: mainDisk.totalGB || 0,
      freeGb: mainDisk.freeGB || 0,
      healthyDisks: healthyDisks || 1,
    },
    docker: {
      active: activeContainers,
    },
    security: {
      blockedToday: 0,
    },
    system: {
      uptimeFormatted: uptimeFormatted || "---",
    },
  };
}

export function setupMonitorSocket(io: Server) {
  const monitorNamespace = io.of("/monitor");
  attachSocketAuth(monitorNamespace, false);

  monitorNamespace.on("connection", (socket: Socket) => {
    let statsInterval: NodeJS.Timeout | null = null;
    let systemStatsInterval: NodeJS.Timeout | null = null;
    let logProcess: ChildProcessWithoutNullStreams | null = null;

    log.debug(`Client connected to monitor: ${socket.id}`);

    socket.on("docker:stats:subscribe", () => {
      if (statsInterval) return;

      log.info(`Broadcasting stats for client ${socket.id}`);

      const fetchStats = async () => {
        try {
          if (config.platform.isWindows) {
            const mock = [
              { ID: "e1234", Name: "Plex", CPUPerc: "2.5%", MemUsage: "450MiB", MemPerc: "12%", NetIO: "1MB/2MB", BlockIO: "0B/0B", PIDs: "12" },
              { ID: "a9876", Name: "Pi-hole", CPUPerc: "0.5%", MemUsage: "80MiB", MemPerc: "2%", NetIO: "500KB/100KB", BlockIO: "0B/0B", PIDs: "5" }
            ];
            socket.emit("docker:stats:data", mock);
            return;
          }

          const { stdout } = await execAsync('docker stats --no-stream --format "{{json .}}"');
          const lines = stdout.trim().split("\n").filter((line) => line.length > 0);
          const stats = lines.map((line) => JSON.parse(line));
          socket.emit("docker:stats:data", stats);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          log.error(`Error fetching docker stats: ${message}`);
          socket.emit("docker:stats:error", message);
        }
      };

      void fetchStats();
      statsInterval = setInterval(() => {
        void fetchStats();
      }, 2000);
    });

    socket.on("docker:stats:unsubscribe", () => {
      if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
        log.info(`Stopped stats for client ${socket.id}`);
      }
    });

    socket.on("system:stats:subscribe", () => {
      if (systemStatsInterval) return;

      const pushSystemStats = async () => {
        try {
          const payload = await buildDashboardStats();
          socket.emit("system:stats:data", payload);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          log.error(`Error fetching system stats: ${message}`);
          socket.emit("system:stats:error", message);
        }
      };

      void pushSystemStats();
      systemStatsInterval = setInterval(() => {
        void pushSystemStats();
      }, 5000);
    });

    socket.on("system:stats:unsubscribe", () => {
      if (systemStatsInterval) {
        clearInterval(systemStatsInterval);
        systemStatsInterval = null;
      }
    });

    socket.on("docker:logs:subscribe", (containerId: string) => {
      if (logProcess) {
        logProcess.kill();
      }

      log.info(`Streaming logs for container ${containerId} to client ${socket.id}`);

      logProcess = spawn("docker", ["logs", "-f", "--tail", "100", containerId]) as ChildProcessWithoutNullStreams;

      logProcess.stdout.on("data", (data: Buffer) => {
        socket.emit(`docker:logs:data:${containerId}`, data.toString());
      });

      logProcess.stderr.on("data", (data: Buffer) => {
        socket.emit(`docker:logs:data:${containerId}`, data.toString());
      });

      logProcess.on("error", (error: Error) => {
        socket.emit(`docker:logs:error:${containerId}`, error.message);
      });

      logProcess.on("close", () => {
        log.info(`Logs stream closed for ${containerId}`);
      });
    });

    socket.on("docker:logs:unsubscribe", () => {
      if (logProcess) {
        logProcess.kill();
        logProcess = null;
      }
    });

    socket.on("disconnect", () => {
      if (statsInterval) clearInterval(statsInterval);
      if (systemStatsInterval) clearInterval(systemStatsInterval);
      if (logProcess) logProcess.kill();
      log.debug(`Client disconnected from monitor: ${socket.id}`);
    });
  });
}
