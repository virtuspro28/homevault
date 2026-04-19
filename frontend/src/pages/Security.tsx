import { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Trash2, Globe, AlertTriangle, Info, RefreshCw, X, Fingerprint, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Security() {
  const [rules, setRules] = useState<any[]>([]);
  const [recentIps, setRecentIps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      const [rulesRes, ipsRes] = await Promise.all([
        fetch('/api/security/firewall/rules'),
        fetch('/api/security/firewall/recent-ips')
      ]);
      const rulesData = await rulesRes.json();
      const ipsData = await ipsRes.json();
      
      if (rulesData.success) setRules(rulesData.data);
      if (ipsData.success) setRecentIps(ipsData.data);
    } catch (err) {
      console.error('Error fetching security data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (index: number) => {
    // Lógica para activar/desactivar regla
    const rule = rules[index];
    try {
      await fetch(`/api/security/firewall/rules/${rule.id}/toggle`, { method: 'POST' });
      fetchSecurityData();
    } catch (err) {
      alert('Error al cambiar estado de la regla');
    }
  };

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
          <div className="p-4 bg-red-500/10 rounded-2xl">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Seguridad y Firewall</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Control de fail2ban e IPtables</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-600/20"
        >
          <Fingerprint className="w-5 h-5" />
          <span>Nueva Regla</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de Reglas */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-4">
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Reglas Activas</span>
             </h3>
             <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{rules.length} Activas</span>
          </div>

          <div className="space-y-4">
            {rules.map((rule, idx) => (
              <motion.div 
                key={rule.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:border-red-500/20 transition-all"
              >
                <div className="flex items-center space-x-6">
                   <div className={`p-4 rounded-2xl ${rule.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-slate-500'}`}>
                      <Lock className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-sm font-black text-white">{rule.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{rule.port} • {rule.protocol}</p>
                   </div>
                </div>
                <div className="flex items-center space-x-4">
                   <button 
                    onClick={() => handleToggleRule(idx)}
                    className={`w-12 h-6 rounded-full relative transition-all ${rule.status === 'active' ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${rule.status === 'active' ? 'right-1' : 'left-1'}`} />
                   </button>
                   <button className="p-2 text-slate-600 hover:text-red-500 transition-colors">
                      <Trash2 className="w-5 h-5" />
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* IPs Bloqueadas Recientemente */}
        <div className="space-y-6">
           <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] px-4">Intrusiones Recientes</h3>
           <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-red-500/5">
                 <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="text-xs font-black text-white uppercase tracking-widest">Fail2Ban Health</span>
                 </div>
              </div>
              <div className="divide-y divide-white/5">
                {recentIps.map((log, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                     <div className="flex items-center space-x-3">
                        <Globe className="w-4 h-4 text-slate-500" />
                        <div>
                           <p className="text-xs font-bold text-white">{log.ip}</p>
                           <p className="text-[10px] text-slate-500 font-bold">{log.country || 'Unknown'}</p>
                        </div>
                     </div>
                     <span className="text-[10px] font-black text-red-500 uppercase">{log.attempts} fallos</span>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white/5 text-center">
                 <button className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] hover:text-blue-300 transition-colors">
                    Ver todos los incidentes
                 </button>
              </div>
           </div>

           <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] flex items-start space-x-4">
              <Info className="w-5 h-5 text-emerald-500 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                 Tu Firewall está configurado para bloquear automáticamente cualquier IP con más de 5 intentos fallidos de login mediante **Fail2Ban**.
              </p>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowAdd(false)}
               className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
             >
                <div className="flex justify-between items-center mb-8">
                   <h2 className="text-xl font-black text-white flex items-center space-x-3">
                      <Lock className="w-5 h-5 text-blue-500" />
                      <span>Nueva Regla de Firewall</span>
                   </h2>
                   <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                      <X className="w-5 h-5 text-slate-500" />
                   </button>
                </div>
                <div className="space-y-6">
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Nombre del Servicio</label>
                      <input type="text" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="ex: Web Server" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Puerto</label>
                        <input type="number" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm" placeholder="80" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Protocolo</label>
                        <select className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm appearance-none outline-none">
                           <option>TCP</option>
                           <option>UDP</option>
                        </select>
                      </div>
                   </div>
                   <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all mt-4">
                      Aplicar Nueva Regla
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
