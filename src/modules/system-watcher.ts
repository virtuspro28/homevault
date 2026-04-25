import { getSystemStats } from './system-monitor.js';
import { NotificationService } from '../services/notification.service.js';
import { config } from '../config/index.js';
import { TelemetryService } from '../services/telemetry.service.js';
import { logger } from '../utils/logger.js';
const log = logger.child('system-watcher');

const CHECK_INTERVAL_MS = 1000 * 60 * 5; // Cada 5 minutos
let watcherId: NodeJS.Timeout | null = null;
let lastAlertTimestamp = 0;
const ALERT_COOLDOWN_MS = 1000 * 60 * 60; // Evitar spam: máximo 1 alerta por hora si persiste el problema

/**
 * Inicia el monitoreo de temperatura y salud del sistema
 */
export function startSystemWatcher() {
  if (watcherId) return;

  log.info('Iniciando System Watcher...');
  TelemetryService.init();
  watcherId = setInterval(async () => {
    try {
      const stats = getSystemStats();
      const temp = stats.temperature.celsius;

      if (temp !== null) {
        // Obtener umbral de la configuración
        const config = await NotificationService.getConfig();
        const threshold = config.tempThreshold;

        if (temp > threshold) {
          const now = Date.now();
          if (now - lastAlertTimestamp > ALERT_COOLDOWN_MS) {
            log.warn(`¡Alerta! Temperatura crítica detectada: ${temp}°C`);
            await NotificationService.sendAlert(
              `🌡️ ALERTA DE TEMPERATURA\n\nEl sistema ha detectado una temperatura de ${temp}°C, superando el límite de ${threshold}°C.\n\nPor favor, verifica la ventilación de tu Raspberry Pi.`,
              'CRITICAL'
            );
            lastAlertTimestamp = now;
          }
        }
      }
      // Pushing network data to history buffer
      if (stats.network) {
        TelemetryService.pushNetworkData(stats.network.rxSpeed, stats.network.txSpeed);
      }
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Error en el loop del System Watcher:', errData);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Detiene el monitoreo (útil para tests o shutdown)
 */
export function stopSystemWatcher() {
  if (watcherId) {
    clearInterval(watcherId);
    watcherId = null;
  }
}
