import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  HardDrive, 
  Plus, 
  Loader2, 
  Database,
  Globe,
  Info,
  Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';

interface CloudRemote {
  name: string;
  type: string;
  isMounted: boolean;
  mountPath?: string;
  usage?: {
    total: number;
    used: number;
    free: number;
  };
}

export default function CloudManager() {
  const [remotes, setRemotes] = useState<CloudRemote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRemotes();
  }, []);

  const fetchRemotes = async () => {
    try {
      const res = await fetch('/api/cloud/remotes');
      const data = await res.json();
      if (data.success) {
        setRemotes(data.data);
      }
    } catch (err) {
      console.error('Error fetching remotes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMount = async (remote: CloudRemote) => {
    setActionLoading(remote.name);
    try {
      const method = remote.isMounted ? 'DELETE' : 'POST';
      const res = await fetch(`/api/cloud/mount/${remote.name}`, { method });
      const data = await res.json();
      if (data.success) {
        fetchRemotes();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl shadow-xl shadow-indigo-900/20">
            <Cloud className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Cloud Manager</h1>
            <p className="text-slate-400">Gestiona y monta tus nubes externas con RClone.</p>
          </div>
        </div>
        
        <button className="flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full border border-white/10 transition-all active:scale-95">
          <Plus className="w-5 h-5 text-indigo-400" />
          <span>Añadir Cuenta Nube</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          [1,2,3].map(i => (
            <div key={i} className="h-64 bg-slate-900/40 rounded-[2rem] border border-white/5 animate-pulse"></div>
          ))
        ) : remotes.length === 0 ? (
          <div className="col-span-full py-20 bg-slate-900/40 rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
             <Globe className="w-16 h-16 text-slate-700 mb-4" />
             <h3 className="text-xl font-bold text-slate-300">No hay cuentas configuradas</h3>
             <p className="text-slate-500 max-w-xs mt-2 text-sm">Configura RClone desde la terminal para ver tus cuentas aquí.</p>
          </div>
        ) : remotes.map((remote) => (
          <motion.div 
            key={remote.name}
            whileHover={{ y: -5 }}
            className="group relative bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full -mr-16 -mt-16 opacity-30 ${remote.isMounted ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>

            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <Database className={`w-6 h-6 ${remote.isMounted ? 'text-emerald-400' : 'text-slate-400'}`} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tight">{remote.name}</h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{remote.type} Provider</span>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-[9px] font-bold border uppercase ${remote.isMounted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                {remote.isMounted ? 'Montado' : 'Desconectado'}
              </div>
            </div>

            {remote.usage && (
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-end">
                   <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Espacio total</span>
                      <span className="text-lg font-black text-white">{formatBytes(remote.usage.total)}</span>
                   </div>
                   <span className="text-xs font-bold text-slate-400">{Math.round((remote.usage.used / remote.usage.total) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(remote.usage.used / remote.usage.total) * 100}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => handleMount(remote)}
                disabled={actionLoading === remote.name}
                className={`flex-1 flex items-center justify-center space-x-2 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                  remote.isMounted 
                    ? 'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                }`}
              >
                {actionLoading === remote.name ? <Loader2 className="w-4 h-4 animate-spin" /> : remote.isMounted ? <Trash2 className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                <span>{remote.isMounted ? 'Desmontar' : 'Montar en NAS'}</span>
              </button>
            </div>

            {remote.isMounted && (
              <div className="mt-4 flex items-center space-x-2 text-[10px] text-slate-500 font-medium">
                <span className="uppercase font-bold">Mount:</span>
                 <span className="bg-black/20 px-2 py-1 rounded-lg text-slate-400 truncate">{remote.mountPath}</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="bg-blue-600/5 border border-blue-600/20 rounded-[2.5rem] p-8 flex items-start space-x-6">
        <div className="p-4 bg-blue-600/20 rounded-3xl">
          <Info className="w-8 h-8 text-blue-400" />
        </div>
        <div className="space-y-2">
          <h4 className="text-lg font-bold text-white uppercase tracking-tight">¿Qué es Cloud Manager?</h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            Esta sección utiliza <b>RClone</b> para sincronizar proveedores externos como Google Drive o Dropbox directamente en el pool de discos de tu NAS. 
            Una vez montado, el contenido aparecerá como una carpeta local y podrá ser gestionado desde el Explorador de Archivos o compartido por Plex.
          </p>
        </div>
      </div>
    </div>
  );
}
