import { useState } from 'react';
import { Play, Square, Loader2, Box, RotateCw, Terminal, Trash2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { ContainerInfo } from '../../types/docker';
import { resolveAppIconAsset } from '../../lib/appIcons';

interface ContainerCardProps {
  container: ContainerInfo;
  isProcessing?: boolean;
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
  onRestart?: (id: string) => void;
  onDelete?: (id: string, options: { deleteData: boolean }) => void;
  onDetails?: (id: string) => void;
  showExtendedActions?: boolean;
}

function resolveContainerWebUiUrl(container: ContainerInfo): string {
  const hostname = window.location.hostname;

  if (container.webUi) {
    return `http://${hostname}:${container.webUi.port}${container.webUi.path}`;
  }

  const firstPublicTcpPort = container.publishedPorts.find((port) => port.protocol === 'tcp');
  if (!firstPublicTcpPort) {
    return `http://${hostname}`;
  }

  return `http://${hostname}:${firstPublicTcpPort.hostPort}`;
}

export default function ContainerCard({
  container,
  isProcessing = false,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onDetails,
}: ContainerCardProps) {
  const isRunning = container.state === 'running';
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteData, setDeleteData] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const appIcon = resolveAppIconAsset(container.name, container.image);

  return (
    <>
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-5 hover:bg-slate-900/60 transition-all shadow-xl shadow-black/20 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                {appIcon && !iconFailed ? (
                  <img
                    src={appIcon}
                    alt={container.name}
                    className="w-6 h-6 rounded-lg object-contain"
                    onError={() => setIconFailed(true)}
                  />
                ) : (
                  <Box className="w-6 h-6 text-blue-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 truncate w-32 md:w-48" title={container.name}>
                  {container.name}
                </h3>
                <p className="text-xs font-mono text-slate-400 truncate w-32 md:w-48" title={container.image}>
                  {container.image}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {container.state}
              </span>
            </div>
          </div>

          <div className="mb-6 bg-slate-950/30 p-3 rounded-xl border border-slate-800/50">
            <p className="text-xs font-medium text-slate-400 flex justify-between">
              <span>Server Status</span>
              <span className="text-slate-300">{container.status || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div id="container-actions-grid" className="mt-4 grid w-full grid-cols-5 gap-2">
          {/* 1. START/STOP */}
          <button
            onClick={() => container.state === 'running' ? onStop?.(container.id) : onStart?.(container.id)}
            disabled={isProcessing}
            className={`flex min-h-[44px] items-center justify-center rounded-lg p-2 transition-colors ${container.state === 'running' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : container.state === 'running' ? <Square size={18} /> : <Play size={18} />}
          </button>

          {/* 2. RESTART */}
          <button 
            onClick={() => onRestart?.(container.id)} 
            disabled={isProcessing}
            className="flex min-h-[44px] items-center justify-center rounded-lg bg-gray-500/10 p-2 text-gray-400 hover:bg-gray-500/20"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <RotateCw size={18} />}
          </button>

          {/* 3. TERMINAL */}
          <button 
            onClick={() => onDetails?.(container.id)} 
            className="flex min-h-[44px] items-center justify-center rounded-lg bg-gray-500/10 p-2 text-gray-400 hover:bg-gray-500/20"
          >
            <Terminal size={18} />
          </button>

          {/* 4. WEB UI (EL BOTÓN QUE FALTA) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const url = resolveContainerWebUiUrl(container);
              window.open(url, '_blank');
            }}
            disabled={container.state !== 'running'}
            className={`flex min-h-[44px] items-center justify-center rounded-lg border p-2 transition-all ${
              container.state === 'running' 
              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30' 
              : 'bg-gray-500/5 text-gray-600 border-transparent cursor-not-allowed'
            }`}
            title="Abrir Interfaz Web"
          >
            <ExternalLink size={18} />
          </button>

          {/* 5. DELETE */}
          <button 
            onClick={() => setConfirmingDelete(true)} 
            disabled={isProcessing}
            className="flex min-h-[44px] items-center justify-center rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {confirmingDelete && onDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-500/10 p-3">
                <AlertTriangle className="w-6 h-6 text-red-300" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Eliminar contenedor</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Se eliminará <span className="font-bold text-white">{container.name}</span>. Puedes conservar sus datos persistentes o eliminar también su carpeta de aplicación.
                </p>
              </div>
            </div>
            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl px-4 py-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={deleteData}
                onChange={(event) => setDeleteData(event.target.checked)}
                className="h-5 w-5 rounded accent-red-500"
              />
              ¿Eliminar también carpeta de datos?
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteData(false);
                }}
                className="flex-1 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl px-4 py-3 font-bold text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete(container.id, { deleteData });
                  setDeleteData(false);
                }}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-3 font-black text-white"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
