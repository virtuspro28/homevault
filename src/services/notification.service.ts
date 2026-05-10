import { PrismaClient, type NotificationConfig } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();
const log = logger.child("notification-service");

export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";

async function ensureConfig(): Promise<NotificationConfig> {
  return prisma.notificationConfig.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      telegramEnabled: false,
      discordEnabled: false,
      tempThreshold: 75,
    },
  });
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

async function sendTelegramMessage(config: NotificationConfig, message: string): Promise<void> {
  if (!config.telegramEnabled || !config.telegramToken || !config.telegramChatId) {
    return;
  }

  const endpoint = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  const payload = {
    chat_id: config.telegramChatId,
    text: stripHtml(message),
    parse_mode: "HTML",
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Telegram respondió con HTTP ${response.status}`);
  }
}

async function sendDiscordMessage(config: NotificationConfig, message: string, level: AlertLevel): Promise<void> {
  if (!config.discordEnabled || !config.discordWebhookUrl) {
    return;
  }

  const color = level === "CRITICAL" ? 15158332 : level === "WARNING" ? 16763904 : 3447003;
  const payload = {
    embeds: [
      {
        title: `HomeVault ${level}`,
        description: stripHtml(message),
        color,
      },
    ],
  };

  const response = await fetch(config.discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discord respondió con HTTP ${response.status}`);
  }
}

export const NotificationService = {
  async getConfig(): Promise<NotificationConfig> {
    return ensureConfig();
  },

  async sendAlert(message: string, level: AlertLevel = "INFO"): Promise<void> {
    const currentConfig = await ensureConfig();
    const tasks: Promise<void>[] = [];

    if (currentConfig.telegramEnabled && currentConfig.telegramToken && currentConfig.telegramChatId) {
      tasks.push(sendTelegramMessage(currentConfig, message));
    }

    if (currentConfig.discordEnabled && currentConfig.discordWebhookUrl) {
      tasks.push(sendDiscordMessage(currentConfig, message, level));
    }

    if (tasks.length === 0) {
      log.info(`Alerta ${level} sin canales externos configurados`);
      return;
    }

    const results = await Promise.allSettled(tasks);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    if (failures.length > 0) {
      const errorMessage = failures.map((failure) => String(failure.reason)).join(" | ");
      log.error(`Fallo enviando alertas externas: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    log.info(`Alerta ${level} enviada a canales externos`);
  },
};
