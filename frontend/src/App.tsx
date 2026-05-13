import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { reportClientError } from "./lib/runtimeLog";

const Setup = lazy(() => import("./pages/Setup"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DockerManager = lazy(() => import("./pages/DockerManager"));
const SambaManager = lazy(() => import("./pages/SambaManager"));
const BackupManager = lazy(() => import("./pages/BackupManager"));
const UserManager = lazy(() => import("./pages/UserManager"));
const AppStore = lazy(() => import("./pages/AppStore"));
const Settings = lazy(() => import("./pages/Settings"));
const Logs = lazy(() => import("./pages/Logs"));
const TerminalPage = lazy(() => import("./pages/TerminalPage"));
const NetworkSettings = lazy(() => import("./pages/NetworkSettings"));
const StoragePool = lazy(() => import("./pages/StoragePool"));
const RemoteAccess = lazy(() => import("./pages/RemoteAccess"));
const Security = lazy(() => import("./pages/Security"));
const PowerManager = lazy(() => import("./pages/PowerManager"));
const FileManager = lazy(() => import("./pages/FileManager"));
const ResourceMonitor = lazy(() => import("./pages/ResourceMonitor"));
const ConfigEditor = lazy(() => import("./pages/ConfigEditor"));
const SharedFolders = lazy(() => import("./pages/SharedFolders"));
const Events = lazy(() => import("./pages/Events"));
const CloudManager = lazy(() => import("./pages/CloudManager"));

interface InitialStatusResponse {
  success: boolean;
  initialized: boolean;
  userCount?: number;
}

function FullscreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-b-4 border-t-4 border-blue-500"></div>
        <p className="text-sm font-medium text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function useInitialStatus() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkInitialStatus = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/initial-status", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: InitialStatusResponse = await response.json();

        if (data.success) {
          setIsInitialized(data.initialized);
        } else {
          setError("Error al verificar estado de inicialización");
          setIsInitialized(false);
        }
      } catch (err) {
        reportClientError("initial-status", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
        setIsInitialized(false);
      } finally {
        setLoading(false);
      }
    };

    void checkInitialStatus();
  }, [refreshKey]);

  return {
    isInitialized,
    loading,
    error,
    refresh: () => setRefreshKey((current) => current + 1),
  };
}

function App() {
  const { isAuthenticated, setAuthenticated } = useAuth();
  const { isInitialized, loading, error, refresh } = useInitialStatus();

  if (loading) {
    return <FullscreenLoader label="Verificando estado del sistema..." />;
  }

  if (error && isInitialized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="max-w-md p-8 text-center">
          <div className="mb-4 text-5xl text-red-500">!</div>
          <h1 className="mb-2 text-xl font-bold text-white">Error de Conexión</h1>
          <p className="text-sm text-slate-400">
            No se pudo conectar con el servidor. Asegúrate de que el backend esté ejecutándose.
          </p>
          <p className="mt-4 text-xs text-slate-500">Detalle: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<FullscreenLoader label="Cargando interfaz de HomeVault..." />}>
      <Routes>
        <Route
          path="/setup"
          element={
            isInitialized === false ? (
              <Setup
                onSetupComplete={() => {
                  refresh();
                }}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : isInitialized === true ? (
              <Login
                onAuthSuccess={(user) => {
                  setAuthenticated(user);
                  refresh();
                }}
              />
            ) : (
              <Navigate to="/setup" replace />
            )
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/apps" element={<DockerManager />} />
          <Route path="/samba" element={<SambaManager />} />
          <Route path="/backup" element={<BackupManager />} />
          <Route path="/users" element={<UserManager />} />
          <Route path="/store" element={<AppStore />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/power" element={<PowerManager />} />
          <Route path="/security" element={<Security />} />
          <Route path="/remote" element={<RemoteAccess />} />
          <Route path="/storage-pool" element={<StoragePool />} />
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/network" element={<NetworkSettings />} />
          <Route path="/files" element={<FileManager />} />
          <Route path="/shared-folders" element={<SharedFolders />} />
          <Route path="/events" element={<Events />} />
          <Route path="/monitor" element={<ResourceMonitor />} />
          <Route path="/config-editor" element={<ConfigEditor />} />
          <Route path="/cloud" element={<CloudManager />} />
        </Route>

        <Route path="*" element={<Navigate to={isInitialized ? "/login" : "/setup"} replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
