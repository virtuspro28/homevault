import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const execAsync = promisify(exec);
const log = logger.child('hardware-service');

interface PowerStats {
  voltage: number;
  current: number;
  power: number;
  detected: boolean; // Nuevo
}

interface FanStats {
  rpm: number;
  pwm: number;
  auto: boolean;
  detected: boolean; // Nuevo
}

export const HardwareService = {
  private: {
    hwmonPath: '',
    thermalLoopRunning: false,
    currentStats: {
      power: { voltage: 5.0, current: 0.8, power: 4.0, detected: false },
      fan: { rpm: 0, pwm: 128, auto: true, detected: false }
    }
  },

  async init() {
    log.info('Inicializando Hardware Service (Fans & Power)...');
    this.detectHwmon();
    this.startThermalLoop();
  },

  /**
   * Detecta la ruta del controlador EMC2305 en hwmon
   */
  detectHwmon() {
    if (config.platform.isWindows) {
      this.private.currentStats.fan.detected = true;
      this.private.currentStats.power.detected = true;
      return;
    }
    try {
      const files = fs.readdirSync('/sys/class/hwmon');
      for (const file of files) {
        const name = fs.readFileSync(`/sys/class/hwmon/${file}/name`, 'utf8').trim();
        if (name === 'emc2305' || name === 'emc2103') {
          this.private.hwmonPath = `/sys/class/hwmon/${file}`;
          this.private.currentStats.fan.detected = true;
          log.info(`Controlador de ventilador detectado en: ${this.private.hwmonPath}`);
          return;
        }
      }
      this.private.currentStats.fan.detected = false;
    } catch (err) {
      this.private.currentStats.fan.detected = false;
      log.warn('No se detectó controlador de ventilador físico.');
    }
  },

  /**
   * Obtiene telemetría de energía (INA238)
   */
  async getPowerTelemetry(): Promise<PowerStats> {
    if (config.platform.isWindows) {
      // Mock dinámico en Windows
      this.private.currentStats.power.current = parseFloat((0.5 + Math.random() * 0.5).toFixed(2));
      this.private.currentStats.power.power = parseFloat((this.private.currentStats.power.voltage * this.private.currentStats.power.current).toFixed(2));
      return this.private.currentStats.power;
    }

    if (!this.private.currentStats.power.detected) {
      return this.private.currentStats.power;
    }

    try {
      // Usamos un timeout corto para evitar bloqueos
      const { stdout: vRaw } = await execAsync('i2cget -y 1 0x40 0x01 w', { timeout: 1000 });
      const { stdout: pRaw } = await execAsync('i2cget -y 1 0x40 0x08 w', { timeout: 1000 });
      
      const voltage = parseInt(vRaw, 16) * 0.003125; // 3.125mV LSB
      const power = parseInt(pRaw, 16) * 0.01;       // Asumiendo calibración de 10mW LSB

      this.private.currentStats.power = {
        voltage: parseFloat(voltage.toFixed(3)),
        power: parseFloat(power.toFixed(2)),
        current: parseFloat((power / voltage).toFixed(3)),
        detected: true
      };
    } catch (err) {
      log.debug('INA238 no respondio, desactivando deteccion de energia');
      this.private.currentStats.power.detected = false;
    }

    return this.private.currentStats.power;
  },

  /**
   * Obtiene telemetría de ventiladores
   */
  async getFanTelemetry(): Promise<FanStats> {
    if (!this.private.hwmonPath || config.platform.isWindows) {
      // Mock en Windows o si no hay hardware
      const targetRpm = (this.private.currentStats.fan.pwm / 255) * 5000;
      this.private.currentStats.fan.rpm = Math.floor(targetRpm + (Math.random() * 100 - 50));
      return this.private.currentStats.fan;
    }

    try {
      const rpm = fs.readFileSync(`${this.private.hwmonPath}/fan1_input`, 'utf8').trim();
      const pwm = fs.readFileSync(`${this.private.hwmonPath}/pwm1`, 'utf8').trim();
      
      this.private.currentStats.fan.rpm = parseInt(rpm);
      this.private.currentStats.fan.pwm = parseInt(pwm);
    } catch (err) {
      log.error('Error leyendo sysfs de ventilador');
    }
    return this.private.currentStats.fan;
  },

  /**
   * Establece el PWM del ventilador manualmente
   */
  async setFanPWM(value: number) {
    const val = Math.max(0, Math.min(255, value));
    this.private.currentStats.fan.pwm = val;
    this.private.currentStats.fan.auto = false; // Desactiva auto si el usuario toca manual

    if (this.private.hwmonPath && !config.platform.isWindows) {
      try {
        fs.writeFileSync(`${this.private.hwmonPath}/pwm1`, val.toString());
      } catch (err) {
        log.error('Error escribiendo PWM en hardware');
      }
    }
  },

  /**
   * Lógica de Curva Térmica
   */
  startThermalLoop() {
    if (this.private.thermalLoopRunning) return;
    this.private.thermalLoopRunning = true;

    setInterval(async () => {
      if (!this.private.currentStats.fan.auto) return;

      try {
        // Obtenemos temperatura (Mockable)
        const temp = await this.getCPUTemp();
        let targetPWM = 50; // default 20% aprox

        if (temp > 70) targetPWM = 255;      // 100%
        else if (temp > 60) targetPWM = 200; // 80%
        else if (temp > 50) targetPWM = 130; // 50%
        else if (temp > 40) targetPWM = 80;  // 30%
        else targetPWM = 50;                 // 20%

        // Suavizado (opcional)
        if (Math.abs(this.private.currentStats.fan.pwm - targetPWM) > 10) {
           this.updateHardwarePWM(targetPWM);
        }
      } catch (err) {
        log.error('Fallo en Thermal Loop');
      }
    }, 5000);
  },

  async getCPUTemp(): Promise<number> {
    if (config.platform.isWindows) return 45 + Math.random() * 5;
    try {
      const tempStr = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
      return parseInt(tempStr) / 1000;
    } catch {
      return 50;
    }
  },

  updateHardwarePWM(val: number) {
    this.private.currentStats.fan.pwm = val;
    if (this.private.hwmonPath && !config.platform.isWindows) {
      try {
        fs.writeFileSync(`${this.private.hwmonPath}/pwm1`, val.toString());
      } catch {}
    }
  },

  async getCombinedStatus() {
    let disks: any[] = [];

    try {
      const { DiskService } = await import("./disk.service.js");
      disks = await DiskService.getHealthStatus();
    } catch (e) {
      log.warn("Error obteniendo salud de discos para telemetría");
    }

    return {
      power: await this.getPowerTelemetry(),
      fan: await this.getFanTelemetry(),
      cpuTemp: await this.getCPUTemp(),
      disks: disks
    };
  }

};
