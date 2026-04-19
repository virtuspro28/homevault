import { BatteryCharging, BatteryWarning, Zap, AlertTriangle, History, Clock, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function PowerManager() {
  const [status, setStatus] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, eventRes] = await Promise.all([
        fetch('/api/ups/status'),
        fetch('/api/ups/events')
      ]);
      const statusData = await statusRes.json();
      const eventData = await eventRes.json();

      if (statusData.success) setStatus(statusData.data);
      if (eventData.success) setEvents(eventData.data);
    } catch (err) {
      console.error("Error fetching power data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) return null;

  const isBattery = status?.status?.includes("OB");
  const isCharging = status?.status?.includes("CHRG");
  const batteryLevel = status?.charge || 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
            <Zap className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Gestión de Energía</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Monitoreo de SAI (NUT) y Protección Eléctrica</p>
          </div>
        </div>

        <div className={`flex items-center space-x-3 px-4 py-2 rounded-2xl border ${isBattery ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
           <div className={`w-2 h-2 rounded-full animate-pulse ${isBattery ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
           <span className={`text-[10px] font-black uppercase tracking-widest ${isBattery ? 'text-red-400' : 'text-emerald-400'}`}>
              {isBattery ? 'Modo Batería: Corte Detectado' : 'Alimentación AC: En Línea'}
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Battery Visual Widget */}
        <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 flex flex-col items-center text-center">
           <div className="relative w-32 h-64 border-4 border-white/10 rounded-3xl p-2 mb-8 bg-black/20">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-4 bg-white/10 rounded-t-lg"></div>
              <div className="w-full h-full rounded-2xl overflow-hidden flex flex-col justify-end relative">
                 <motion.div 
                   initial={{ height: 0 }}
                   animate={{ height: `${batteryLevel}%` }}
                   className={`w-full transition-all duration-1000 ${
                     batteryLevel < 20 ? 'bg-red-500' : 
                     batteryLevel < 50 ? 'bg-yellow-500' : 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                   }`}
                 />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center">
                       <span className="text-4xl font-black text-white tracking-tighter">{batteryLevel}%</span>
                       {isCharging && <BatteryCharging className="w-6 h-6 text-white mt-1 animate-pulse" />}
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="space-y-1">
              <h3 className="text-white font-bold uppercase tracking-tight">Capacidad Actual</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{isBattery ? 'Descargando' : 'Totalmente protegida'}</p>
           </div>
        </div>

        {/* Real-time Stats */}
        <div className="lg:col-span-2 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-6">
                 <div className="flex items-center space-x-3 text-slate-500 mb-4">
                    <Clock className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Autonomía estimada</span>
                 </div>
                 <p className="text-3xl font-black text-white tracking-tight">
                    {Math.floor(status?.runtime / 60)} <span className="text-lg text-slate-500">MINUTOS</span>
                 </p>
                 <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500">
                    <span className="uppercase font-bold">Cierre seguro a los:</span>
                    <span className="text-red-400 font-black">5 MIN</span>
                 </div>
              </div>

              <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-6">
                 <div className="flex items-center space-x-3 text-slate-500 mb-4">
                    <Activity className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Carga del SAI</span>
                 </div>
                 <p className="text-3xl font-black text-white tracking-tight">
                    {status?.load}% <span className="text-lg text-slate-500">LOAD</span>
                 </p>
                 <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500">
                    <span className="uppercase font-bold">Tensión Entrada:</span>
                    <span className="text-blue-400 font-black">{status?.voltage}V</span>
                 </div>
              </div>
           </div>

           {/* Event History */}
           <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden min-h-[300px]">
              <div className="px-8 py-5 border-b border-white/5 flex items-center space-x-3 bg-white/[0.02]">
                 <History className="w-4 h-4 text-slate-500" />
                 <h2 className="text-[11px] font-black uppercase tracking-widest text-white">Historial de Eventos Eléctricos</h2>
              </div>
              
              <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                 {events.length === 0 ? (
                   <div className="px-8 py-12 text-center text-slate-600 text-[11px] font-black uppercase tracking-widest">
                      No hay incidentes de energía registrados
                   </div>
                 ) : events.map(event => (
                   <div key={event.id} className="px-8 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center space-x-4">
                         <div className={`p-2 rounded-lg ${
                            event.type === 'AC_RESTORED' ? 'bg-emerald-500/10 text-emerald-500' : 
                            event.type === 'SHUTDOWN_INITIATED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                         }`}>
                            {event.type === 'AC_RESTORED' ? <Zap className="w-4 h-4" /> : <BatteryWarning className="w-4 h-4" />}
                         </div>
                         <div>
                            <p className="text-xs font-bold text-slate-200">{event.message}</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">{new Date(event.timestamp).toLocaleString()}</p>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {isBattery && (
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-start space-x-4 animate-pulse">
           <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
           <div>
              <h4 className="text-sm font-black text-red-400 uppercase tracking-widest mb-1">Corte de alimentación activo</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                 El sistema está consumiendo energía de la batería del SAI. Se iniciará un apagado seguro automáticamente si el nivel baja del 15% para proteger tus discos duros.
              </p>
           </div>
        </div>
      )}
    </div>
  );
}
