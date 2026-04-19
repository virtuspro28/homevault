import { useState, useEffect } from 'react';
import { 
  Shield, 
  Cpu, 
  RefreshCw, 
  Clock,
  CheckCircle2,
  Download,
  Terminal,
  ArrowUpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Settings() {
  const [version, setVersion] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState('');

  useEffect(() => {
    fetch('/api/system/version')
      .then(res => res.json())
      .then(data => setVersion(data));
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateLog('Buscando actualizaciones...');
    try {
      const res = await fetch('/api/system/update', { method: 'POST' });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No se pudo leer el stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setUpdateLog(prev => prev + text);
      }
    } catch (err) {
       setUpdateLog(prev => prev + '\nError en la actualización.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center space-x-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="p-4 bg-blue-500/10 rounded-2xl">
          <Shield className="w-8 h-8 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Ajustes del Sistema</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Configuración y Actualizaciones OTA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Info del Sistema */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Información</h3>
              <Cpu className="w-5 h-5 text-slate-600" />
           </div>

           <div className="space-y-6">
              <div className="flex justify-between items-center py-4 border-b border-white/5">
                <span className="text-xs font-bold text-slate-500 uppercase">Versión Actual</span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-black">
                  v{version?.local || '1.0.0'}
                </span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-white/5">
                <span className="text-xs font-bold text-slate-500 uppercase">Último Commit</span>
                <span className="text-sm font-mono text-slate-300">{version?.commit?.substring(0, 7) || 'af10109'}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-xs font-bold text-slate-500 uppercase">Arquitectura</span>
                <span className="text-xs font-black text-white uppercase">{version?.arch || 'arm64'}</span>
              </div>
           </div>
        </div>

        {/* Actualizaciones OTA */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Actualización OTA</h3>
              <RefreshCw className={`w-5 h-5 text-blue-500 ${isUpdating ? 'animate-spin' : ''}`} />
           </div>

           <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl mb-8">
              <div className="flex items-start space-x-3">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                 <div>
                    <p className="text-sm font-bold text-white">Sincronizado con GitHub</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      El sistema se sincroniza automáticamente con la rama principal para recibir parches y mejoras de hardware.
                    </p>
                 </div>
              </div>
           </div>

           <button 
             onClick={handleUpdate}
             disabled={isUpdating}
             className="w-full flex items-center justify-center space-x-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
           >
              {isUpdating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowUpCircle className="w-5 h-5" />}
              <span>{isUpdating ? 'Actualizando...' : 'Buscar Actualizaciones'}</span>
           </button>
        </div>
      </div>

      <AnimatePresence>
        {isUpdating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]"
          >
             <div className="flex items-center space-x-3 mb-4">
                <Terminal className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Git Output</h3>
             </div>
             <pre className="p-4 bg-slate-950/80 rounded-xl font-mono text-[10px] text-emerald-400 max-h-64 overflow-y-auto leading-relaxed">
                {updateLog}
             </pre>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Backup System Config</h3>
          <Clock className="w-5 h-5 text-slate-600" />
        </div>
        <div className="text-center py-12">
            <Download className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Respaldo de configuración no disponible</p>
        </div>
      </div>
    </div>
  );
}
