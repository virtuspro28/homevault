interface UsageBarProps {
  percent: number;
  color?: string;
  label?: string;
  subText?: string;
}

export default function UsageBar({ percent, color = 'blue', label, subText }: UsageBarProps) {
  // Animación del ancho de la barra
  const clamped = Math.min(100, Math.max(0, percent));
  
  // Color dinámico según el color prop o el porcentaje
  const barColor = color === 'blue' ? (clamped > 85 ? 'bg-red-500' : clamped > 60 ? 'bg-amber-400' : 'bg-blue-500') : `bg-${color}-500`;
  const shadowColor = color === 'blue' ? (clamped > 85 ? 'shadow-red-500/50' : clamped > 60 ? 'shadow-amber-400/50' : 'shadow-blue-500/50') : `shadow-${color}-500/50`;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-sm font-semibold text-slate-300">{label || 'Uso'}</span>
        <span className="text-sm font-bold text-slate-100">{clamped}%</span>
      </div>
      
      <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 relative">
        <div 
          className={`h-full ${barColor} ${shadowColor} rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-700 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      
      <p className="text-xs text-slate-500 font-medium tracking-wide flex justify-between">
        <span>{subText || 'Monitor de sistema'}</span>
      </p>
    </div>
  );
}
