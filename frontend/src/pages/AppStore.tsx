import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  CheckCircle2,
  Cpu,
  Database,
  X,
  Globe,
  Package,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StoreApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  image?: string;
  category: string;
  ports: string[];
  source?: 'local' | 'casaos';
  developer?: string;
  isInstalled?: boolean;
}

function AppIcon({ app }: { app: StoreApp }) {
  if (app.icon.startsWith('http://') || app.icon.startsWith('https://')) {
    return (
      <img
        src={app.icon}
        alt={app.name}
        className="w-8 h-8 rounded-xl object-cover"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return <Database className="w-6 h-6 text-blue-400" />;
}

export default function AppStore() {
  const [apps, setApps] = useState<StoreApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedApp, setSelectedApp] = useState<StoreApp | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState('');

  useEffect(() => {
    fetch('/api/docker/store/apps')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setApps(data.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando apps:', err);
        setLoading(false);
      });
  }, []);

  const handleInstall = async (appId: string) => {
    setInstalling(true);
    setInstallLog(`Iniciando instalación de ${appId}...\n`);
    try {
      const res = await fetch(`/api/docker/store/install/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setInstallLog((prev) => prev + `\n✅ ${data.message}`);
    } catch (err: any) {
      setInstallLog((prev) => prev + `\n❌ Error: ${err.message || 'Error crítico durante la instalación.'}`);
    } finally {
      setInstalling(false);
    }
  };

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(filter.toLowerCase()) ||
    app.description.toLowerCase().includes(filter.toLowerCase()) ||
    app.category.toLowerCase().includes(filter.toLowerCase()),
  );

  const casaOsCount = apps.filter((app) => app.source === 'casaos').length;

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
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
              Marketplace de aplicaciones NAS
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {apps.length} apps disponibles. {casaOsCount} importadas del catálogo oficial de CasaOS.
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar apps, categorías o descripción..."
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
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 group-hover:border-blue-500/50 transition-colors min-w-[64px] min-h-[64px] flex items-center justify-center">
                <AppIcon app={app} />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {app.category}
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${app.source === 'casaos' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {app.source === 'casaos' ? 'CasaOS' : 'Local'}
                </div>
              </div>
            </div>
            <h3 className="text-lg font-black text-white mb-2">{app.name}</h3>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 min-h-[54px] font-bold">
              {app.description}
            </p>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {app.source === 'casaos' ? <Globe className="w-3 h-3 text-slate-600" /> : <Package className="w-3 h-3 text-slate-600" />}
                <span className="text-[10px] font-black text-slate-600 uppercase">
                  {app.source === 'casaos' ? 'CasaOS AppStore' : 'Catálogo interno'}
                </span>
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
              <div className="flex justify-between items-start mb-8 gap-4">
                <div className="flex items-center space-x-4">
                  <div className="p-5 bg-blue-500/10 rounded-2xl min-w-[72px] min-h-[72px] flex items-center justify-center">
                    <AppIcon app={selectedApp} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{selectedApp.name}</h2>
                    <p className="text-sm text-blue-400 font-bold uppercase tracking-widest mt-1">
                      {selectedApp.source === 'casaos' ? 'Importada desde CasaOS' : 'Instalador de un clic'}
                    </p>
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
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl flex items-center space-x-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">
                      Fuente: {selectedApp.source === 'casaos' ? 'CasaOS AppStore oficial' : 'Catálogo local de HomePiNAS'}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Cpu className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">
                      {selectedApp.developer ? `Desarrollador: ${selectedApp.developer}` : 'Compatible con despliegue Docker'}
                    </p>
                  </div>
                </div>

                {selectedApp.ports.length > 0 && (
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Puertos</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedApp.ports.map((port) => (
                        <span key={port} className="px-3 py-1 rounded-full bg-white/5 text-xs font-bold text-slate-300">
                          {port}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {installing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-widest animate-pulse">Desplegando contenedor...</span>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    </div>
                    <pre className="p-6 bg-slate-950 rounded-2xl text-[10px] font-mono text-emerald-400 h-64 overflow-y-auto leading-relaxed border border-white/5">
                      {installLog}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
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

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
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
