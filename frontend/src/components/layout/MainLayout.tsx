import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { Power, RotateCw, Bell, Shield, AlertCircle, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import GlobalLoader from './GlobalLoader';

export default function MainLayout() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showConfirm, setShowConfirm] = useState<'reboot' | 'shutdown' | null>(null);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setNavigating(true);
    const timer = setTimeout(() => setNavigating(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    fetchNotifications();
    requestNotificationPermission();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const showNativeNotification = (message: string, level: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`HomePiNAS - ${level}`, {
        body: message,
        icon: '/favicon.ico'
      });
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/system/notifications/history');
      const data = await res.json();
      if (data.success) {
        if (data.data.length > notifications.length) {
          const latest = data.data[0];
          if (latest.level === 'CRITICAL') showNativeNotification(latest.message, latest.level);
        }
        setNotifications(data.data);
      }
    } catch (err) {
      console.error("Error fetching notifications history:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/system/events/read-all', { method: 'PATCH' });
      setNotifications([]);
    } catch (err) {
      console.error("Error marking as read");
    }
  };

  const handleSystemAction = async (action: 'reboot' | 'shutdown') => {
    try {
      await fetch(`/api/system/${action}`, { method: 'POST' });
      alert(`${action === 'reboot' ? 'Reiniciando' : 'Apagando'} sistema...`);
      setShowConfirm(null);
    } catch (err) {
      alert("Error ejecutando acción de sistema");
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-500 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Sidebar onLogout={logout} />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

        <header className="h-20 border-b border-white/5 bg-slate-900/40 backdrop-blur-xl px-8 flex items-center justify-between z-40">
           <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">System Core v1.2</span>
           </div>

           <div className="flex items-center space-x-6">
              <div className="relative">
                <button 
                  onClick={() => setShowNotif(!showNotif)}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all relative"
                >
                  <Bell className="w-5 h-5 text-slate-400" />
                  {notifications.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-900"></span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotif && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-80 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-4 overflow-hidden"
                    >
                       <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Historial Reciente</h3>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={markAllAsRead}
                            className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-tighter"
                          >
                            Marcar todo como leído
                          </button>
                          <button onClick={() => setShowNotif(false)}><X className="w-3 h-3 text-slate-500" /></button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                         {notifications.length === 0 ? (
                           <p className="text-[10px] text-slate-600 text-center py-4">No hay alertas registradas recientemente.</p>
                         ) : notifications.map(n => (
                           <div key={n.id} className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-start space-x-3">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                n.level === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                                n.level === 'WARNING' ? 'bg-yellow-500' : 'bg-blue-500'
                              }`} />
                              <div>
                                <p className="text-xs text-slate-200 line-clamp-2 leading-tight">{n.message}</p>
                                <p className="text-[9px] text-slate-500 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                              </div>
                           </div>
                         ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="p-2.5 bg-white/5 hover:bg-white/10 dark:hover:bg-white/10 rounded-xl transition-all group"
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform" />
                ) : (
                  <Moon className="w-5 h-5 text-indigo-600" />
                )}
              </button>

              <div className="h-8 w-px bg-white/5"></div>

              {/* Botones de Energía */}
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setShowConfirm('reboot')}
                  className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20 text-[10px] font-black uppercase tracking-widest flex items-center"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-2" />
                  Reiniciar
                </button>
                <button 
                  onClick={() => setShowConfirm('shutdown')}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-widest flex items-center"
                >
                  <Power className="w-3.5 h-3.5 mr-2" />
                  Apagar
                </button>
              </div>
           </div>
        </header>
        
        <AnimatePresence mode="wait">
          {navigating && <GlobalLoader />}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                transition={{ duration: 0.3 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>


      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-[3rem] p-10 max-w-lg w-full text-center shadow-2xl"
            >
              <div className={`p-6 rounded-full w-24 h-24 mx-auto mb-8 flex items-center justify-center ${
                showConfirm === 'reboot' ? 'bg-blue-500/10' : 'bg-red-500/10'
              }`}>
                <AlertCircle className={`w-12 h-12 ${showConfirm === 'reboot' ? 'text-blue-500' : 'text-red-500'}`} />
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">¿Estás seguro?</h2>
              <p className="text-slate-400 mb-10 leading-relaxed uppercase text-xs font-bold tracking-widest">
                Estas a punto de {showConfirm === 'reboot' ? 'reiniciar' : 'apagar'} el sistema HomePiNAS. 
                Los servicios activos (Plex, Pi-hole, etc.) se detendrán.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <button 
                  onClick={() => setShowConfirm(null)}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300 font-bold uppercase text-xs tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleSystemAction(showConfirm)}
                  className={`px-8 py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-lg ${
                    showConfirm === 'reboot' ? 'bg-blue-600 shadow-blue-600/20' : 'bg-red-600 shadow-red-600/20'
                  }`}
                >
                  Confirmar {showConfirm === 'reboot' ? 'Reinicio' : 'Apagado'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
