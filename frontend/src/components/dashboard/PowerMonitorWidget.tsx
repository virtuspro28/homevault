import React from 'react';
import { Zap, Activity, AlertCircle } from 'lucide-react';


interface PowerMonitorWidgetProps {
  voltage: number;
  current: number;
  power: number;
  detected?: boolean;
}

const PowerMonitorWidget: React.FC<PowerMonitorWidgetProps> = ({ voltage, current, power, detected = true }) => {
  if (!detected) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4 opacity-60 grayscale">
         <Zap className="w-10 h-10 text-slate-600" />
         <div>
            <h3 className="text-sm font-black text-slate-400 uppercase">Sensor Energético Inactivo</h3>
            <p className="text-[10px] text-slate-600 font-bold">INA238 NO RESPONDE EN BUS I2C</p>
         </div>
      </div>
    );
  }

  const isUnderVoltage = voltage < 4.75;

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-[2.5rem] group hover:border-amber-500/30 transition-all shadow-xl overflow-hidden relative">
      {isUnderVoltage && (
        <div className="absolute top-0 inset-x-0 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse" />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-2xl ${isUnderVoltage ? 'bg-red-500/20' : 'bg-amber-500/10'}`}>
            <Zap className={`w-5 h-5 ${isUnderVoltage ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Potencia</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Consumo Eléctrico INA238</p>
          </div>
        </div>
        {isUnderVoltage && (
           <div className="flex items-center space-x-2 text-red-500 animate-bounce">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Under-voltage!</span>
           </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
         {/* Watts */}
         <div className="bg-black/20 p-4 rounded-3xl border border-white/5 text-center">
            <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Carga</span>
            <div className="flex items-baseline justify-center gap-1">
               <span className="text-xl font-black text-white">{power.toFixed(2)}</span>
               <span className="text-[10px] font-bold text-slate-500">W</span>
            </div>
         </div>

         {/* Volts */}
         <div className={`bg-black/20 p-4 rounded-3xl border text-center ${isUnderVoltage ? 'border-red-500/30' : 'border-white/5'}`}>
            <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Voltaje</span>
            <div className="flex items-baseline justify-center gap-1">
               <span className={`text-xl font-black ${isUnderVoltage ? 'text-red-400' : 'text-white'}`}>{voltage.toFixed(2)}</span>
               <span className="text-[10px] font-bold text-slate-500">V</span>
            </div>
         </div>

         {/* Amps */}
         <div className="bg-black/20 p-4 rounded-3xl border border-white/5 text-center">
            <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Intens.</span>
            <div className="flex items-baseline justify-center gap-1">
               <span className="text-xl font-black text-white">{current.toFixed(2)}</span>
               <span className="text-[10px] font-bold text-slate-500">A</span>
            </div>
         </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
         <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Telemetría I2C Activa</span>
         </div>
         <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-1 h-3 bg-blue-500/20 rounded-full" />
            ))}
         </div>
      </div>
    </div>
  );
};

export default PowerMonitorWidget;
