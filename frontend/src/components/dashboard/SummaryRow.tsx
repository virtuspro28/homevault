import React from 'react';
import { 
  Box, 
  ShieldAlert, 
  Clock,
  CheckCircle2
} from 'lucide-react';



interface SummaryRowProps {
  activeContainers: number;
  smartHealthy: number;
  blockedIps: number;
  uptime: string;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ activeContainers, smartHealthy, blockedIps, uptime }) => {
  const cards = [
    {
      label: 'Servicios',
      value: activeContainers,
      sub: 'Docker Activos',
      icon: <Box className="w-5 h-5" />,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    },
    {
      label: 'Discos',
      value: smartHealthy,
      sub: 'Salud SMART OK',
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      label: 'Seguridad',
      value: blockedIps,
      sub: 'IPs Bloqueadas',
      icon: <ShieldAlert className="w-5 h-5" />,
      color: 'text-red-500',
      bg: 'bg-red-500/10'
    },
    {
      label: 'Tiempo',
      value: uptime,
      sub: 'Uptime Sistema',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    }
  ];


  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map((card, i) => (
        <div 
          key={i}
          className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-4 rounded-3xl flex items-center gap-4 hover:border-white/10 transition-all cursor-default"
        >
          <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
            {card.icon}
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{card.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white">{card.value}</span>
              <span className="text-[10px] font-bold text-slate-400">{card.sub}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SummaryRow;
