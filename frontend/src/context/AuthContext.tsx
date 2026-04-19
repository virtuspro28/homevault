import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContextType, User } from '../types/auth'; // Asumiendo que existen o usando any si no
import { Loader2, ShieldCheck } from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  loading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  setAuthenticated: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      // 1. Verificar si el sistema está inicializado
      const statusRes = await fetch('/api/auth/status');
      const statusData = await statusRes.json();
      setIsInitialized(statusData.initialized);

      if (statusData.initialized) {
        // 2. Verificar sesión activa
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const userData = await meRes.json();
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      console.error('Error al validar la sesión:', error);
      setIsAuthenticated(false);
    } finally {
      // Pequeño delay artificial para suavizar la transición si la respuesta es instantánea
      setTimeout(() => setLoading(false), 800);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  const setAuthenticated = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Decoración de fondo premium */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-2xl">
              <ShieldCheck className="w-10 h-10 text-blue-500" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
          </div>
          
          <h2 className="text-white font-bold text-xl tracking-tight mb-2">HomePiNAS</h2>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] ml-2">
              Verificando Seguridad
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isInitialized, loading, checkAuth, logout, setAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
