import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Globe,
  Loader2,
  Plus,
  QrCode,
  Shield,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VpnStatus {
  mode: 'mock' | 'linux';
  enabled: boolean;
  installed: boolean;
  interfaceName: string;
  endpoint: string;
  publicKey: string | null;
  clientCount: number;
  configPath: string;
}

interface VpnClient {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

interface ProxyDomain {
  id: string;
  domain: string;
  targetPort: number;
  sslEnabled: boolean;
}

export default function RemoteAccess() {
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [clients, setClients] = useState<VpnClient[]>([]);
  const [domains, setDomains] = useState<ProxyDomain[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [domainForm, setDomainForm] = useState({ domain: '', targetPort: '8080' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrClientId, setQrClientId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, clientsRes, domainsRes] = await Promise.all([
        fetch('/api/vpn/status', { credentials: 'include' }),
        fetch('/api/vpn/clients', { credentials: 'include' }),
        fetch('/api/proxy/domains', { credentials: 'include' }),
      ]);

      const [statusJson, clientsJson, domainsJson] = await Promise.all([
        statusRes.json(),
        clientsRes.json(),
        domainsRes.json(),
      ]);

      if (!statusRes.ok || !statusJson.success) throw new Error(statusJson.error || 'No se pudo leer WireGuard');
      if (!clientsRes.ok || !clientsJson.success) throw new Error(clientsJson.error || 'No se pudo leer los clientes VPN');
      if (!domainsRes.ok || !domainsJson.success) throw new Error(domainsJson.error || 'No se pudo leer los dominios proxy');

      setStatus(statusJson.data);
      setClients(clientsJson.data);
      setDomains(domainsJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId('create-client');
    setError(null);
    try {
      const res = await fetch('/api/vpn/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newClientName }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo crear el cliente');
      setShowAddClient(false);
      setNewClientName('');
      setFeedback(`Cliente ${json.data.name} creado correctamente`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBusyId(null);
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!window.confirm('Se eliminará el cliente WireGuard y su acceso quedará revocado.')) return;
    setBusyId(clientId);
    setError(null);
    try {
      const res = await fetch(`/api/vpn/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo eliminar el cliente');
      setFeedback('Cliente eliminado');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBusyId(null);
    }
  };

  const showQr = async (clientId: string) => {
    setBusyId(clientId);
    setError(null);
    try {
      const res = await fetch(`/api/vpn/clients/${clientId}/qr`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo generar el QR');
      setQrClientId(clientId);
      setQrData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBusyId(null);
    }
  };

  const downloadConfig = (clientId: string) => {
    window.open(`/api/vpn/clients/${clientId}/download`, '_blank', 'noopener,noreferrer');
  };

  const copyEndpoint = async () => {
    if (!status?.endpoint) return;
    await navigator.clipboard.writeText(status.endpoint);
    setFeedback('Endpoint copiado al portapapeles');
  };

  const createDomain = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId('create-domain');
    setError(null);
    try {
      const res = await fetch('/api/proxy/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain: domainForm.domain, targetPort: Number(domainForm.targetPort) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo crear el dominio');
      setShowAddDomain(false);
      setDomainForm({ domain: '', targetPort: '8080' });
      setFeedback('Dominio proxy creado');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBusyId(null);
    }
  };

  const issueSsl = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/domains/${id}/ssl`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo emitir el certificado');
      setFeedback('Certificado SSL emitido');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBusyId(null);
    }
  };

  const deleteDomain = async (id: string) => {
    if (!window.confirm('Se eliminará el dominio proxy y su configuración SSL asociada.')) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/domains/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo eliminar el dominio');
      setFeedback('Dominio eliminado');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <Globe className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Acceso Remoto</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">WireGuard + Proxy inverso + SSL</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowAddClient(true)}
            className="flex items-center space-x-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Cliente VPN</span>
          </button>
          <button
            onClick={() => setShowAddDomain(true)}
            className="flex items-center space-x-2 px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black transition-all border border-white/10"
          >
            <Shield className="w-5 h-5" />
            <span>Nuevo Proxy</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {feedback && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{feedback}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <section className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-blue-400" />
                  WireGuard
                </h2>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${status?.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
                  {status?.enabled ? 'Activo' : 'Pendiente'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Interface</p>
                  <p className="text-white font-black">{status?.interfaceName}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Clientes</p>
                  <p className="text-white font-black">{status?.clientCount ?? 0}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 md:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Endpoint</p>
                      <p className="text-white font-black break-all">{status?.endpoint || 'Sin resolver'}</p>
                    </div>
                    <button onClick={copyEndpoint} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {!status?.installed && (
                <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-100 text-sm font-medium">
                  WireGuard no parece instalado en este entorno. En Linux real necesitas `wireguard` y `wireguard-tools`.
                </div>
              )}

              <div className="space-y-4 mt-8">
                {clients.map((client) => {
                  const isBusy = busyId === client.id;
                  return (
                    <div key={client.id} className="bg-slate-950/50 border border-white/5 p-5 rounded-[2rem]">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                          <p className="text-white font-black">{client.name}</p>
                          <p className="text-xs text-slate-400 font-mono mt-1">{client.address}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => showQr(client.id)}
                            disabled={isBusy}
                            className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20 text-sm font-bold flex items-center gap-2"
                          >
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                            QR
                          </button>
                          <button
                            onClick={() => downloadConfig(client.id)}
                            className="px-4 py-2 rounded-xl bg-white/5 text-slate-200 border border-white/10 text-sm font-bold flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            .conf
                          </button>
                          <button
                            onClick={() => deleteClient(client.id)}
                            disabled={isBusy}
                            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm font-bold flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Revocar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {clients.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                    <Wifi className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold">Todavía no hay clientes WireGuard creados</p>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Dominios y Certificados
                </h2>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">{domains.length} configurados</span>
              </div>

              <div className="space-y-4">
                {domains.map((domain) => {
                  const isBusy = busyId === domain.id;
                  return (
                    <div key={domain.id} className="bg-slate-950/50 border border-white/5 p-5 rounded-[2rem] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <p className="text-white font-black">{domain.domain}</p>
                        <p className="text-xs text-slate-400 font-mono mt-1">127.0.0.1:{domain.targetPort}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${domain.sslEnabled ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-200 border-amber-500/20'}`}>
                          {domain.sslEnabled ? 'SSL activo' : 'Sin SSL'}
                        </span>
                        {!domain.sslEnabled && (
                          <button
                            onClick={() => issueSsl(domain.id)}
                            disabled={isBusy}
                            className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20 text-sm font-bold"
                          >
                            {isBusy ? 'Emitiendo...' : 'Emitir SSL'}
                          </button>
                        )}
                        <button
                          onClick={() => deleteDomain(domain.id)}
                          disabled={isBusy}
                          className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm font-bold"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}

                {domains.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                    <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold">No hay dominios proxy registrados todavía</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Estado del servicio</h3>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-xs font-bold text-slate-400 uppercase">Modo</span>
                  <span className="text-xs font-black text-white">{status?.mode === 'linux' ? 'Linux real' : 'Desarrollo mock'}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-xs font-bold text-slate-400 uppercase">Config</span>
                  <span className="text-xs font-black text-white break-all text-right">{status?.configPath}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-xs font-bold text-slate-400 uppercase">Clave pública</span>
                  <span className="text-xs font-black text-white text-right max-w-[11rem] break-all">{status?.publicKey || 'No disponible'}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem]">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Siguiente paso operativo</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Si el servicio aparece como pendiente, prepara `wg0.conf`, exporta la clave pública del servidor y define `WG_ENDPOINT` para que los perfiles descargados salgan listos para móvil y escritorio.
              </p>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAddClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddClient(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={createClient}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-white">Nuevo cliente WireGuard</h2>
                <button type="button" onClick={() => setShowAddClient(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Nombre del dispositivo</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(event) => setNewClientName(event.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="iphone-alex o portatil-salon"
                  required
                />
              </div>
              <button disabled={busyId === 'create-client'} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all">
                {busyId === 'create-client' ? 'Creando...' : 'Crear cliente'}
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddDomain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddDomain(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={createDomain}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-white">Nuevo proxy inverso</h2>
                <button type="button" onClick={() => setShowAddDomain(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Dominio</label>
                <input
                  type="text"
                  value={domainForm.domain}
                  onChange={(event) => setDomainForm((current) => ({ ...current, domain: event.target.value }))}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="nas.tudominio.com"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Puerto destino</label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={domainForm.targetPort}
                  onChange={(event) => setDomainForm((current) => ({ ...current, targetPort: event.target.value }))}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button disabled={busyId === 'create-domain'} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all">
                {busyId === 'create-domain' ? 'Guardando...' : 'Crear proxy'}
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {qrClientId && qrData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setQrClientId(null); setQrData(null); }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white">QR del cliente</h2>
                <button onClick={() => { setQrClientId(null); setQrData(null); }} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <img src={qrData} alt="QR WireGuard" className="w-full rounded-2xl bg-white p-4" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
