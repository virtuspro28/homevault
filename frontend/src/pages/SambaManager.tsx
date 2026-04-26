import React, { useState, useEffect } from 'react';
import { Share2, Plus, Trash2, Folder, Shield, ExternalLink, AlertCircle, CheckCircle2, Loader2, Network } from 'lucide-react';

interface SambaShare {
  name: string;
  path: string;
  browseable: boolean;
  readOnly: boolean;
  guestOk: boolean;
}

export default function SambaManager() {
  const [shares, setShares] = useState<SambaShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newShare, setNewShare] = useState({ name: '', path: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchShares();
  }, []);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/samba/shares', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setShares(data.data);
      } else {
        setError(data.error || 'Error al cargar los recursos compartidos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/samba/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newShare),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setNewShare({ name: '', path: '' });
        fetchShares();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al crear el recurso');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteShare = async (name: string) => {
    if (!confirm(`¿Estás seguro de que deseas dejar de compartir "${name}"?`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/samba/shares/${name}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        fetchShares();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al eliminar el recurso');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <Network className="w-8 h-8 mr-3 text-blue-500" />
            Gestión de Samba (SMB)
          </h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Configura carpetas compartidas en red para acceder a tus archivos desde Windows, macOS o Linux localmente.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Compartido
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start space-x-3 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Shares List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Escaneando configuración de red...</p>
          </div>
        ) : shares.length === 0 ? (
          <div className="col-span-full py-20 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500">
            <Share2 className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">No hay carpetas compartidas configuradas.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-blue-400 hover:underline font-medium"
            >
              Comienza compartiendo tu primera carpeta
            </button>
          </div>
        ) : (
          shares.map((share) => (
            <div 
              key={share.name}
              className="group bg-slate-900/40 backdrop-blur-sm border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button
                  onClick={() => handleDeleteShare(share.name)}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Eliminar compartido"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-start space-x-5">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                  <Folder className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-slate-100 truncate pr-8">
                    {share.name}
                  </h3>
                  <p className="text-sm text-slate-500 font-mono mt-1 truncate">
                    {share.path}
                  </p>
                  
                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1.5" /> Activo
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${share.guestOk ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'}`}>
                      <Shield className="w-3 h-3 mr-1.5" /> {share.guestOk ? 'Público' : 'Auntenticado'}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ExternalLink className="w-3 h-3 mr-1.5" /> \\IP\{share.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !actionLoading && setIsModalOpen(false)}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-8 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
              Compartir Carpeta
            </h2>
            <p className="text-slate-400 mb-8 text-sm">
              Crea un nuevo punto de acceso SMB. Asegúrate de que la ruta existe en el disco duro.
            </p>

            <form onSubmit={handleCreateShare} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre del Recurso</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Peliculas, Trabajo..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  value={newShare.name}
                  onChange={(e) => setNewShare({ ...newShare, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Ruta en Disco</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: /mnt/datos/media"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono text-sm"
                  value={newShare.path}
                  onChange={(e) => setNewShare({ ...newShare, path: e.target.value })}
                />
              </div>

              <div className="flex gap-3 mt-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Compartir Ahora'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
