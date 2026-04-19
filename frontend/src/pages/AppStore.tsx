import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  Database, 
  Terminal,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppStore() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState('');

  useEffect(() => {
    fetch('/api/docker/store/apps')
      .then(res => res.json())
      .then(data => {
         if (data.success) setApps(data.data);
         setLoading(false);
      });
  }, []);

  const handleInstall = async (appId: string) => {
    setInstalling(true);
    setInstallLog(`Iniciando instalación de ${appId}...\n`);
    try {
      const res = await fetch(`/api/docker/store/install/${appId}`, { method: 'POST' });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No se pudo abrir el stream de logs');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setInstallLog(prev => prev + text);
      }
    } catch (err) {
      setInstallLog(prev => prev + '\n❌ Error crítico durante la instalación.');
    } finally {
      setInstalling(false);
    }
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(filter.toLowerCase()) ||
    app.description.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
     return (
       <div className="flex items-center justify-center min-h-[60vh]">
         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
       </div>
     );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <ShoppingBag className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">App Store</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Marketplace de aplicaciones NAS</p>
          </div>
        </div>

        <div className="relative w-full md:w-64">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
           <input 
             type="text"
             placeholder="Buscar apps..."
             className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
             value={filter}
             onChange={(e) => setFilter(e.target.value)}
           />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {filteredApps.map((app) => (
           <motion.div 
             key={app.id}
             whileHover={{ y: -5 }}
             className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] group hover:border-blue-500/30 transition-all cursor-pointer"
             onClick={() => setSelectedApp(app)}
           >
              <div className="flex items-start justify-between mb-4">
                 <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 group-hover:border-blue-500/50 transition-colors">
                    <Database className="w-6 h-6 text-blue-400" />
                 </div>
                 <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {app.category}
                 </div>
              </div>
              <h3 className="text-lg font-black text-white mb-2">{app.name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 h-8 font-bold">
                {app.description}
              </p>
              
              <div className="mt-6 flex items-center justify-between">
                 <div className="flex items-center space-x-2">
                    <Cpu className="w-3 h-3 text-slate-600" />
                    <span className="text-[10px] font-black text-slate-600 uppercase">Debian / Docker</span>
                 </div>
                 <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-blue-500 transition-colors" />
              </div>
           </motion.div>
         ))}
      </div>

      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !installing && setSelectedApp(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[3rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-start mb-8">
                 <div className="flex items-center space-x-4">
                    <div className="p-5 bg-blue-500/10 rounded-2xl">
                       <Database className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                       <h2 className="text-2xl font-black text-white">{selectedApp.name}</h2>
                       <p className="text-sm text-blue-400 font-bold uppercase tracking-widest mt-1">Instalador de un clic</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setSelectedApp(null)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                 >
                    <X className="w-5 h-5 text-slate-400" />
                 </button>
              </div>

              <div className="space-y-6">
                 <p className="text-slate-400 leading-relaxed font-bold">
                    {selectedApp.description}
                    Esta aplicación se desplegará utilizando **docker-compose** en tu sistema. Se abrirá automáticamente el puerto correspondiente y se configurará la persistencia en el volumen de datos principal.
                 </p>

                 {installing ? (
                   <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest animate-pulse">Desplegando Contenedor...</span>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                      </div>
                      <pre className="p-6 bg-slate-950 rounded-2xl text-[10px] font-mono text-emerald-400 h-64 overflow-y-auto leading-relaxed border border-white/5">
                        {installLog}
                      </pre>
                   </div>
                 ) : (
                   <div className="flex flex-col gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl flex items-center space-x-3">
                         <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                         </div>
                         <p className="text-xs font-bold text-slate-400">Compatible con tu arquitectura de CPU actual.</p>
                      </div>
                      <button 
                        onClick={() => handleInstall(selectedApp.id)}
                        className="w-full flex items-center justify-center space-x-3 px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-600/20 mt-4 group"
                      >
                         <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                         <span>Comenzar Instalación</span>
                      </button>
                   </div>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
    </svg>
  );
}
