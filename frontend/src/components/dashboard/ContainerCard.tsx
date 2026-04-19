import { Play, Square, Loader2, Box } from 'lucide-react';
import type { ContainerInfo } from '../../types/docker';

interface ContainerCardProps {
  container: ContainerInfo;
  isProcessing?: boolean;
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
}

export default function ContainerCard({ container, isProcessing = false, onStart, onStop }: ContainerCardProps) {
  const isRunning = container.state === 'running';

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-5 hover:bg-slate-900/60 transition-all shadow-xl shadow-black/20 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Box className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 truncate w-32 md:w-48" title={container.name}>
                {container.name}
              </h3>
              <p className="text-xs font-mono text-slate-400 truncate w-32 md:w-48" title={container.image}>
                {container.image}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
            <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {container.state}
            </span>
          </div>
        </div>
        
        <div className="mb-6 bg-slate-950/30 p-3 rounded-xl border border-slate-800/50">
          <p className="text-xs font-medium text-slate-400 flex justify-between">
            <span>Server Status</span>
            <span className="text-slate-300">{container.status || 'N/A'}</span>
          </p>
        </div>
      </div>

      <div className="flex space-x-3">
        {isRunning ? (
          <button
            onClick={() => onStop?.(container.id)}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Square className="w-4 h-4 mr-2" /> Apagar</>}
          </button>
        ) : (
          <button
            onClick={() => onStart?.(container.id)}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-4 h-4 mr-2" /> Iniciar</>}
          </button>
        )}
      </div>
    </div>
  );
}
