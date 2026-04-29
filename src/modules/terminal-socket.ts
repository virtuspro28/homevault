import type { Server, Socket } from "socket.io";
import * as pty from "node-pty";
import os from "node:os";
import fs from "node:fs";
import { logger } from "../utils/logger.js";
import { attachSocketAuth, type SocketUser } from "./socket-auth.js";
import { config } from "../config/index.js";

const log = logger.child("terminal-socket");

export function setupTerminalSocket(io: Server) {
  const terminalNamespace = io.of("/terminal");
  attachSocketAuth(terminalNamespace, true);

  terminalNamespace.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    log.info(`Terminal abierta por usuario: ${user.username}`);

    const shell = os.platform() === "win32"
      ? "powershell.exe"
      : fs.existsSync("/bin/bash")
        ? "/bin/bash"
        : "/bin/sh";
    const args = os.platform() === "win32" ? [] : shell.endsWith("bash") ? ["--login"] : [];

    let ptyProcess: pty.IPty | null = null;

    try {
      ptyProcess = pty.spawn(shell, args, {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: config.paths.root,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          HOME: process.env["HOME"] || (os.platform() === "win32" ? process.cwd() : "/root"),
        } as typeof process.env,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir la shell del sistema";
      log.error(`Error creando PTY para ${user.username}: ${message}`);
      socket.emit("error", message);
      socket.disconnect();
      return;
    }

    ptyProcess.onData((data) => {
      socket.emit("output", data);
    });

    socket.on("input", (data) => {
      ptyProcess?.write(data);
    });

    socket.on("resize", (size: { cols: number; rows: number }) => {
      if (!ptyProcess || !size?.cols || !size?.rows) {
        return;
      }

      ptyProcess.resize(size.cols, size.rows);
    });

    socket.on("disconnect", () => {
      log.info(`Terminal cerrada para usuario: ${user.username}`);
      ptyProcess?.kill();
    });
  });
}
