import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child('files-service');
const DEFAULT_STORAGE_ROOT = config.paths.data;

function normalizeRequestedPath(reqPath: string = ''): string {
  const trimmed = String(reqPath ?? '').trim();

  if (!trimmed || trimmed === '/' || trimmed === '.') {
    return '';
  }

  return trimmed.replace(/^\/+/, '');
}

export interface FileItem {
  name: string;
  path: string; // Relative path from storage root
  isDirectory: boolean;
  size: number;
  extension: string;
  mtime: Date;
}

function getStorageBasePath(): string {
  const configuredBasePath = String(config.storage.basePath ?? '').trim();
  const basePath = configuredBasePath || DEFAULT_STORAGE_ROOT;
  return path.resolve(basePath);
}

export async function ensureStorageRootExists(): Promise<string> {
  const basePath = getStorageBasePath();
  await fs.mkdir(basePath, { recursive: true });
  return basePath;
}

function isPathInside(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Validates that the target path is within the allowed BASE_STORAGE_PATH.
 * Prevents Path Traversal Attacks.
 */
export function resolveStoragePath(reqPath: string = ''): string {
  const base = getStorageBasePath();
  const normalizedPath = normalizeRequestedPath(reqPath);
  const target = path.resolve(base, normalizedPath);

  if (!isPathInside(base, target)) {
    log.warn(`Blocked traversal attempt: ${target}`);
    throw new Error('Access Denied: Path Traversal Attempt');
  }
  return target;
}

/**
 * List files and directories in a given path.
 */
export async function listFiles(reqPath: string = ''): Promise<FileItem[]> {
  const normalizedPath = normalizeRequestedPath(reqPath);
  const targetPath = resolveStoragePath(normalizedPath);

  try {
    if (!normalizedPath) {
      await ensureStorageRootExists();
    }

    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    const items = await fs.readdir(targetPath, { withFileTypes: true });

    const fileItems = await Promise.all(
      items.map(async (item) => {
        const itemRelativePath = ['/', normalizedPath, item.name]
          .join('/')
          .replace(/\/+/g, '/')
          .replace(/\/$/, '') || '/';
        const fullItemPath = path.join(targetPath, item.name);

        try {
          const itemStat = await fs.stat(fullItemPath);
          return {
            name: item.name,
            path: itemRelativePath,
            isDirectory: item.isDirectory(),
            size: item.isDirectory() ? 0 : itemStat.size,
            extension: item.isDirectory() ? '' : path.extname(item.name).toLowerCase(),
            mtime: itemStat.mtime,
          };
        } catch (err) {
          return {
            name: item.name,
            path: itemRelativePath,
            isDirectory: item.isDirectory(),
            size: 0,
            extension: item.isDirectory() ? '' : path.extname(item.name).toLowerCase(),
            mtime: new Date(0),
          };
        }
      })
    );

    // Sort: directories first, then alphabetically
    return fileItems.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (!normalizedPath) {
        await ensureStorageRootExists();
        return [];
      }
      throw new Error(`Directory not found: ${normalizedPath ? `/${normalizedPath}` : '/'}`);
    }
    throw error;
  }
}

/**
 * Create a new directory.
 */
export async function createDirectory(reqPath: string, name: string): Promise<void> {
  const parentPath = normalizeRequestedPath(reqPath);
  const targetPath = resolveStoragePath(path.join(parentPath, name));
  await fs.mkdir(targetPath, { recursive: true });
}

/**
 * Delete a file or directory.
 */
export async function deleteItem(reqPath: string): Promise<void> {
  const targetPath = resolveStoragePath(normalizeRequestedPath(reqPath));
  await fs.rm(targetPath, { recursive: true, force: true });
}

/**
 * Rename or move an item.
 */
export async function renameItem(oldPath: string, newPath: string): Promise<void> {
  const oldAbs = resolveStoragePath(normalizeRequestedPath(oldPath));
  const newAbs = resolveStoragePath(normalizeRequestedPath(newPath));
  await fs.rename(oldAbs, newAbs);
}

/**
 * Search files recursively.
 * Note: For very large drives, this should be optimized with an index.
 */
export async function searchFiles(query: string, maxResults: number = 100): Promise<FileItem[]> {
  const base = getStorageBasePath();
  const results: FileItem[] = [];
  const lowercaseQuery = query.toLowerCase();

  await fs.mkdir(base, { recursive: true });

  async function walk(currentPath: string) {
    if (results.length >= maxResults) return;

    const items = await fs.readdir(currentPath, { withFileTypes: true });

    for (const item of items) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(currentPath, item.name);
      const relativePath = path.relative(base, fullPath).replace(/\\/g, '/');

      if (item.name.toLowerCase().includes(lowercaseQuery)) {
        try {
          const itemStat = await fs.stat(fullPath);
          results.push({
            name: item.name,
            path: relativePath,
            isDirectory: item.isDirectory(),
            size: item.isDirectory() ? 0 : itemStat.size,
            extension: item.isDirectory() ? '' : path.extname(item.name).toLowerCase(),
            mtime: itemStat.mtime,
          });
        } catch (e) {
          // Skip inaccessible items
        }
      }

      if (item.isDirectory()) {
        await walk(fullPath);
      }
    }
  }

  await walk(base);
  return results;
}
