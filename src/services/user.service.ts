import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { QuotaService } from './quota.service.js';

const prisma = new PrismaClient();
const log = logger.child('user-service');

export const UserService = {
  /**
   * Crea un nuevo usuario en la base de datos
   */
  async createUser(data: { username: string; password: string; role: string; storageQuota?: number }) {
    const { username, password, role, storageQuota } = data;
    
    // Validar si el usuario ya existe
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new Error(`El usuario '${username}' ya existe.`);
    }

    const hashed = await hashPassword(password);

    try {
      const user = await prisma.user.create({
        data: {
          username,
          password: hashed,
          role: role || 'USER',
          storageQuota: storageQuota || 0,
        },
        select: {
          id: true,
          username: true,
          role: true,
          storageQuota: true,
          createdAt: true,
        }
      });

      log.info(`Usuario creado: ${username} [Rol: ${role}]`);
      return user;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Error creando usuario ${username}:`, errData);
      throw new Error('Fallo al guardar usuario en la base de datos');
    }
  },

  /**
   * Lista todos los usuarios (sin contraseña)
   */
  async listUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        storageQuota: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Enriquecer con uso real de disco
    return await Promise.all(users.map(async (u) => ({
      ...u,
      storageUsed: await QuotaService.getUserUsage(u.username)
    })));
  },

  /**
   * Actualiza permisos o cuota de un usuario
   */
  async updatePermissions(userId: string, data: { role?: string; storageQuota?: number }) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          username: true,
          role: true,
          storageQuota: true,
        }
      });

      log.info(`Permisos actualizados para user ${user.username}`);
      return user;
    } catch (error: unknown) {
      const errData = error instanceof Error ? { error: error.message } : { error: String(error) };
      log.error(`Error actualizando permisos para user ${userId}:`, errData);
      throw new Error('No se pudo actualizar el usuario');
    }
  },

  /**
   * Elimina un usuario por ID
   */
  async deleteUser(userId: string) {
    try {
      // No permitir borrar el último administrador o a uno mismo (lógica simple)
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          throw new Error('No se puede eliminar al único administrador del sistema.');
        }
      }

      await prisma.user.delete({ where: { id: userId } });
      log.info(`Usuario eliminado ID: ${userId}`);
      return true;
    } catch (error: any) {
      log.error(`Error eliminando usuario ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Restablece la contraseña de un usuario
   */
  async resetPassword(userId: string, newPassword: string) {
    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });
    log.info(`Contraseña restablecida para usuario ID: ${userId}`);
  }
};
