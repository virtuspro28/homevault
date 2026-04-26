import { useState, useEffect } from 'react';
import type { SystemStats, ApiResponse } from '../types/system';

interface UseSystemStatsResult {
  stats: SystemStats | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para hacer polling cada determinado intervalo al endpoint de estadísticas en tiempo real.
 * Usa fetch y maneja el abort controller para no generar memory leaks en desmontajes.
 */
export function useSystemStats(intervalMs: number = 3000): UseSystemStatsResult {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: number;
    let isMounted = true;
    
    // Función que trae los datos. No envuelve el catch genérico salvo fallos de red críticos.
    const fetchData = async () => {
      try {
        const response = await fetch('/api/system/stats', { credentials: 'include' });
        if (!isMounted) return;
        
        if (response.status === 401) {
          // Si el token expira o cortan red, paramos.
          setError("No autorizado. Redirigiendo a Login...");
          // Como la seguridad está en App.tsx, pronto el estado global echará a este usuario.
          return;
        }

        const json: ApiResponse<SystemStats> = await response.json();
        
        if (!json.success || !json.data) {
          throw new Error(json.error || "Datos corruptos devueltos por el backend.");
        }

        setStats(json.data);
        setError(null);
      } catch (err: unknown) {
        if (isMounted) {
            setError(err instanceof Error ? err.message : "Pérdida de conexión con HomeVault.");
        }
      } finally {
        if (isMounted) {
            setIsLoading(false);
            // Polling en cadena (espera a que acabe la petición actual para iniciar los 3 segundos de nuevo, mas seguro que setInterval)
            timeoutId = window.setTimeout(fetchData, intervalMs);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [intervalMs]);

  return { stats, isLoading, error };
}
