import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  Shield,
  Cpu,
  RefreshCw,
  Clock,
  CheckCircle2,
  Download,
  Terminal,
  ArrowUpCircle,
  Package,
  ServerCog,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getErrorMessage } from "../lib/errors";

interface VersionInfo {
  local: string;
  commit: string;
  arch: string;
}

interface UpdateCheckResponse {
  available: boolean;
  latestVersion: string;
  currentVersion: string;
}

interface ActionResult {
  success: boolean;
  message?: string;
  logs?: string;
  rebootRequired?: boolean;
  restartRequired?: boolean;
  error?: string;
}

export default function Settings() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isAppUpdating, setIsAppUpdating] = useState(false);
  const [isSystemUpdating, setIsSystemUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState("");
  const [systemLog, setSystemLog] = useState("");

  const loadVersion = async () => {
    const res = await fetch("/api/system/version", { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setVersion({
        local: data.local,
        commit: data.commit,
        arch: data.arch,
      });
    }
  };

  const loadUpdateInfo = async () => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/system/check-updates", { credentials: "include" });
      const payload = await res.json();
      if (payload.success) {
        setUpdateInfo(payload.data as UpdateCheckResponse);
      }
    } catch (error) {
      setUpdateLog((prev) =>
        `${prev}${prev ? "\n" : ""}${getErrorMessage(error, "No se pudo comprobar el estado OTA.")}\n`,
      );
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    void loadVersion();
    void loadUpdateInfo();
  }, []);

  const runAction = async (
    url: string,
    setBusy: (value: boolean) => void,
    setLog: Dispatch<SetStateAction<string>>,
    initialMessage: string,
  ) => {
    setBusy(true);
    setLog(`${initialMessage}\n`);

    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
      });

      const data = (await res.json()) as ActionResult;
      const logs = data.logs?.trim() ?? "";
      const message = data.message || data.error || "Operación finalizada.";

      setLog(`${logs}${logs ? "\n\n" : ""}${message}\n`);

      if (data.success) {
        await loadVersion();
        await loadUpdateInfo();
      }
    } catch (error) {
      setLog(`${getErrorMessage(error, "Error de conexión con el servidor.")}\n`);
    } finally {
      setBusy(false);
    }
  };

  const handleAppUpdate = async () => {
    await runAction(
      "/api/system/update",
      setIsAppUpdating,
      setUpdateLog,
      "Preparando actualización OTA de HomeVault...",
    );
  };

  const handleSystemUpdate = async () => {
    await runAction(
      "/api/system/update/system",
      setIsSystemUpdating,
      setSystemLog,
      "Preparando actualización de paquetes del sistema...",
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center space-x-4 rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md">
        <div className="rounded-2xl bg-blue-500/10 p-4">
          <Shield className="h-8 w-8 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Ajustes del Sistema</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-slate-500">
            Configuración y actualizaciones OTA
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Información</h3>
            <Cpu className="h-5 w-5 text-slate-600" />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-xs font-bold uppercase text-slate-500">Versión actual</span>
              <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-black text-blue-400">
                v{version?.local || "1.0.0"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-xs font-bold uppercase text-slate-500">Último commit</span>
              <span className="text-sm font-mono text-slate-300">{version?.commit?.substring(0, 7) || "unknown"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-xs font-bold uppercase text-slate-500">Arquitectura</span>
              <span className="text-xs font-black uppercase text-white">{version?.arch || "arm64"}</span>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="text-xs font-bold uppercase text-slate-500">Estado OTA</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  updateInfo?.available
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {updateInfo?.available ? `Nueva ${updateInfo.latestVersion}` : "Al día"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Actualización OTA</h3>
            <button
              onClick={() => void loadUpdateInfo()}
              disabled={isChecking || isAppUpdating || isSystemUpdating}
              className="rounded-xl border border-white/10 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-2 text-slate-300 transition hover:border-blue-400/30 hover:text-white disabled:opacity-50"
              title="Comprobar estado"
            >
              <RefreshCw className={`h-5 w-5 ${isChecking ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mb-6 rounded-2xl border border-blue-500/10 bg-blue-500/5 p-6">
            <div className="flex items-start space-x-3">
              {updateInfo?.available ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
              )}
              <div>
                <p className="text-sm font-bold text-white">
                  {updateInfo?.available ? "Hay una nueva versión disponible" : "Sincronizado con GitHub"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {updateInfo?.available
                    ? `Actual: ${updateInfo.currentVersion} · Remota: ${updateInfo.latestVersion}. La actualización limpia cambios locales temporales antes de sincronizar.`
                    : "La instalación usa la rama principal y recompila frontend y backend al actualizar."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => void handleAppUpdate()}
              disabled={isChecking || isAppUpdating || isSystemUpdating}
              className="flex w-full items-center justify-center space-x-3 rounded-2xl bg-blue-600 px-8 py-4 font-black text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50"
            >
              {isAppUpdating ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ArrowUpCircle className="h-5 w-5" />}
              <span>{isAppUpdating ? "Actualizando HomeVault..." : "Actualizar HomeVault"}</span>
            </button>

            <button
              onClick={() => void handleSystemUpdate()}
              disabled={isChecking || isAppUpdating || isSystemUpdating}
              className="flex w-full items-center justify-center space-x-3 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl px-8 py-4 font-black text-white transition-all hover:border-emerald-400/30 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              {isSystemUpdating ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ServerCog className="h-5 w-5" />}
              <span>{isSystemUpdating ? "Actualizando sistema..." : "Actualizar sistema"}</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(updateLog || isAppUpdating) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md"
          >
            <div className="mb-4 flex items-center space-x-3">
              <Terminal className="h-5 w-5 text-emerald-500" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Salida OTA HomeVault</h3>
            </div>
            <pre className="max-h-80 overflow-y-auto rounded-xl bg-slate-950/80 p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
              {updateLog}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(systemLog || isSystemUpdating) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md"
          >
            <div className="mb-4 flex items-center space-x-3">
              <Package className="h-5 w-5 text-blue-400" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Salida actualización sistema</h3>
            </div>
            <pre className="max-h-80 overflow-y-auto rounded-xl bg-slate-950/80 p-4 font-mono text-[11px] leading-relaxed text-sky-300">
              {systemLog}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Backup System Config</h3>
          <Clock className="h-5 w-5 text-slate-600" />
        </div>
        <div className="py-12 text-center">
          <Download className="mx-auto mb-4 h-12 w-12 text-slate-800 opacity-20" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            Respaldo de configuración no disponible
          </p>
        </div>
      </div>
    </div>
  );
}
