import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';

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
      console.error('Error fetching logs:', err);
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
    <div className="space-y-8 pb-12">
      <div className="flex items-center space-x-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
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

      <div className="bg-slate-950 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
           <div className="flex space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20"></div>
           </div>
           <button
             onClick={() => void fetchLogs()}
             className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-white transition-colors"
           >
             <RefreshCw className="w-3 h-3" />
             Recargar
           </button>
        </div>
        <div className="p-8 h-[600px] overflow-y-auto font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-slate-500">Sin logs disponibles.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={`${idx}-${log}`} className="hover:bg-white/5 py-0.5 rounded px-2">
                <span className="text-slate-600 mr-4">[{idx + 1}]</span>
                <span className="text-slate-300">{log}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
