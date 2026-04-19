import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Database, RefreshCw, Layers, AlertCircle } from 'lucide-react';

export default function StoragePool() {
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/storage/pools')
      .then(res => res.json())
      .then(data => {
        if (data.success) setPools(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

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
        <div className="p-4 bg-indigo-500/10 rounded-2xl">
          <Database className="w-8 h-8 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Pool de Almacenamiento</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión de ZFS / MergerFS / SnapRAID</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {pools.map((pool) => (
          <div key={pool.name} className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
               <div className="flex items-center space-x-4">
                  <div className="p-4 bg-blue-500/10 rounded-2xl">
                    <Layers className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{pool.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{pool.type} • {pool.disks.length} Discos</p>
                  </div>
               </div>
               <div className="flex items-center space-x-3 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-black text-emerald-400 uppercase">Saludable</span>
               </div>
            </div>

            <div className="space-y-6">
               <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Capacidad Usada</span>
                    <span className="text-xs font-black text-white">{pool.usage}%</span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" style={{ width: `${pool.usage}%` }}></div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total</p>
                     <p className="text-sm font-black text-white">{pool.size}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Usado</p>
                     <p className="text-sm font-black text-white">{pool.used}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Libre</p>
                     <p className="text-sm font-black text-blue-400">{pool.free}</p>
                  </div>
               </div>
            </div>
          </div>
        ))}

        {pools.length === 0 && (
          <div className="py-20 text-center bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[3rem]">
             <Shield className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
             <p className="text-slate-500 font-bold mb-4">No se han detectado Pools de almacenamiento</p>
             <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                Crear Nuevo Pool
             </button>
          </div>
        )}
      </div>

      <div className="p-8 bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem] flex items-start space-x-4">
        <AlertCircle className="w-6 h-6 text-amber-500 mt-1" />
        <p className="text-xs text-slate-400 font-medium leading-relaxed">
          Los cambios en los Pools de almacenamiento pueden tardar unos segundos en reflejarse. Si usas **SnapRAID**, recuerda sincronizar el contenido después de grandes transferencias de datos.
        </p>
      </div>
    </div>
  );
}
