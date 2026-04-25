import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const execAsync = promisify(exec);
const log = logger.child('disk-service');

export interface DiskHealth {
  device: string;
  model: string;
  status: 'PASSED' | 'FAILED' | 'UNKNOWN';
  temperature: number | null;
  powerOnHours: number | null;
  serialNumber: string;
}

export const DiskService = {
  /**
   * Escanea el sistema en busca de discos físicos (/dev/sdX) y obtiene su salud SMART
   */
  async getHealthStatus(): Promise<DiskHealth[]> {
    if (config.platform.isWindows) {
      return this.getMockData();
    }

    try {
      // 1. Encontrar dispositivos físicos
      const { stdout: devicesRaw } = await execAsync("ls /dev/sd[a-z] 2>/dev/null || true");
      const devices = devicesRaw.trim().split('\n').filter(d => d.length > 0);

      if (devices.length === 0) {
        log.info('No se detectaron dispositivos /dev/sdX físicos.');
        return [];
      }

      const healthResults: DiskHealth[] = [];

      for (const dev of devices) {
        try {
          // 2. Ejecutar smartctl para cada dispositivo
          // Nota: Usamos sudo porque smartctl suele requerir privilegios de root
          const { stdout } = await execAsync(`sudo smartctl -a ${dev}`);
          healthResults.push(this.parseSmartOutput(dev, stdout));
        } catch (error: any) {
          log.error(`Error leyendo SMART para ${dev}:`, error.message);
          // Intentar obtener al menos el modelo si el SMART falla
          healthResults.push({
            device: dev,
            model: 'Error al leer SMART',
            status: 'UNKNOWN',
            temperature: null,
            powerOnHours: null,
            serialNumber: 'N/A'
          });
        }
      }

      return healthResults;
    } catch (err: any) {
      log.error('Error fatal escaneando discos:', err.message);
      return [];
    }
  },

  /**
   * Parsea la salida de smartctl -a
   */
  parseSmartOutput(device: string, output: string): DiskHealth {
    const lines = output.split('\n');
    let model = 'Desconocido';
    let status: 'PASSED' | 'FAILED' | 'UNKNOWN' = 'UNKNOWN';
    let temperature: number | null = null;
    let powerOnHours: number | null = null;
    let serialNumber = 'Desconocido';

    for (const line of lines) {
      // Modelo
      if (line.includes('Device Model:') || line.includes('Model Family:')) {
        model = line.split(':')[1]?.trim() ?? 'Desconocido';
      }
      // Serial
      if (line.includes('Serial Number:')) {
        serialNumber = line.split(':')[1]?.trim() ?? 'Desconocido';
      }
      // Estado General
      if (line.includes('SMART overall-health self-assessment test result:')) {
        status = line.includes('PASSED') ? 'PASSED' : 'FAILED';
      }
      // Temperatura (ID 194 o 190)
      if (line.match(/^(190|194)\s+Temperature_Celsius/)) {
        const parts = line.trim().split(/\s+/);
        temperature = parseInt(parts[parts.length - 1] ?? "0");
      }
      // Horas de encendido (ID 9)
      if (line.match(/^9\s+Power_On_Hours/)) {
        const parts = line.trim().split(/\s+/);
        powerOnHours = parseInt(parts[parts.length - 1] ?? "0");
      }
    }

    return { device, model, status, temperature, powerOnHours, serialNumber };
  },

  /**
   * Datos de simulación para desarrollo
   */
  getMockData(): DiskHealth[] {
    return [
      {
        device: '/dev/sda',
        model: 'Samsung SSD 870 EVO 1TB',
        status: 'PASSED',
        temperature: 32,
        powerOnHours: 12450,
        serialNumber: 'S62SNX0N123456'
      },
      {
        device: '/dev/sdb',
        model: 'Seagate IronWolf 4TB (NAS)',
        status: 'PASSED',
        temperature: 41,
        powerOnHours: 45620,
        serialNumber: 'ZW12AB34'
      },
      {
        device: '/dev/sdc',
        model: 'WD Red PLUS 4TB',
        status: 'PASSED',
        temperature: 58, // Mock de aviso por temperatura
        powerOnHours: 8900,
        serialNumber: 'WCC7K1234567'
      }
    ];
  }
};
