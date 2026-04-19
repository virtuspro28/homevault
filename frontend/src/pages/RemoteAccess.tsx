import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Globe, 
  Key, 
  Smartphone, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Lock, 
  AlertCircle, 
  X,
  Shield,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RemoteAccess() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetch('/api/remote/certificates')
      .then(res => res.json())
      .then(data => {
        if (data.success) setCertificates(data.data);
      });
  }, []);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <Globe className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Acceso Remoto</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Nginx Proxy Manager & SSL</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Proxy / Cert</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ceritificados SSL */}
        <div className="lg:col-span-2 space-y-6">
           <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Certificados SSL Activos</span>
           </h3>

           <div className="space-y-4">
              {certificates.map((cert) => (
                <div key={cert.id} className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:border-blue-500/20 transition-all">
                   <div className="flex items-center space-x-6">
                      <div className="p-4 bg-white/5 rounded-2xl text-emerald-500">
                         <Lock className="w-6 h-6" />
                      </div>
                      <div>
                         <p className="text-sm font-black text-white">{cert.domain}</p>
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Expira: {new Date(cert.expiry).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <div className="flex items-center space-x-4">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                         Auto-renew
                      </span>
                      <button className="p-2 text-slate-600 hover:text-red-500 transition-colors">
                         <Trash2 className="w-5 h-5" />
                      </button>
                   </div>
                </div>
              ))}

              {certificates.length === 0 && (
                 <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
                    <Key className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                    <p className="text-slate-500 font-bold">No hay certificados configurados</p>
                 </div>
              )}
           </div>
        </div>

        {/* Dynamic DNS & Security */}
        <div className="space-y-8">
           <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Estado DDNS</h3>
                 <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                 <span className="text-xs font-bold text-slate-400 uppercase">Provedor</span>
                 <span className="text-xs font-black text-white">DuckDNS</span>
              </div>
              <div className="flex justify-between mt-6">
                 <span className="text-[10px] font-black text-slate-500 uppercase">Ultimo Sync:</span>
                 <span className="text-[10px] font-black text-emerald-500 uppercase">Hace 5 min</span>
              </div>
           </div>

           <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">2FA Activation</h3>
                 <Smartphone className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-6 font-bold">
                 Protege tu acceso remoto activando la autenticación de dos pasos para todos los administradores.
              </p>
              <button className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                 Configurar 2FA
              </button>
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
                      <Shield className="w-5 h-5 text-blue-500" />
                      <span>Nuevo Proxy / Certificado</span>
                   </h2>
                   <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                      <X className="w-5 h-5 text-slate-500" />
                   </button>
                </div>
                <div className="space-y-6">
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Dominio (FQDN)</label>
                      <div className="relative">
                        <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input type="text" className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="nas.tu-dominio.com" />
                      </div>
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Destino Interno</label>
                      <div className="relative">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input type="text" className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="http://192.168.1.50:8080" />
                      </div>
                   </div>
                   <div className="flex items-center space-x-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-blue-400" />
                      <p className="text-[10px] font-bold text-blue-300 uppercase leading-relaxed">
                         Se generará un certificado Let's Encrypt automáticamente.
                      </p>
                   </div>
                   <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all mt-4">
                      Generar Acceso Seguro
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
