import { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  ShoppingBag,
  Plus,
  Info,
  Cloud,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { io, type Socket } from 'socket.io-client';
import NetworkHistoryChart from '../components/dashboard/NetworkHistoryChart';
import ContainerCard from '../components/dashboard/ContainerCard';
import UsageBar from '../components/dashboard/UsageBar';
import DiskHealthCard, { type DiskHealth } from '../components/DiskHealthCard';
import FanControlWidget from '../components/dashboard/FanControlWidget';
import PowerMonitorWidget from '../components/dashboard/PowerMonitorWidget';
import SummaryRow from '../components/dashboard/SummaryRow';
import type { ContainerInfo } from '../types/docker';
import { getErrorMessage } from '../lib/errors';
import { CONTAINERS_CHANGED_EVENT } from '../lib/containerEvents';

interface DashboardStats {
  cpu: { usage: number; cores: number };
  ram: { percent: number; usedGb: string; total: string };
  storage: {
    percent: number;
    total: number;
    used: number;
    totalGb: number;
    freeGb: number;
    healthyDisks: number;
  };
  docker: { active: number };
  security: { blockedToday: number };
  system: { uptimeFormatted: string };
}

interface HardwareTelemetry {
  cpuTemp: number;
  fan: {
    rpm: number;
    pwm: number;
    auto: boolean;
    detected: boolean;
  };
  power: {
    voltage: number;
    current: number;
    power: number;
    detected: boolean;
  };
  disks: DiskHealth[];
}

interface CloudRemoteSummary {
  name: string;
  provider: string;
  isMounted: boolean;
  mountPath: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hardware, setHardware] = useState<HardwareTelemetry | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [remotes, setRemotes] = useState<CloudRemoteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let statsSocket: Socket | null = null;
    const fetchData = async () => {
      try {
        const [hwResponse, containersRes, remotesRes] = await Promise.all([
          fetch('/api/hardware/telemetry', { credentials: 'include' }),
          fetch('/api/docker/containers', { credentials: 'include' }),
          fetch('/api/cloud/remotes', { credentials: 'include' }),
        ]);

        const hwData = await hwResponse.json();
        const containersData = await containersRes.json();
        const remotesData = await remotesRes.json();

        if (disposed) return;
        if (hwData.success) setHardware(hwData.data);
        if (containersData.success) setContainers(Array.isArray(containersData.data) ? containersData.data : []);
        if (remotesData.success) setRemotes(Array.isArray(remotesData.data) ? remotesData.data : []);
      } catch (error) {
        if (!disposed) {
          console.error('Error fetching dashboard data:', getErrorMessage(error, 'Unknown error'));
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    const interval = setInterval(() => {
      void fetchData();
    }, 5000);
    statsSocket = io('/monitor', {
      withCredentials: true,
    });
    statsSocket.emit('system:stats:subscribe');
    statsSocket.on('system:stats:data', (payload: DashboardStats) => {
      if (!disposed) {
        setStats(payload);
        setLoading(false);
      }
    });
    statsSocket.on('system:stats:error', (message: string) => {
      if (!disposed) {
        console.error('Error fetching dashboard socket stats:', message);
      }
    });
    const handleContainersChanged = () => {
      void fetchData();
    };
    window.addEventListener(CONTAINERS_CHANGED_EVENT, handleContainersChanged);
    return () => {
      disposed = true;
      clearInterval(interval);
      statsSocket?.emit('system:stats:unsubscribe');
      statsSocket?.disconnect();
      window.removeEventListener(CONTAINERS_CHANGED_EVENT, handleContainersChanged);
    };
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

  const hardwareDisks = Array.isArray(hardware.disks) ? hardware.disks : [];
  const safeContainers = Array.isArray(containers) ? containers : [];
  const healthyDisks = stats.storage.healthyDisks || hardwareDisks.filter((disk) => disk.status === 'PASSED' || disk.status === 'OK').length;

  return (
    <div className="space-y-6 pb-12 md:space-y-8">
      <SummaryRow
        activeContainers={stats.docker.active}
        smartHealthy={healthyDisks}
        blockedIps={stats.security.blockedToday}
        uptime={stats.system.uptimeFormatted}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:col-span-1 lg:rounded-[2.5rem] lg:p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-white">Almacenamiento</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Pool de Datos</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <HardDrive className="w-5 h-5 text-blue-500" />
            </div>
          </div>

          <div className="relative h-56 sm:h-64">
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
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
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

        <div className="rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:col-span-2 lg:rounded-[2.5rem] lg:p-8">
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
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

      <div className="rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:rounded-[2.5rem] lg:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-white">Unidades de Red</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Rclone mounts</p>
          </div>
          <div className="rounded-2xl bg-blue-500/10 p-3">
            <Cloud className="h-5 w-5 text-blue-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {remotes.length === 0 ? (
            <div className="md:col-span-3 rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-slate-400">
              No hay unidades configuradas todavía.
            </div>
          ) : (
            remotes.slice(0, 3).map((remote) => (
              <div key={remote.name} className="rounded-xl border border-gray-700/50 bg-slate-900/60 p-5 backdrop-blur-sm shadow-md transition-all hover:border-blue-500/50 group flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Cloud className={`h-5 w-5 ${remote.isMounted ? 'text-blue-400' : 'text-gray-500'}`} />
                    <div>
                      <p className="text-[13px] font-bold text-white">{remote.name}</p>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{remote.provider}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${remote.isMounted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} title={remote.isMounted ? 'Montada' : 'Desmontada'} />
                </div>
                <p className="text-[11px] text-gray-400 truncate" title={remote.mountPath}>{remote.mountPath}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-8">
          <div className="rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:rounded-[2.5rem] lg:p-8">
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

          <div className="rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:rounded-[2.5rem] lg:p-8">
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

        <div className="rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:col-span-2 lg:rounded-[2.5rem] lg:p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-white">Contenedores Activos</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Docker Engine</p>
            </div>
            <button className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/5 p-3 transition-all hover:bg-blue-500/10 hover:text-blue-500">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {safeContainers.filter((container) => container.state === 'running').slice(0, 4).map((container) => (
              <ContainerCard key={container.id} container={container} />
            ))}
            {safeContainers.length === 0 && (
              <div className="col-span-2 py-12 flex flex-col items-center justify-center text-slate-600">
                <ShoppingBag className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest">No hay contenedores activos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 lg:rounded-[2.5rem] lg:p-8">
        <div className="flex items-center space-x-3 mb-8">
          <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
          <h3 className="text-lg font-black text-white">Estado de Discos</h3>
          <Info className="w-4 h-4 text-slate-600" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {hardwareDisks.map((disk) => (
            <DiskHealthCard key={disk.device} disk={disk} />
          ))}
        </div>
      </div>
    </div>
  );
}
