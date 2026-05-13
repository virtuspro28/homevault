import { exec } from "node:child_process";
import type { Request, Response } from "express";

export interface DiskStorageInfo {
  filesystem: string;
  sizeBytes: number;
  usedBytes: number;
  availableBytes: number;
  usePercentage: number;
  mountPoint: string;
}

export async function getDisks(_req: Request, res: Response): Promise<void> {
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      exec("df -B1 -x tmpfs -x devtmpfs", (error, commandStdout, stderr) => {
        if (error) {
          reject(new Error(`Fallo ejecutando df: ${stderr || error.message}`));
          return;
        }

        resolve(commandStdout);
      });
    });

    const lines = stdout.trim().split("\n");
    lines.shift();

    const disks: DiskStorageInfo[] = lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          filesystem: parts[0] ?? "",
          sizeBytes: parseInt(parts[1] ?? "0", 10),
          usedBytes: parseInt(parts[2] ?? "0", 10),
          availableBytes: parseInt(parts[3] ?? "0", 10),
          usePercentage: parseInt((parts[4] ?? "0").replace("%", ""), 10),
          mountPoint: parts.slice(5).join(" "),
        };
      });

    res.status(200).json({ success: true, data: disks });
  } catch (error: unknown) {
    const warning = error instanceof Error ? error.message : "Error desconocido leyendo discos";
    res.status(200).json({
      success: true,
      data: [],
      warning,
    });
  }
}
