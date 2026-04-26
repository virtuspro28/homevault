import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Box,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Terminal,
} from 'lucide-react';

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

interface ContainerStats {
  cpu: string;
  memory: string;
  memoryPercent: string;
  networkIO: string;
  blockIO: string;
  pids: string;
}

interface ContainerDetails {
  container: ContainerInfo;
  command: string;
  createdAt: string | null;
  mounts: Array<{ source: string; destination: string; mode: string }>;
  ports: string[];
  restartPolicy: string;
}

export default function DockerManager() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  const fetchContainers = async (keepLoading = false) => {
    if (keepLoading) setIsLoading(true);
    try {
      const res = await fetch('/api/docker/containers', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Server Network Error');
      setContainers(json.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPanel = async (id: string) => {
    setPanelLoading(true);
    setErrorMsg(null);
    try {
      const [detailsRes, statsRes, logsRes] = await Promise.all([
        fetch(`/api/docker/containers/${id}`, { credentials: 'include' }),
        fetch(`/api/docker/containers/${id}/stats`, { credentials: 'include' }),
        fetch(`/api/docker/containers/${id}/logs`, { credentials: 'include' }),
      ]);

      const [detailsJson, statsJson, logsJson] = await Promise.all([
        detailsRes.json(),
        statsRes.json(),
        logsRes.json(),
      ]);

      if (!detailsRes.ok || !detailsJson.success) throw new Error(detailsJson.error || 'No se pudo cargar la inspeccion');
      if (!statsRes.ok || !statsJson.success) throw new Error(statsJson.error || 'No se pudo cargar las metricas');
      if (!logsRes.ok || !logsJson.success) throw new Error(logsJson.error || 'No se pudo cargar los logs');

      setDetails(detailsJson.data);
      setStats(statsJson.data);
      setLogs(logsJson.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPanelLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers(true);
    const interval = window.setInterval(() => {
      fetchContainers();
      if (selectedId) {
        fetchPanel(selectedId);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setProcessingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/docker/containers/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Fallo al ${action}`);
      await fetchContainers();
      if (selectedId === id) {
        await fetchPanel(id);
      }
    } catch (err: unknown) {
      setErrorMsg(`[${id.substring(0, 8)}] ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const selectContainer = async (id: string) => {
    setSelectedId(id);
    await fetchPanel(id);
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <header className="flex flex-col xl:flex-row justify-between gap-4 xl:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center">
            <Terminal className="w-8 h-8 mr-3 text-blue-500" />
            Control de Aplicaciones
          </h1>
          <p className="text-slate-400 mt-2">Gestion nativa de contenedores Docker con logs, metricas y control operativo.</p>
        </div>
        <button
          onClick={() => fetchContainers(true)}
          className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-200 font-bold flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </header>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 font-medium">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 h-56 animate-pulse flex flex-col justify-between">
                <div className="flex space-x-4 items-center">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-800 rounded w-2/3" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-20 bg-slate-800 rounded-2xl" />
              </div>
            ))
          ) : containers.length === 0 ? (
            <div className="col-span-1 md:col-span-2 p-8 border border-slate-800 rounded-2xl bg-slate-900/50 text-center">
              <p className="text-slate-400 font-mono">No se detecto ningun contenedor en Docker.</p>
            </div>
          ) : (
            containers.map((container) => {
              const isRunning = container.state === 'running';
              const isBusy = processingId === container.id;
              const isSelected = selectedId === container.id;

              return (
                <div
                  key={container.id}
                  className={`bg-slate-900/40 backdrop-blur-md border rounded-2xl p-5 hover:bg-slate-900/70 transition-all shadow-lg flex flex-col justify-between ${isSelected ? 'border-blue-500/40' : 'border-slate-800'}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-inner">
                          <Box className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-100 truncate w-40" title={container.name}>
                            {container.name}
                          </h3>
                          <p className="text-xs font-mono text-slate-400 truncate w-44" title={container.image}>
                            {container.image}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800">
                        <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                          {container.state}
                        </span>
                      </div>
                    </div>

                    <div className="mb-6 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/80">
                      <p className="text-[11px] font-medium text-slate-400 flex flex-col">
                        <span className="uppercase tracking-wide text-slate-500 mb-1">Estado</span>
                        <span className="text-slate-300 font-mono truncate">{container.status || 'Desconocido'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => selectContainer(container.id)}
                      className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-white font-semibold"
                    >
                      Ver detalles
                    </button>
                    <div className="grid grid-cols-3 gap-3">
                      {isRunning ? (
                        <button
                          onClick={() => handleAction(container.id, 'stop')}
                          disabled={isBusy}
                          className="flex items-center justify-center py-2.5 bg-slate-800/50 hover:bg-red-500/10 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/20 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-4 h-4 text-red-500" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(container.id, 'start')}
                          disabled={isBusy}
                          className="flex items-center justify-center py-2.5 bg-blue-600/10 hover:bg-emerald-500/10 text-blue-400 hover:text-emerald-400 border border-blue-500/20 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 text-emerald-500" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(container.id, 'restart')}
                        disabled={isBusy}
                        className="flex items-center justify-center py-2.5 bg-white/5 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 border border-white/10 rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => selectContainer(container.id)}
                        className="flex items-center justify-center py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl font-medium transition-colors"
                      >
                        <Terminal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 min-h-[32rem]">
          {!selectedId ? (
            <div className="h-full flex items-center justify-center text-center text-slate-500">
              <div>
                <Terminal className="w-10 h-10 mx-auto mb-4 text-slate-700" />
                <p className="font-semibold">Selecciona un contenedor para ver metricas y logs.</p>
              </div>
            </div>
          ) : panelLoading || !details || !stats ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white">{details.container.name}</h2>
                <p className="text-xs text-slate-400 font-mono mt-1">{details.container.image}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-1">CPU</p>
                  <p className="text-white font-black">{stats.cpu}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-1">Memoria</p>
                  <p className="text-white font-black">{stats.memoryPercent}</p>
                  <p className="text-xs text-slate-400 mt-1">{stats.memory}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-1">Red</p>
                  <p className="text-white font-black">{stats.networkIO}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-1">PIDs</p>
                  <p className="text-white font-black">{stats.pids}</p>
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-2">Politica de reinicio</p>
                <p className="text-white font-semibold">{details.restartPolicy}</p>
                <p className="text-xs text-slate-400 font-mono mt-3 break-all">{details.command || 'Sin comando visible'}</p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Puertos</p>
                <div className="flex flex-wrap gap-2">
                  {details.ports.length > 0 ? details.ports.map((port) => (
                    <span key={port} className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs font-bold">
                      {port}
                    </span>
                  )) : <span className="text-sm text-slate-500">Sin puertos publicados</span>}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Montajes</p>
                {details.mounts.length > 0 ? (
                  <div className="space-y-2">
                    {details.mounts.map((mount) => (
                      <div key={`${mount.source}-${mount.destination}`} className="rounded-2xl bg-slate-950/60 border border-white/5 p-3">
                        <p className="text-xs text-white font-semibold break-all">{mount.destination}</p>
                        <p className="text-[11px] text-slate-400 font-mono break-all mt-1">{mount.source}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Sin volumenes montados</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Logs recientes</p>
                  <button
                    onClick={() => selectedId && fetchPanel(selectedId)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Recargar
                  </button>
                </div>
                <div className="rounded-2xl bg-slate-950/70 border border-white/5 p-4 max-h-80 overflow-auto">
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words font-mono">
                    {logs.join('\n') || 'Sin logs recientes'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
