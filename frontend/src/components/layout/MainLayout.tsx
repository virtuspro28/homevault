import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Bell, Moon, Power, RotateCw, Shield, Sun, X } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileTabBar from './MobileTabBar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getErrorMessage } from '../../lib/errors';

interface NotificationItem {
  id: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: string;
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/store': 'App Store',
  '/files': 'Explorador',
  '/cloud': 'Unidades de Red',
  '/settings': 'Ajustes',
  '/apps': 'Contenedores',
  '/logs': 'Logs',
  '/remote': 'Acceso Remoto',
};

export default function MainLayout() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showConfirm, setShowConfirm] = useState<'reboot' | 'shutdown' | null>(null);
  const [systemMessage, setSystemMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const currentTitle = ROUTE_TITLES[location.pathname] ?? 'HomeVault';

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const showNativeNotification = (message: string, level: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`HomeVault - ${level}`, {
        body: message,
        icon: '/favicon.ico',
      });
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/system/notifications/history', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const nextNotifications = data.data as NotificationItem[];
        setNotifications((previous) => {
          if (nextNotifications.length > previous.length) {
            const latest = nextNotifications[0];
            if (latest?.level === 'CRITICAL') {
              showNativeNotification(latest.message, latest.level);
            }
          }

          return nextNotifications;
        });
      }
    } catch (error) {
      console.error('Error fetching notifications history:', getErrorMessage(error, 'Unknown error'));
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    void requestNotificationPermission();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    try {
      await fetch('/api/system/events/read-all', { method: 'PATCH', credentials: 'include' });
      setNotifications([]);
    } catch (error) {
      console.error('Error marking as read', getErrorMessage(error, 'Unknown error'));
    }
  };

  const handleSystemAction = async (action: 'reboot' | 'shutdown') => {
    try {
      const response = await fetch(`/api/system/${action}`, { method: 'POST', credentials: 'include' });
      const payload = await response.json().catch(() => ({ success: false, error: 'Respuesta no valida del servidor' }));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `No se pudo ejecutar ${action}`);
      }

      setShowConfirm(null);
      setSystemMessage({
        text: action === 'reboot'
          ? 'El sistema se esta reiniciando. La conexion se perdera en unos segundos...'
          : 'El sistema se esta apagando. La conexion se perdera en unos segundos...',
        isError: false,
      });
    } catch (error) {
      setShowConfirm(null);
      const msg = getErrorMessage(error, 'No se pudo ejecutar la accion de sistema');
      setSystemMessage({ text: msg, isError: true });
      setTimeout(() => setSystemMessage(null), 8000);
    }
  };

  return (
    <div className={`flex h-dvh overflow-hidden font-sans transition-colors duration-500 selection:bg-blue-500/30 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Sidebar onLogout={logout} />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-blue-500/10 blur-[120px]" />

        <header className="z-40 border-b border-white/5 bg-slate-900/40 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="hidden items-center space-x-3 lg:flex">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">System Core v1.2</span>
                </div>
                <div className="lg:hidden">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">HomeVault</p>
                  <h1 className="mt-1 text-lg font-black text-white">{currentTitle}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={toggleTheme}
                  className="group flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
                  title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-amber-400 transition-transform group-hover:rotate-45" />
                  ) : (
                    <Moon className="h-5 w-5 text-indigo-300" />
                  )}
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowNotif((current) => !current)}
                    className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
                  >
                    <Bell className="h-5 w-5 text-slate-400" />
                    {notifications.length > 0 && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-slate-900 bg-blue-500" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showNotif && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-2xl"
                      >
                        <div className="mb-4 flex items-center justify-between px-2">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Historial Reciente</h3>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => void markAllAsRead()}
                              className="min-h-[32px] text-[9px] font-bold uppercase tracking-tighter text-blue-400 hover:text-blue-300"
                            >
                              Marcar todo como leido
                            </button>
                            <button onClick={() => setShowNotif(false)}><X className="h-3 w-3 text-slate-500" /></button>
                          </div>
                        </div>

                        <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
                          {notifications.length === 0 ? (
                            <p className="py-4 text-center text-[10px] text-slate-600">No hay alertas registradas recientemente.</p>
                          ) : notifications.map((notification) => (
                            <div key={notification.id} className="flex items-start space-x-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                notification.level === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                                notification.level === 'WARNING' ? 'bg-yellow-500' : 'bg-blue-500'
                              }`} />
                              <div>
                                <p className="line-clamp-2 text-xs leading-tight text-slate-200">{notification.message}</p>
                                <p className="mt-1 text-[9px] text-slate-500">{new Date(notification.timestamp).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                onClick={() => setShowConfirm('reboot')}
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-400"
              >
                <RotateCw className="mr-2 h-3.5 w-3.5" />
                Reiniciar
              </button>
              <button
                onClick={() => setShowConfirm('shutdown')}
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-400"
              >
                <Power className="mr-2 h-3.5 w-3.5" />
                Apagar
              </button>
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-6 md:pb-28 lg:p-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">
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

      <MobileTabBar />

      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-900 p-6 text-center shadow-2xl sm:p-10"
            >
              <div className={`mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full ${
                showConfirm === 'reboot' ? 'bg-blue-500/10' : 'bg-red-500/10'
              }`}>
                <AlertCircle className={`h-12 w-12 ${showConfirm === 'reboot' ? 'text-blue-500' : 'text-red-500'}`} />
              </div>
              <h2 className="mb-4 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">Estas seguro?</h2>
              <p className="mb-10 text-xs font-bold uppercase tracking-widest leading-relaxed text-slate-400">
                Estas a punto de {showConfirm === 'reboot' ? 'reiniciar' : 'apagar'} el sistema HomeVault.
                Los servicios activos se detendran.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="min-h-[48px] rounded-2xl bg-white/10 px-8 py-4 text-xs font-bold uppercase tracking-widest text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleSystemAction(showConfirm)}
                  className={`min-h-[48px] rounded-2xl px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg ${
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

      <AnimatePresence>
        {systemMessage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-6 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-lg text-center"
            >
              <div className={`mx-auto mb-10 flex h-28 w-28 items-center justify-center rounded-full ${
                systemMessage.isError ? 'bg-red-500/10' : 'bg-blue-500/10'
              }`}>
                {systemMessage.isError
                  ? <AlertCircle className="h-14 w-14 text-red-500" />
                  : <Power className="h-14 w-14 animate-pulse text-blue-500" />
                }
              </div>
              <h2 className="mb-6 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                {systemMessage.isError ? 'Error del Sistema' : 'Accion en Curso'}
              </h2>
              <p className="text-sm font-bold uppercase tracking-widest leading-relaxed text-slate-400">
                {systemMessage.text}
              </p>
              {systemMessage.isError && (
                <button
                  onClick={() => setSystemMessage(null)}
                  className="mt-8 min-h-[48px] rounded-2xl bg-white/10 px-8 py-4 text-xs font-bold uppercase tracking-widest text-slate-300"
                >
                  Cerrar
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
