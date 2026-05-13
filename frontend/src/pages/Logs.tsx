import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';
import { reportClientError } from '../lib/runtimeLog';

export default function Logs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/system/logs', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudieron cargar los logs');
      }

      const nextLines = typeof data.data === 'string'
        ? data.data.split(/\r?\n/).filter(Boolean)
        : [];

      setError(null);
      setLogs(nextLines.slice(-500));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      reportClientError('logs-fetch', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(() => {
      void fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (loading) {
     return (
       <div className="flex items-center justify-center min-h-[60vh]">
         <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
       </div>
     );
  }

  return (
    <div className="space-y-6 pb-12 md:space-y-8">
      <div className="flex items-center space-x-4 rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:rounded-[2.5rem] lg:p-8">
        <div className="p-4 bg-blue-500/10 rounded-2xl">
          <Terminal className="w-8 h-8 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Registros del Backend</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Salida de consola del servidor node.js</p>
        </div>
      </div>

      {error && (
        <div className="rounded-[2rem] border border-red-500/20 bg-red-500/10 px-6 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-slate-950 lg:rounded-[2.5rem]">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/10 p-4">
           <div className="flex space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20"></div>
           </div>
           <button
             onClick={() => void fetchLogs()}
             className="flex min-h-[44px] items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-white"
           >
             <RefreshCw className="w-3 h-3" />
             Recargar
           </button>
        </div>
        <div className="h-[calc(100dvh-18rem)] min-h-[420px] overflow-y-auto overflow-x-hidden p-4 font-mono text-xs leading-relaxed sm:p-6 lg:h-[600px] lg:p-8">
          {logs.length === 0 ? (
            <div className="text-slate-500">Sin logs disponibles.</div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={`${idx}-${log}`}
                className="mb-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 lg:mb-0 lg:rounded lg:border-transparent lg:bg-transparent lg:px-2 lg:py-0.5"
              >
                <span className="mr-3 block text-[10px] text-slate-600 lg:inline">[{idx + 1}]</span>
                <span className="break-all text-[11px] text-slate-300 sm:break-words lg:text-xs">{log}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
