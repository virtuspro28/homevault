import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
const log = logger.child('notification-service');

export type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

export const NotificationService = {
  /**
   * Obtiene la configuración global de notificaciones
   */
  async getConfig() {
    return await prisma.notificationConfig.upsert({
      where: { id: 'global' },
      update: {},
      create: { id: 'global' }
    });
  },

  /**
   * Envía una alerta a través de los canales configurados (Telegram/Discord)
   */
  async sendAlert(message: string, level: AlertLevel = 'INFO') {
    const config = await this.getConfig();
    const formattedMessage = this.formatMessage(message, level);

    const promises = [];

    // Enviar a Discord si está habilitado
    if (config.discordEnabled && config.discordWebhookUrl) {
      promises.push(this.sendToDiscord(config.discordWebhookUrl, formattedMessage, level));
    }

    // Enviar a Telegram si está habilitado
    if (config.telegramEnabled && config.telegramToken && config.telegramChatId) {
      promises.push(this.sendToTelegram(config.telegramToken, config.telegramChatId, formattedMessage));
    }

    if (promises.length === 0) {
      log.debug('Ningún canal de notificación habilitado. Alerta omitida.');
      return;
    }

    try {
      await Promise.all(promises);
      
      // Registrar en el historial de la DB
      await prisma.notificationActivity.create({
        data: {
          message: message,
          level: level
        }
      });

      log.info(`Alerta [${level}] enviada y registrada correctamente.`);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Error enviando algunas notificaciones:', errData);
    }
  },

  /**
   * Formatea el mensaje según el nivel
   */
  formatMessage(message: string, level: AlertLevel): string {
    const emojis = {
      INFO: 'ℹ️ [INFO]',
      WARNING: '⚠️ [AVISO]',
      CRITICAL: '🚨 [CRÍTICO]'
    };
    const timestamp = new Date().toLocaleString('es-ES');
    return `${emojis[level]} - ${timestamp}\n\n${message}`;
  },

  /**
   * Envío RAW a Discord Webhook
   */
  async sendToDiscord(url: string, content: string, level: AlertLevel) {
    const colors = {
      INFO: 3447003, // Blue
      WARNING: 16776960, // Yellow
      CRITICAL: 15158332 // Red
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            description: content,
            color: colors[level]
          }]
        })
      });
      if (!response.ok) throw new Error(`Discord API error: ${response.statusText}`);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Fallo al enviar a Discord:', errData);
      throw error;
    }
  },

  /**
   * Envío RAW a Telegram Bot API
   */
  async sendToTelegram(token: string, chatId: string, text: string) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });
      if (!response.ok) throw new Error(`Telegram API error: ${response.statusText}`);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Fallo al enviar a Telegram:', errData);
      throw error;
    }
  }
};
