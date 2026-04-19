import { useState, useEffect } from 'react';
import { Shield, Monitor, History, Download, AlertCircle, Clock, Database, ChevronRight, Loader2, Server } from 'lucide-react';

interface BackupLog {
  id: string;
  timestamp: string;
  status: 'success' | 'failed';
  details?: string;
}

interface BackupTask {
  id: string;
  machineName: string;
  lastBackup: string | null;
  status: 'idle' | 'running' | 'success' | 'failed';
  storagePath: string;
  logs: BackupLog[];
}

export default function ActiveBackup() {
  const [tasks, setTasks] = useState<BackupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/backup/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al conectar con el servidor de backup');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'running': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-500" />
            Active Backup for Business
          </h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Protección centralizada para tus equipos Windows. Gestión remota de copias de seguridad mediante rsync incremental.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href="/agents/homepinas-agent.exe"
            className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 whitespace-nowrap"
          >
            <Download className="w-5 h-5 mr-2" />
            Descargar Agente (Win)
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center space-x-3 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PC List */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Monitor className="w-5 h-5 mr-3 text-slate-400" />
            Equipos Protegidos
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-3xl border border-slate-800">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500/40" />
                <p>Consultando estado de copias...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-3xl border border-2 border-dashed border-slate-800">
                <Server className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-lg">No hay equipos registrados en el sistema.</p>
                <p className="text-sm mt-2">Instala el agente en tu PC para comenzar.</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-blue-500/30 transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-xl ${getStatusColor(task.status)} group-hover:scale-110 transition-transform`}>
                        <Monitor className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{task.machineName}</h3>
                        <p className="text-sm text-slate-500 font-mono flex items-center mt-1">
                          <Database className="w-3 h-3 mr-1.5" /> {task.storagePath}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(task.status)}`}>
                      {task.status}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-6 border-t border-slate-800/50">
                    <div className="flex space-x-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Última Copia</p>
                        <p className="text-sm text-slate-300 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                          {task.lastBackup ? new Date(task.lastBackup).toLocaleString() : 'Nunca'}
                        </p>
                      </div>
                    </div>
                    <button className="text-blue-400 hover:text-blue-300 text-sm font-semibold flex items-center group/btn">
                      Ver detalles <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global History Timeline */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <History className="w-5 h-5 mr-3 text-slate-400" />
            Actividad Reciente
          </h2>
          
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 min-h-[400px]">
            {tasks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm italic">
                Sin actividad registrada
              </div>
            ) : (
              <div className="space-y-6">
                {tasks.flatMap(t => t.logs.map(l => ({ ...l, machineName: t.machineName })))
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 10)
                  .map((log) => (
                    <div key={log.id} className="flex space-x-4 relative group">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 z-10 ${log.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                        <div className="w-px flex-1 bg-slate-800 my-1 min-h-[40px]" />
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-bold text-slate-200">
                          Copia {log.status === 'success' ? 'completada' : 'fallida'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {log.machineName} • {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                        {log.details && (
                          <p className="text-[11px] text-slate-600 mt-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800/50 truncate max-w-[200px]">
                            {log.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
