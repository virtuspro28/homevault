import { useEffect, useState } from 'react';
import {
  Shield,
  Plus,
  ExternalLink,
  HardDrive,
  Clock,
  CheckCircle2,
  Play,
  Usb,
  FolderOpen,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getErrorMessage } from '../lib/errors';
import { reportClientError } from '../lib/runtimeLog';

interface BackupTask {
  id: string;
  machineName: string;
  sourcePath: string;
  destinationPath: string;
  schedule: string;
  taskType: string;
  lastBackup: string | null;
  status: 'idle' | 'running' | 'success' | 'failed';
}

interface UsbDrive {
  label?: string;
  mountPoint: string;
  capacity: string;
}

export default function BackupManager() {
  const [tasks, setTasks] = useState<BackupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [usbDrives, setUsbDrives] = useState<UsbDrive[]>([]);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  useEffect(() => {
    void fetchTasks();
    void fetchUsbDrives();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/backup/tasks', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setTasks(data.data);
    } catch (error) {
      reportClientError('backup-tasks', getErrorMessage(error, 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchUsbDrives = async () => {
    try {
      const res = await fetch('/api/backup/usb', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setUsbDrives(data.data);
    } catch (error) {
      reportClientError('backup-usb', getErrorMessage(error, 'Unknown error'));
    }
  };

  const handleRunTask = async (taskId: string) => {
    setExecutingTaskId(taskId);
    try {
      const res = await fetch(`/api/backup/run/${taskId}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        alert('Tarea de respaldo iniciada');
        void fetchTasks();
      }
    } catch {
      alert('Error al iniciar respaldo');
    } finally {
      setExecutingTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta tarea?')) return;
    try {
      await fetch(`/api/backup/tasks/${taskId}`, { method: 'DELETE', credentials: 'include' });
      void fetchTasks();
    } catch {
      alert('Error al eliminar tarea');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-emerald-500/10 rounded-2xl">
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Centro de Respaldos</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Estrategia 3-2-1 Protegida</p>
          </div>
        </div>
        <button
          onClick={() => alert('Próximamente')}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Tarea</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Tareas Programadas</span>
          </h3>

          <AnimatePresence mode="popLayout">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] group hover:border-white/10 transition-all"
              >
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex items-start space-x-4">
                    <div className={`p-4 rounded-2xl ${
                      task.status === 'running' ? 'bg-blue-500/10 animate-pulse' :
                      task.status === 'success' ? 'bg-emerald-500/10' :
                      task.status === 'failed' ? 'bg-red-500/10' : 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl'
                    }`}>
                      {task.taskType === 'EXTERNAL' ? <Usb className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="font-black text-white">{task.machineName}</h4>
                      <div className="flex items-center space-x-4 mt-2 text-xs font-bold text-slate-500">
                        <span className="flex items-center space-x-1">
                          <FolderOpen className="w-3 h-3" />
                          <span className="truncate">{task.sourcePath}</span>
                        </span>
                        <span>→</span>
                        <span className="flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate">{task.destinationPath}</span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 mt-4">
                        <span className="px-2 py-1 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl rounded-md text-[10px] text-slate-400 uppercase">{task.schedule}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          task.status === 'success' ? 'text-emerald-500' :
                          task.status === 'failed' ? 'text-red-500' :
                          task.status === 'running' ? 'text-blue-400' : 'text-slate-500'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center md:flex-col justify-end gap-2">
                    <button
                      onClick={() => void handleRunTask(task.id)}
                      disabled={task.status === 'running' || executingTaskId === task.id}
                      className="p-3 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all disabled:opacity-50"
                    >
                      {executingTaskId === task.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => void handleDeleteTask(task.id)}
                      className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {tasks.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
              <HardDrive className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
              <p className="text-slate-500 font-bold">No hay tareas de respaldo configuradas</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center space-x-2">
            <Usb className="w-4 h-4" />
            <span>Discos Externos</span>
          </h3>

          <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] overflow-hidden">
            {usbDrives.map((drive, idx) => (
              <div key={idx} className="p-6 border-b border-white/5 last:border-0 hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl transition-all">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <Usb className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{drive.label || 'Disco Externo'}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{drive.mountPoint}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-white">{drive.capacity}</p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto mt-1" />
                  </div>
                </div>
              </div>
            ))}

            {usbDrives.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-xs font-bold text-slate-600">No se detectaron discos USB</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-[2rem]">
            <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">Tip de Seguridad</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recuerda la regla **3-2-1**: Mantén 3 copias de tus datos, en 2 soportes diferentes y **1 fuera de casa** para máxima seguridad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
