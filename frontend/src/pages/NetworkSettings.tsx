import { useEffect, useState } from 'react';
import { Globe, Server, Save, ShieldCheck, Info } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';

interface NetworkStatus {
  hostname: string;
  isStatic: boolean;
  ip: string;
}

export default function NetworkSettings() {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [hostname, setHostname] = useState('');
  const [isStatic, setIsStatic] = useState(false);
  const [ipConfig, setIpConfig] = useState({ ip: '', gateway: '', dns: '1.1.1.1' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/network/status', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const nextStatus = data.data as NetworkStatus;
        setStatus(nextStatus);
        setHostname(nextStatus.hostname);
        setIsStatic(nextStatus.isStatic);
        setIpConfig((prev) => ({ ...prev, ip: nextStatus.ip }));
      }
    } catch (error) {
      console.error("Error fetching network status:", getErrorMessage(error, 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const saveHostname = async () => {
    setSaving(true);
    try {
      await fetch('/api/network/hostname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hostname })
      });
      alert("Hostname actualizado. Reinicia para aplicar.");
    } catch {
      alert("Error al guardar hostname");
    } finally {
      setSaving(false);
    }
  };

  const saveIP = async () => {
    setSaving(true);
    try {
      const endpoint = isStatic ? '/api/network/ip/static' : '/api/network/ip/dhcp';
      const body = isStatic ? ipConfig : {};

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      alert("Configuración de red actualizada. Reinicia el NAS para aplicar los cambios.");
    } catch {
      alert("Error al guardar configuración de red");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
          <Globe className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Configuración de Red</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión de IP, Hostname y Conectividad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Server className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Identidad del Sistema</h2>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hostname del NAS</label>
            <div className="flex space-x-3">
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
              />
              <button
                onClick={saveHostname}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center shadow-lg shadow-blue-600/20"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </button>
            </div>
            <p className="text-[10px] text-slate-500 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-3 rounded-xl border border-white/5 leading-relaxed">
              Cambiar el hostname afectará a cómo accedes al NAS (ej: http://{`{hostname}`}.local). Requiere reinicio.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Protocolo IP (IPv4)</h2>
            </div>
            <div className="flex items-center p-1 bg-black/40 rounded-xl border border-white/10">
              <button
                onClick={() => setIsStatic(false)}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!isStatic ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
              >
                DHCP
              </button>
              <button
                onClick={() => setIsStatic(true)}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isStatic ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
              >
                Estática
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {!isStatic ? (
              <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl text-center">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-white font-bold mb-1">IP Dinámica Activa</h3>
                <p className="text-xs text-slate-400">Tu router asignará automáticamente la mejor IP disponible para el NAS.</p>
                <p className="text-lg font-black text-emerald-400 mt-4 font-mono">{status?.ip}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Dirección IP</label>
                  <input
                    type="text"
                    value={ipConfig.ip}
                    onChange={(e) => setIpConfig({ ...ipConfig, ip: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-slate-200 font-mono"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Puerta de Enlace</label>
                  <input
                    type="text"
                    value={ipConfig.gateway}
                    onChange={(e) => setIpConfig({ ...ipConfig, gateway: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-slate-200 font-mono"
                    placeholder="192.168.1.1"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">DNS (Primario)</label>
                  <input
                    type="text"
                    value={ipConfig.dns}
                    onChange={(e) => setIpConfig({ ...ipConfig, dns: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-slate-200 font-mono"
                  />
                </div>
              </div>
            )}

            <button
              onClick={saveIP}
              disabled={saving}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-lg shadow-emerald-900/20"
            >
              {saving ? 'Guardando...' : 'Aplicar Configuración de Red'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-3xl flex items-start space-x-4">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Info className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h4 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">Nota sobre conectividad</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Al cambiar a una IP Estática, asegúrate de que la dirección no esté en uso por otro dispositivo.
            Si pierdes el acceso tras reiniciar, verifica la configuración en tu router o reconecta el NAS por cable.
          </p>
        </div>
      </div>
    </div>
  );
}
