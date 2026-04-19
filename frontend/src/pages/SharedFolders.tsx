import { useState, useEffect } from 'react';
import { 
  FolderLock, 
  Plus, 
  Trash2, 
  HardDrive, 
  Network, 
  Shield, 
  Info, 
  CheckCircle2, 
  ToggleLeft, 
  ToggleRight,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Share {
  name: string;
  path: string;
  readOnly: boolean;
  guestOk: boolean;
}

const SharedFolders: React.FC = () => {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [smbEnabled, setSmbEnabled] = useState(true);
  const [nfsEnabled, setNfsEnabled] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newShare, setNewShare] = useState({ name: '', path: '', readOnly: false, type: 'SMB' });

  useEffect(() => {
    fetchShares();
  }, []);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/samba/shares');
      const data = await res.json();
      if (data.success) {
        setShares(data.data);
      }
    } catch (err) {
      console.error('Error fetching shares');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = newShare.type === 'SMB' ? '/api/samba/shares' : '/api/samba/shares/nfs';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShare)
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setNewShare({ name: '', path: '', readOnly: false, type: 'SMB' });
        fetchShares();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error creating share');
    }
  };

  const handleDeleteShare = async (name: string) => {
    if (!confirm(`¿Eliminar el recurso [${name}]?`)) return;
    try {
      const res = await fetch(`/api/samba/shares/${name}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchShares();
    } catch (err) {
      alert('Error deleting share');
    }
  };

  const toggleProtocol = async (protocol: 'smb' | 'nfs', current: boolean) => {
    try {
      const res = await fetch('/api/samba/protocol/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol, enabled: !current })
      });
      const data = await res.json();
      if (data.success) {
        if (protocol === 'smb') setSmbEnabled(!current);
        else setNfsEnabled(!current);
      }
    } catch (err) {
      alert('Error toggling protocol');
    }
  };

  return (
    <div className="p-8 bg-slate-950 min-h-full text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FolderLock className="text-blue-500 w-10 h-10" />
            Carpetas Compartidas
          </h1>
          <p className="text-slate-400 mt-2">Gestiona el acceso a tus archivos desde la red local (SMB/NFS)</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-5 h-5" /> Nueva Carpeta Compartida
          </button>
        </div>
      </div>

      {/* Protocol Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <Network className="text-green-500 w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">Servicio SMB (Samba)</h3>
              <p className="text-xs text-slate-500">Compatible con Windows, macOS y Android</p>
            </div>
          </div>
          <button onClick={() => toggleProtocol('smb', smbEnabled)}>
            {smbEnabled ? <ToggleRight className="w-10 h-10 text-green-500" /> : <ToggleLeft className="w-10 h-10 text-slate-600" />}
          </button>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <HardDrive className="text-purple-500 w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">Servicio NFS</h3>
              <p className="text-xs text-slate-500">Alto rendimiento para servidores Linux</p>
            </div>
          </div>
          <button onClick={() => toggleProtocol('nfs', nfsEnabled)}>
            {nfsEnabled ? <ToggleRight className="w-10 h-10 text-purple-500" /> : <ToggleLeft className="w-10 h-10 text-slate-600" />}
          </button>
        </div>
      </div>

      {/* Shares Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-950/50 border-b border-slate-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre del Recurso</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Ruta Local</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Permisos</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Visibilidad</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-slate-500">Cargando recursos compartidos...</p>
                </td>
              </tr>
            ) : shares.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-slate-600 italic">No hay carpetas compartidas configuradas</td>
              </tr>
            ) : (
              shares.map((share) => (
                <tr key={share.name} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-5 font-bold text-blue-400">{share.name}</td>
                  <td className="px-6 py-5">
                    <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{share.path}</code>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      share.readOnly ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
                    }`}>
                      {share.readOnly ? 'Solo Lectura' : 'Lectura/Escritura'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Shield className={`w-4 h-4 ${share.guestOk ? 'text-green-500' : 'text-slate-600'}`} />
                      {share.guestOk ? 'Público (Invitado)' : 'Protegido'}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => handleDeleteShare(share.name)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Share Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-8 relative shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 italic">
                <FolderOpen className="text-blue-500" /> Nuevo Recurso Compartido
              </h2>
              <form onSubmit={handleCreateShare} className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Protocolo</label>
                  <div className="flex gap-2">
                    {['SMB', 'NFS'].map(t => (
                      <button 
                        key={t}
                        type="button"
                        onClick={() => setNewShare({...newShare, type: t})}
                        className={`flex-1 py-3 rounded-xl border font-bold transition-all ${
                          newShare.type === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {newShare.type === 'SMB' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Nombre del Recurso</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ej: Multimedia"
                      value={newShare.name}
                      onChange={e => setNewShare({...newShare, name: e.target.value})}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Ruta Local (Pool)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="/mnt/storage/movies"
                    value={newShare.path}
                    onChange={e => setNewShare({...newShare, path: e.target.value})}
                    required
                  />
                </div>

                {newShare.type === 'SMB' && (
                  <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-800">
                    <input 
                      type="checkbox" 
                      id="ro"
                      checked={newShare.readOnly}
                      onChange={e => setNewShare({...newShare, readOnly: e.target.checked})}
                      className="w-5 h-5 rounded accent-blue-500"
                    />
                    <label htmlFor="ro" className="text-sm font-medium text-slate-300">Solo lectura (Los clientes no podrán modificar archivos)</label>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                  >
                    Crear Recurso
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SharedFolders;
