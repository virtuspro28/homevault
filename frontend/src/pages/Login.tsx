import { useState } from 'react';
import { Server, Lock, User, AlertCircle } from 'lucide-react';

interface LoginProps {
  onAuthSuccess: (user: { id: string; username: string; role: string }) => void;
}

export default function Login({ onAuthSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Autenticación fallida');
      }

      onAuthSuccess(data.data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No se pudo conectar al servidor');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-500/10 flex items-center justify-center rounded-2xl mb-4 border border-blue-500/20">
            <Server className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            HomePiNAS
          </h2>
          <p className="text-slate-400 text-sm mt-1">Acceso seguro al sistema</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Usuario</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                autoFocus
                className="block w-full pl-10 pr-3 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-100 placeholder-slate-600"
                placeholder="Introduzca su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                className="block w-full pl-10 pr-3 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-100 placeholder-slate-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !username || !password}
            className="w-full relative group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity"></span>
            <div className="relative bg-slate-950/50 backdrop-blur-sm px-4 py-3 rounded-xl flex items-center justify-center transition-all group-hover:bg-slate-900/10">
              <span className="font-semibold text-blue-50 relative">
                {isLoading ? 'Autenticando...' : 'Acceder al NAS'}
              </span>
            </div>
          </button>
        </form>
      </div>
    </div>
  );
}
