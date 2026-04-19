import React, { useState, useEffect } from 'react';
import { UserPlus, ShieldCheck, Trash2, Key, Users, AlertCircle, Loader2, X, Shield, ShieldQuestion } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
  storageQuota: number;
  storageUsed: number;
  createdAt: string;
}

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ username: '', password: '', role: 'USER', storageQuota: 0 });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, storageQuota: Number(formData.storageQuota) * 1024 * 1024 * 1024 }), // Convert GB to Bytes
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setFormData({ username: '', password: '', role: 'USER', storageQuota: 0 });
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error en la creación del usuario');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${user.username}?`)) return;
    
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error al eliminar usuario');
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPass = prompt('Introduce la nueva contraseña para este usuario:');
    if (!newPass) return;
    
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPass }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Contraseña actualizada con éxito');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error al restablecer contraseña');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return <ShieldCheck className="w-4 h-4 text-rose-500" />;
      case 'USER': return <Shield className="w-4 h-4 text-blue-500" />;
      default: return <ShieldQuestion className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatQuota = (bytes: number) => {
    if (bytes === 0) return 'Ilimitado';
    if (bytes > 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getUsagePercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.min(Math.round((used / total) * 100), 100);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <Users className="w-8 h-8 mr-3 text-blue-500" />
            Gestión de Usuarios
          </h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Controla quién tiene acceso a tu HomePiNAS y define sus niveles de privilegios y cuotas de disco.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 whitespace-nowrap"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Nuevo Usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center space-x-3 text-red-400 font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Cargando lista de usuarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Usuario</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Permisos</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Cuota de Disco</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Creado el</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 font-bold uppercase transition-colors group-hover:bg-blue-500/10 group-hover:text-blue-400 group-hover:border-blue-500/30">
                          {user.username.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-200">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2 bg-slate-800/50 border border-slate-700/50 px-3 py-1 rounded-full w-fit">
                        {getRoleIcon(user.role)}
                        <span className="text-xs font-bold text-slate-300">{user.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 flex items-center">
                            <HardDrive className="w-3 h-3 mr-1" />
                            {formatQuota(user.storageUsed)} / {formatQuota(user.storageQuota)}
                          </span>
                          <span className={`${getUsagePercentage(user.storageUsed, user.storageQuota) > 90 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {getUsagePercentage(user.storageUsed, user.storageQuota)}%
                          </span>
                        </div>
                        {user.storageQuota > 0 && (
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${getUsagePercentage(user.storageUsed, user.storageQuota)}%` }}
                              className={`h-full transition-all ${
                                getUsagePercentage(user.storageUsed, user.storageQuota) > 90 ? 'bg-rose-500' : 'bg-blue-500'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                          title="Restablecer Contraseña"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Eliminar Usuario"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !actionLoading && setIsModalOpen(false)}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-8 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center uppercase tracking-tight">
              Añadir Usuario
            </h2>
            <p className="text-slate-400 mb-8 text-sm">
              Crea una nueva cuenta de acceso para el dashboard.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de Usuario</label>
                <input
                  type="text"
                  required
                  placeholder="ej: juan.perez"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Rol</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Cuota (GB)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = ilimitado"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={formData.storageQuota}
                    onChange={(e) => setFormData({ ...formData, storageQuota: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-4 flex items-center justify-center px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Crear Usuario Oficial'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
