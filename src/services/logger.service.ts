import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { NotificationService, AlertLevel } from './notification.service.js';

const prisma = new PrismaClient();
const log = logger.child('logger-service');

export type EventCategory = 'SECURITY' | 'STORAGE' | 'POWER' | 'SYSTEM' | 'DOCKER' | 'BACKUP';

export const LoggerService = {
  /**
   * Centralized logging method.
   * Persists to DB, logs to stdout, and optionally triggers external notifications.
   */
  async log(entry: { 
    message: string, 
    level: AlertLevel, 
    category: EventCategory, 
    notifyExternal?: boolean 
  }) {
    const { message, level, category, notifyExternal } = entry;

    try {
      // 1. Save to Database (using unified table)
      const event = await prisma.notificationActivity.create({
        data: {
          message,
          level,
          category,
          isRead: false
        }
      });

      // 2. Log to system output using existing util
      const logMethod = level === 'CRITICAL' ? 'error' : level === 'WARNING' ? 'warn' : 'info';
      log[logMethod](`[${category}] ${message}`);

      // 3. Optional: Notify External Channels (Telegram/Discord)
      // If notification level is CRITICAL, we always notify external channels
      if (notifyExternal || level === 'CRITICAL') {
        await NotificationService.sendAlert(message, level);
      }

      // 4. Return the created event for socket emitting (done in routes/sockets)
      return event;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error('Failed to log event:', errData);
      throw error;
    }
  },

  info(message: string, category: EventCategory = 'SYSTEM') {
    return this.log({ message, level: 'INFO', category });
  },

  warn(message: string, category: EventCategory = 'SYSTEM') {
    return this.log({ message, level: 'WARNING', category });
  },

  critical(message: string, category: EventCategory = 'SYSTEM') {
    return this.log({ message, level: 'CRITICAL', category });
  }
};
