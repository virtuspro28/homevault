import { useState } from 'react';
import { Server, Lock, User, AlertCircle, ShieldAlert } from 'lucide-react';

interface SetupProps {
  onSetupComplete?: () => void;
}

export default function Setup({ onSetupComplete }: SetupProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }


    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Revisa la escritura.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Fallo durante la inicialización');
      }

      onSetupComplete?.();
      window.location.assign('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido de red');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-blue-900/50 p-8 rounded-3xl shadow-[0_0_80px_-15px_rgba(59,130,246,0.2)]">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-blue-500/10 flex items-center justify-center rounded-2xl mb-4 border border-blue-500/20 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent text-center">
            Instalación Principal
          </h2>
          <p className="text-slate-400 text-sm mt-2 text-center">
            Se ha detectado una base de datos nueva. Configure obligatoriamente la cuenta de administración maestra.
          </p>
          <p className="text-slate-500 text-xs mt-2 text-center">
            Usa una contraseña de al menos 4 caracteres.
          </p>

        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in duration-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300 ml-1">Identidad Superior</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400">
                <User className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-400" />
              </div>
              <input
                type="text"
                disabled
                className="block w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500 ml-1">Para el administrador, este nombre de usuario es inmutable.</p>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Contraseña de Cifrado</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400">
                <Lock className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-400" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none text-slate-100 placeholder-slate-600"
                placeholder="Introduzca una clave segura"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300 ml-1">Confirmar Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400">
                <Lock className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-400" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none text-slate-100 placeholder-slate-600"
                placeholder="Repita la clave"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className="w-full relative group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-lg shadow-blue-500/20"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity duration-300"></span>
            <div className="relative bg-slate-950/20 backdrop-blur-sm px-4 py-3.5 rounded-xl flex items-center justify-center transition-all group-hover:bg-transparent">
              <span className="font-semibold text-white relative tracking-wide flex items-center">
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Asegurando Nodo...
                  </>
                ) : (
                  <>
                    <Server className="w-5 h-5 mr-2" />
                    Inicializar HomeVault
                  </>
                )}
              </span>
            </div>
          </button>
        </form>
      </div>
    </div>
  );
}
