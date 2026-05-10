import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string; // e.g. "+2%" o un valor
  trendColor?: 'green' | 'red' | 'blue' | 'slate';
  className?: string; // para personalizar grid spans
}

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  trendColor = 'slate',
  className = ''
}: StatCardProps) {
  return (
    <div className={`bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-6 transition-all hover:bg-slate-900/60 hover:border-slate-700 shadow-xl shadow-black/20 ${className}`}>
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-slate-400">{title}</p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-3xl font-bold text-slate-100 tracking-tight">{value}</h3>
            {trend && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                trendColor === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                trendColor === 'red' ? 'bg-red-500/10 text-red-400' :
                trendColor === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                'bg-slate-500/10 text-slate-400'
              }`}>
                {trend}
              </span>
            )}
          </div>
        </div>
        
        <div className="p-3 bg-slate-800/80 backdrop-blur-xl border border-white/10 shadow-xl rounded-xl border border-slate-700/50">
          <Icon className="w-6 h-6 text-blue-400" />
        </div>
      </div>
      
      {subtitle && (
        <p className="mt-4 text-xs font-medium text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}
