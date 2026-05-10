import { useEffect, useState } from 'react';
import { AlertCircle, Database, Layers, RefreshCw, Shield, ShieldCheck } from 'lucide-react';

interface PoolDisk {
  path: string;
  role: 'data' | 'parity' | 'content' | 'mount';
}

interface PoolInfo {
  name: string;
  type: 'MergerFS' | 'SnapRAID' | 'Standalone';
  size: string;
  used: string;
  free: string;
  usage: number;
  mountPoint: string;
  healthy: boolean;
  disks: PoolDisk[];
}

interface PoolStatus {
  status: string;
  progress: number;
  lastSync?: string | null;
  lastScrub?: string | null;
  updatedAt?: string;
}

export default function StoragePool() {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState<'sync' | 'scrub' | 'save' | null>(null);
  const [form, setForm] = useState({
    disks: '/mnt/disk1\n/mnt/disk2',
    parityDisk: '/mnt/parity1',
    mountPoint: '/mnt/storage',
  });

  const loadStorage = async () => {
    setLoading(true);
    setError(null);
    try {
      const [poolsRes, statusRes] = await Promise.all([
        fetch('/api/storage/pools', { credentials: 'include' }),
        fetch('/api/storage/pool/status', { credentials: 'include' }),
      ]);

      const [poolsJson, statusJson] = await Promise.all([poolsRes.json(), statusRes.json()]);
      if (!poolsRes.ok || !poolsJson.success) throw new Error(poolsJson.error || 'No se pudo cargar los pools');
      if (!statusRes.ok || !statusJson.success) throw new Error(statusJson.error || 'No se pudo cargar el estado del pool');

      setPools(poolsJson.data);
      setPoolStatus(statusJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStorage();
  }, []);

  useEffect(() => {
    if (!poolStatus || (poolStatus.status !== 'syncing' && poolStatus.status !== 'scrubbing')) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStorage();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [poolStatus?.status]);

  const createPool = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActiveAction('save');
    setError(null);
    try {
      const res = await fetch('/api/storage/pool/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          disks: form.disks.split('\n').map((entry) => entry.trim()).filter(Boolean),
          parityDisk: form.parityDisk.trim() || undefined,
          mountPoint: form.mountPoint.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo crear el pool');
      await loadStorage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
      setActiveAction(null);
    }
  };

  const syncPool = async () => {
    setSaving(true);
    setActiveAction('sync');
    setError(null);
    try {
      const res = await fetch('/api/storage/pool/sync', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo lanzar la sincronizacion');
      await loadStorage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
      setActiveAction(null);
    }
  };

  const scrubPool = async () => {
    setSaving(true);
    setActiveAction('scrub');
    setError(null);
    try {
      const res = await fetch('/api/storage/pool/scrub', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo lanzar el scrub');
      await loadStorage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
      setActiveAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-indigo-500/10 rounded-2xl">
            <Database className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Pool de Almacenamiento</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">MergerFS + SnapRAID</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void loadStorage()}
            className="px-5 py-3 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10"
          >
            Refrescar
          </button>
          <button
            onClick={() => void syncPool()}
            disabled={saving}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-60"
          >
            {activeAction === 'sync' ? 'Lanzando sync...' : 'Sync SnapRAID'}
          </button>
          <button
            onClick={() => void scrubPool()}
            disabled={saving}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-60"
          >
            {activeAction === 'scrub' ? 'Lanzando scrub...' : 'Scrub SnapRAID'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-start gap-3 text-red-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8">
        <div className="space-y-8">
          {pools.map((pool) => (
            <div key={pool.name} className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center space-x-4">
                  <div className="p-4 bg-blue-500/10 rounded-2xl">
                    <Layers className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{pool.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{pool.type} - {pool.disks.length} rutas</p>
                  </div>
                </div>
                <div className={`flex items-center space-x-3 px-4 py-2 rounded-full border ${pool.healthy ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                  {pool.healthy ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                  <span className={`text-xs font-black uppercase ${pool.healthy ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {pool.healthy ? 'Saludable' : 'Revisar'}
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Capacidad usada</span>
                    <span className="text-xs font-black text-white">{pool.usage}%</span>
                  </div>
                  <div className="h-3 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" style={{ width: `${pool.usage}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Mountpoint</p>
                    <p className="text-sm font-black text-white break-all">{pool.mountPoint}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-sm font-black text-white">{pool.size}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Usado</p>
                    <p className="text-sm font-black text-white">{pool.used}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Libre</p>
                    <p className="text-sm font-black text-blue-400">{pool.free}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Discos y rutas</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pool.disks.map((disk) => (
                      <div key={`${disk.role}-${disk.path}`} className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                        <p className="text-xs font-black text-white uppercase">{disk.role}</p>
                        <p className="text-xs text-slate-400 font-mono mt-2 break-all">{disk.path}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {pools.length === 0 && (
            <div className="py-20 text-center bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[3rem]">
              <Shield className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
              <p className="text-slate-500 font-bold">No se han detectado pools todavia</p>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Estado de proteccion</h2>
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Estado</p>
                <p className="text-white font-black">{poolStatus?.status || 'idle'}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso</p>
                  <p className="text-xs text-white font-black">{poolStatus?.progress ?? 0}%</p>
                </div>
                <div className="h-3 bg-slate-950/70 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${poolStatus?.progress ?? 0}%` }} />
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ultima sync</p>
                <p className="text-sm font-black text-white">
                  {poolStatus?.lastSync ? new Date(poolStatus.lastSync).toLocaleString() : 'Sin registros aun'}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ultimo scrub</p>
                <p className="text-sm font-black text-white">
                  {poolStatus?.lastScrub ? new Date(poolStatus.lastScrub).toLocaleString() : 'Sin registros aun'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={createPool} className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Crear o actualizar pool</h2>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Rutas de datos</label>
              <textarea
                value={form.disks}
                onChange={(event) => setForm((current) => ({ ...current, disks: event.target.value }))}
                className="w-full min-h-40 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl border border-white/10 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Disco de paridad</label>
              <input
                type="text"
                value={form.parityDisk}
                onChange={(event) => setForm((current) => ({ ...current, parityDisk: event.target.value }))}
                className="w-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl border border-white/10 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Mountpoint</label>
              <input
                type="text"
                value={form.mountPoint}
                onChange={(event) => setForm((current) => ({ ...current, mountPoint: event.target.value }))}
                className="w-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl border border-white/10 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-60"
            >
              {activeAction === 'save' ? 'Guardando...' : 'Persistir configuracion'}
            </button>
          </form>
        </div>
      </div>

      <div className="p-8 bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem] flex items-start space-x-4">
        <AlertCircle className="w-6 h-6 text-amber-500 mt-1" />
        <p className="text-xs text-slate-400 font-medium leading-relaxed">
          La creacion del pool escribe MergerFS en `fstab` y, si indicas un disco de paridad, genera tambien `snapraid.conf`. Antes de usarlo en produccion conviene revisar permisos y puntos de montaje reales en la Raspberry Pi.
        </p>
      </div>
    </div>
  );
}
