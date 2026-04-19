import { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  ShoppingBag,
  Plus,
  Info
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import NetworkHistoryChart from '../components/dashboard/NetworkHistoryChart';
import ContainerCard from '../components/dashboard/ContainerCard';
import UsageBar from '../components/dashboard/UsageBar';
import DiskHealthCard from '../components/DiskHealthCard';
import FanControlWidget from '../components/dashboard/FanControlWidget';
import PowerMonitorWidget from '../components/dashboard/PowerMonitorWidget';
import SummaryRow from '../components/dashboard/SummaryRow';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [hardware, setHardware] = useState<any>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, hwResponse, containersRes] = await Promise.all([
          fetch('/api/system/stats'),
          fetch('/api/hardware/telemetry'),
          fetch('/api/docker/containers')
        ]);

        const statsData = await statsRes.json();
        const hwData = await hwResponse.json();
        const containersData = await containersRes.json();

        if (statsData.success) setStats(statsData.data);
        if (hwData.success) setHardware(hwData.data);
        if (containersData.success) setContainers(containersData.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats || !hardware) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const pieData = [
    { name: 'Usado', value: stats.storage.used, color: '#3b82f6' },
    { name: 'Disponible', value: stats.storage.total - stats.storage.used, color: '#1e293b' }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* 🟢 Summary Row (Fase 38) */}
      <SummaryRow 
        activeContainers={stats.docker.active}
        smartHealthy={stats.storage.healthyDisks || hardware.disks.filter((d:any) => d.status === 'healthy').length}
        blockedIps={stats.security.blockedToday}
        uptime={stats.system.uptimeFormatted}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Storage Widget */}
        <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-white">Almacenamiento</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Pool de Datos</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-2xl">
                <HardDrive className="w-5 h-5 text-blue-500" />
              </div>
           </div>

           <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={pieData[index].color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-4xl font-black text-white">{stats.storage.percent}%</span>
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Capacidad</span>
              </div>
           </div>

           <div className="mt-8 space-y-4">
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                 <span className="text-xs font-bold text-slate-400">Total</span>
                 <span className="text-sm font-black text-white">{stats.storage.totalGb} GB</span>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                 <span className="text-xs font-bold text-slate-400">Libre</span>
                 <span className="text-sm font-black text-blue-400">{stats.storage.freeGb} GB</span>
              </div>
           </div>
        </div>

        {/* Network Chart */}
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                 <h3 className="text-lg font-black text-white">Tráfico de Red</h3>
                 <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Ethernet eth0</p>
              </div>
              <div className="flex items-center space-x-3">
                 <div className="flex items-center space-x-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-blue-400 uppercase">Live</span>
                 </div>
              </div>
            </div>
            <NetworkHistoryChart />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <FanControlWidget 
           rpm={hardware.fan.rpm}
           pwm={hardware.fan.pwm}
           auto={hardware.fan.auto}
           cpuTemp={hardware.cpuTemp}
           detected={hardware.fan.detected}
         />
         <PowerMonitorWidget 
           voltage={hardware.power.voltage}
           current={hardware.power.current}
           power={hardware.power.power}
           detected={hardware.power.detected}
         />
      </div>

      {/* Resources & Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* CPU & RAM Grid */}
         <div className="space-y-8">
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">CPU Load</h3>
                 <Cpu className="w-4 h-4 text-blue-500" />
               </div>
               <UsageBar percent={stats.cpu.usage} color="blue" />
               <div className="mt-4 flex justify-between">
                 <span className="text-[10px] font-black text-slate-500 uppercase">{hardware.cpuTemp.toFixed(1)}°C Temp</span>
                 <span className="text-[10px] font-black text-slate-500 uppercase">{stats.cpu.cores} Cores</span>
               </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Memory</h3>
                 <Activity className="w-4 h-4 text-indigo-500" />
               </div>
               <UsageBar percent={stats.ram.percent} color="indigo" />
               <div className="mt-4 flex justify-between">
                 <span className="text-[10px] font-black text-slate-500 uppercase">{stats.ram.usedGb}GB Used</span>
                 <span className="text-[10px] font-black text-slate-500 uppercase">{stats.ram.total}GB Total</span>
               </div>
            </div>
         </div>

         {/* Docker Containers */}
         <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-white">Contenedores Activos</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Docker Engine</p>
              </div>
              <button className="p-3 bg-white/5 hover:bg-blue-500/10 hover:text-blue-500 rounded-2xl transition-all">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {containers.filter(c => c.state === 'running').slice(0, 4).map(container => (
                 <ContainerCard key={container.id} container={container} />
               ))}
               {containers.length === 0 && (
                 <div className="col-span-2 py-12 flex flex-col items-center justify-center text-slate-600">
                    <ShoppingBag className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-xs font-black uppercase tracking-widest">No hay contenedores activos</p>
                 </div>
               )}
            </div>
         </div>
      </div>

      {/* Disks Health (Fase 18/35) */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8">
         <div className="flex items-center space-x-3 mb-8">
            <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
            <h3 className="text-lg font-black text-white">Estado de Discos</h3>
            <Info className="w-4 h-4 text-slate-600" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {hardware.disks.map((disk: any) => (
              <DiskHealthCard key={disk.path} disk={disk} />
            ))}
         </div>
      </div>
    </div>
  );
}
