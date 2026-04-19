import { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  RefreshCw,
  MemoryStick,
  ArrowUp,
  ArrowDown,
  Layers,
  Terminal, 
  X, 
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';

interface DockerStat {
  ID: string;
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  MemPerc: string;
  NetIO: string;
  BlockIO: string;
  PIDs: string;
}

const ResourceMonitor: React.FC = () => {
  const [stats, setStats] = useState<DockerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [logsContent, setLogsContent] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io({
      auth: { token: localStorage.getItem('token') } // Assuming token is here
    });

    setSocket(newSocket);

    newSocket.emit('docker:stats:subscribe');

    newSocket.on('docker:stats:data', (data: DockerStat[]) => {
      setStats(data);
      setLoading(false);
    });

    return () => {
      newSocket.emit('docker:stats:unsubscribe');
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedLogs && socket) {
      socket.emit('docker:logs:subscribe', selectedLogs);
      setLogsContent([]);

      const logHandler = (data: string) => {
        setLogsContent(prev => [...prev.slice(-100), data]);
      };

      socket.on(`docker:logs:data:${selectedLogs}`, logHandler);

      return () => {
        socket.emit('docker:logs:unsubscribe');
        socket.off(`docker:logs:data:${selectedLogs}`, logHandler);
      };
    }
  }, [selectedLogs, socket]);

  const parsePerc = (val: string) => parseFloat(val.replace('%', '')) || 0;

  return (
    <div className="p-6 bg-slate-950 min-h-full text-slate-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="text-blue-500 w-8 h-8" />
            Resource Monitor Pro
          </h1>
          <p className="text-slate-500 mt-1">Real-time Docker container performance metrics</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live Stream Active
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-500">Connecting to Docker engine...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {stats.map((container) => (
            <motion.div 
              key={container.ID}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 overflow-hidden relative group"
            >
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* ID & Name */}
                <div className="flex items-center gap-4 border-r border-slate-800/50 pr-4">
                  <div className="p-3 bg-blue-600/10 rounded-xl">
                    <Zap className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg truncate" title={container.Name}>{container.Name}</h3>
                    <p className="text-xs font-mono text-slate-500 truncate">{container.ID}</p>
                  </div>
                </div>

                {/* CPU Usage */}
                <div className="flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                      <Cpu className="w-4 h-4" /> CPU
                    </div>
                    <span className="text-sm font-bold text-blue-400">{container.CPUPerc}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(parsePerc(container.CPUPerc), 100)}%` }}
                    />
                  </div>
                </div>

                {/* RAM Usage */}
                <div className="flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                      <Database className="w-4 h-4" /> Memory
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-purple-400 block leading-none">{container.MemPerc}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{container.MemUsage}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(parsePerc(container.MemPerc), 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setSelectedLogs(container.ID)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors border border-slate-700"
                  >
                    <Terminal className="w-4 h-4 text-blue-400" /> Real-time Logs
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Logs View Modal */}
      <AnimatePresence>
        {selectedLogs && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl h-[80vh] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <Terminal className="text-blue-500 w-5 h-5" />
                  <span className="font-bold">Streaming Logs: {stats.find(s => s.ID === selectedLogs)?.Name || selectedLogs}</span>
                </div>
                <button 
                  onClick={() => setSelectedLogs(null)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X />
                </button>
              </div>
              <div className="flex-1 bg-black/50 p-6 overflow-y-auto font-mono text-xs custom-scrollbar">
                {logsContent.length === 0 ? (
                  <p className="text-slate-600 animate-pulse">Waiting for output...</p>
                ) : (
                  logsContent.map((line, i) => (
                    <div key={i} className="mb-1 text-slate-300 whitespace-pre-wrap">{line}</div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResourceMonitor;
