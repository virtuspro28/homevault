import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  History,
  Activity
} from 'lucide-react';

interface EventLog {
  id: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  message: string;
  source: string;
  timestamp: string;
}

export default function Events() {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/system/notifications/history');
      const data = await res.json();
      if (data.success) setEvents(data.data);
    } catch (err) {
      console.error('Error fetching event logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.message.toLowerCase().includes(filter.toLowerCase()) ||
                         event.source.toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter === 'ALL' || event.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  if (loading) {
     return (
       <div className="flex items-center justify-center min-h-[60vh]">
         <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
       </div>
     );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <History className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Visor de Eventos</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Logs del sistema en tiempo real</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
           <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Filtrar eventos..."
                className="w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
           </div>
           <select 
             className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl border border-white/10 px-4 py-3 rounded-2xl text-sm font-bold text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
             value={levelFilter}
             onChange={(e) => setLevelFilter(e.target.value)}
           >
              <option value="ALL">Todos los Niveles</option>
              <option value="CRITICAL">Críticos</option>
              <option value="WARNING">Advertencias</option>
              <option value="INFO">Información</option>
              <option value="SUCCESS">Éxito</option>
           </select>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] overflow-hidden">
         <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center space-x-2">
               <Activity className="w-4 h-4" />
               <span>Cronología del Sistema</span>
            </h3>
            <button 
              onClick={fetchEvents}
              className="p-2 hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl rounded-xl transition-all"
            >
               <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5">
                     <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest pl-12">Nivel</th>
                     <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fuente</th>
                     <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Mensaje</th>
                     <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-white/[0.03] transition-colors group">
                       <td className="p-6 pl-12 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                             <div className={`w-2 h-2 rounded-full ${
                               event.level === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                               event.level === 'WARNING' ? 'bg-amber-500' :
                               event.level === 'SUCCESS' ? 'bg-emerald-500' : 'bg-blue-500'
                             }`} />
                             <span className={`text-[10px] font-black uppercase tracking-widest ${
                               event.level === 'CRITICAL' ? 'text-red-500' :
                               event.level === 'WARNING' ? 'text-amber-500' :
                               event.level === 'SUCCESS' ? 'text-emerald-500' : 'text-blue-500'
                             }`}>
                                {event.level}
                             </span>
                          </div>
                       </td>
                       <td className="p-6">
                          <span className="text-xs font-black text-white bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl px-2 py-1 rounded-md">{event.source}</span>
                       </td>
                       <td className="p-6">
                          <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-md">
                             {event.message}
                          </p>
                       </td>
                       <td className="p-6 whitespace-nowrap">
                          <div className="flex items-center space-x-2 text-slate-500">
                             <Clock className="w-3 h-3" />
                             <span className="text-[10px] font-bold">
                                {new Date(event.timestamp).toLocaleString()}
                             </span>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>

            {filteredEvents.length === 0 && (
               <div className="py-20 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                  <p className="text-slate-500 font-bold">No se encontraron eventos</p>
               </div>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] flex items-start space-x-4">
            <CheckCircle2 className="w-6 h-6 text-blue-500 mt-1" />
            <div>
               <p className="text-sm font-black text-white uppercase tracking-widest mb-1">Retención Activa</p>
               <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Los eventos del sistema se almacenan localmente durante 30 días para auditoría y resolución de problemas.
               </p>
            </div>
         </div>
         <div className="p-8 bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem] flex items-start space-x-4">
            <ShieldAlert className="w-6 h-6 text-amber-500 mt-1" />
            <div>
               <p className="text-sm font-black text-white uppercase tracking-widest mb-1">Alertas Críticas</p>
               <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Cualquier alerta marcada como **CRITICAL** activa automáticamente una notificación push en el navegador.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
