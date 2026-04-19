import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface NetworkHistoryPoint {
  timestamp: number;
  rx_rate: number;
  tx_rate: number;
}

interface NetworkHistoryChartProps {
  data?: NetworkHistoryPoint[];
}

export default function NetworkHistoryChart({ data = [] }: NetworkHistoryChartProps) {
  // Formatear bytes/s a algo legible
  const formatYAxis = (value: number) => {
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} Mb/s`;
    if (value >= 1024) return `${(value / 1024).toFixed(0)} Kb/s`;
    return `${value} b/s`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">
            {new Date(label).toLocaleTimeString()}
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-blue-400 font-bold">Bajada:</span>
              <span className="text-xs text-white">{formatYAxis(payload[0].value)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-xs text-indigo-400 font-bold">Subida:</span>
              <span className="text-xs text-white">{formatYAxis(payload[1].value)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-48 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
          <XAxis 
            dataKey="timestamp" 
            hide 
          />
          <YAxis 
            tickFormatter={formatYAxis} 
            fontSize={10} 
            stroke="#64748b" 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="rx_rate" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorRx)" 
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="tx_rate" 
            stroke="#6366f1" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorTx)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
