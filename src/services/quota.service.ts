import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
const log = logger.child('quota-service');

export class QuotaService {
  /**
   * Calculates total disk usage in bytes for a specific user.
   * Assumes user files are in /mnt/storage/users/{username}
   */
  static async getUserUsage(username: string): Promise<number> {
    const userDir = path.join(config.storage.basePath, 'users', username);
    
    try {
      // Check if directory exists, if not, it means usage is 0
      try {
        await fs.access(userDir);
      } catch {
        return 0;
      }

      const calculateSize = async (dirPath: string): Promise<number> => {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        let totalSize = 0;

        for (const file of files) {
          const fullPath = path.join(dirPath, file.name);
          if (file.isDirectory()) {
            totalSize += await calculateSize(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        }
        return totalSize;
      };

      return await calculateSize(userDir);
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Failed to calculate usage for ${username}:`, errData);
      return 0;
    }
  }

  /**
   * Checks if a user has enough remaining quota to store a new file.
   */
  static async canUpload(userId: string, username: string, newFileSize: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageQuota: true }
    });

    if (!user || user.storageQuota === 0) return true; // 0 = unlimited

    const currentUsage = await this.getUserUsage(username);
    return (currentUsage + newFileSize) <= user.storageQuota;
  }
}
