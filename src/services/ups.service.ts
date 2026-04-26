import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { config as appConfig } from "../config/index.js";
import { NotificationService } from "./notification.service.js";

const execAsync = promisify(exec);
const log = logger.child("ups-service");
const prisma = new PrismaClient();

export interface UpsStatus {
  charge: number;     // 0-100%
  runtime: number;    // segundos
  status: string;     // OL (Online), OB (On Battery), LB (Low Battery)
  load: number;       // 0-100%
  voltage?: number;
  detected: boolean;  // Nuevo
}

let monitorInterval: NodeJS.Timeout | null = null;
let lastStatus: string | null = null;

export const UpsService = {
  /**
   * Obtiene el estado del SAI usando upsc
   */
  async getStatus(): Promise<UpsStatus> {
    if (appConfig.platform.isWindows) {
      return {
        charge: 85,
        runtime: 1200,
        status: "OL",
        load: 12,
        voltage: 230,
        detected: true
      };
    }

    try {
      // Intentamos leer del dispositivo 'ups' (estándar NUT)
      const { stdout } = await execAsync("upsc ups");
      const lines = stdout.split("\n");
      const data: any = {};

      lines.forEach(line => {
        const [key, val] = line.split(": ");
        if (key && val) data[key.trim()] = val.trim();
      });

      return {
        charge: parseInt(data["battery.charge"] || "0"),
        runtime: parseInt(data["battery.runtime"] || "0"),
        status: data["ups.status"] || "UNKNOWN",
        load: parseInt(data["ups.load"] || "0"),
        voltage: parseFloat(data["input.voltage"] || "0"),
        detected: true
      };
    } catch (err: any) {
      return {
        charge: 0,
        runtime: 0,
        status: "DISCONNECTED",
        load: 0,
        detected: false
      };
    }
  },

  /**
   * Inicia el monitor en segundo plano
   */
  startMonitoring() {
    if (monitorInterval) return;

    log.info("Iniciando monitor de energía UPS...");
    monitorInterval = setInterval(async () => {
      try {
        const stats = await this.getStatus();
        await this.evaluateSafety(stats);
      } catch (err) {
        // Silenciamos errores de conexión para no llenar el log
      }
    }, 30000); // Cada 30 segundos
  },

  /**
   * Lógica de seguridad y apagado automático
   */
  async evaluateSafety(stats: UpsStatus) {
    // 1. Detectar cambio de estado (Corriente -> Batería)
    if (lastStatus === "OL" && stats.status.includes("OB")) {
      await prisma.powerEvent.create({
        data: { type: "ON_BATTERY", message: "CORTE DE LUZ: El sistema está funcionando con batería." }
      });
      NotificationService.sendAlert("Corte de luz detectado. HomeVault funcionando con batería.", "CRITICAL");
    }

    if (lastStatus?.includes("OB") && stats.status === "OL") {
      await prisma.powerEvent.create({
        data: { type: "AC_RESTORED", message: "ENERGÍA RESTAURADA: Alimentación AC detectada." }
      });
      NotificationService.sendAlert("Energía restaurada. El sistema vuelve a red eléctrica.", "INFO");
    }

    lastStatus = stats.status;

    // 2. Lógica de apagado de emergencia (Safe Shutdown)
    const isCriticalBattery = stats.charge < 15;
    const isCriticalRuntime = stats.runtime > 0 && stats.runtime < 300; // Menos de 5 min

    if (stats.status.includes("OB") && (isCriticalBattery || isCriticalRuntime)) {
      log.fatal("Nivel de batería CRÍTICO. Iniciando apagado seguro...");
      
      await prisma.powerEvent.create({
        data: { type: "SHUTDOWN_INITIATED", message: `APAGADO AUTOMÁTICO: Batería al ${stats.charge}% (${Math.round(stats.runtime/60)} min restantes).` }
      });

      if (!appConfig.platform.isWindows) {
        await execAsync("sudo shutdown -h now");
      }
    }
  },

  async getEvents() {
    return await prisma.powerEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20
    });
  }
};
