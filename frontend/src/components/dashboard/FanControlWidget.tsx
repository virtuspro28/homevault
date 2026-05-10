import React from 'react';
import { Wind, Thermometer, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface FanControlWidgetProps {
  rpm: number;
  pwm: number;
  auto: boolean;
  cpuTemp: number;
  detected?: boolean;
  onManualClick?: () => void;
}

const FanControlWidget: React.FC<FanControlWidgetProps> = ({ rpm, pwm, auto, cpuTemp, detected = true, onManualClick }) => {
  if (!detected) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4 opacity-60 grayscale">
         <Wind className="w-10 h-10 text-slate-600" />
         <div>
            <h3 className="text-sm font-black text-slate-400 uppercase">Controlador no Detectado</h3>
            <p className="text-[10px] text-slate-600 font-bold">EMC2305 NO ENCONTRADO EN I2C</p>
         </div>
      </div>
    );
  }

  const percentage = Math.round((pwm / 255) * 100);
  
  // Color dinámico según temperatura
  const getTempColor = (t: number) => {
    if (t < 45) return 'text-emerald-400';
    if (t < 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-[2.5rem] relative overflow-hidden group hover:border-blue-500/30 transition-all shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-500/10 rounded-2xl group-hover:rotate-180 transition-transform duration-1000">
            <Wind className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Ventilador</h3>
            <p className="text-[10px] text-slate-500 font-bold">{auto ? 'MODO AUTOMÁTICO' : 'CONTROL MANUAL'}</p>
          </div>
        </div>
        <button 
          onClick={onManualClick}
          className="p-2 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl rounded-xl transition-all"
        >
          <Settings className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-baseline space-x-1 mb-1">
             <span className="text-4xl font-black text-white">{rpm}</span>
             <span className="text-xs font-bold text-slate-500 uppercase">RPM</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
            />
          </div>
        </div>
        
        <div className="flex flex-col items-center">
           <div className={`text-xl font-black ${getTempColor(cpuTemp)}`}>
             {cpuTemp.toFixed(1)}°C
           </div>
           <Thermometer className={`w-4 h-4 mt-1 ${getTempColor(cpuTemp)} opacity-50`} />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/5 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
         <span>Intensidad: {percentage}%</span>
         <span className={auto ? 'text-blue-400' : 'text-amber-400'}>{auto ? 'Curva Activa' : 'Fijado'}</span>
      </div>
    </div>
  );
};

export default FanControlWidget;
