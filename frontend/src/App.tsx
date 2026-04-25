// frontend/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'

// Páginas Propias
import Setup from './pages/Setup'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DockerManager from './pages/DockerManager'
import SambaManager from './pages/SambaManager'
import BackupManager from './pages/BackupManager'
import UserManager from './pages/UserManager'
import AppStore from './pages/AppStore'
import Settings from './pages/Settings'
import Logs from './pages/Logs'
import TerminalPage from './pages/TerminalPage'
import NetworkSettings from './pages/NetworkSettings'
import StoragePool from './pages/StoragePool'
import RemoteAccess from './pages/RemoteAccess'
import Security from './pages/Security'
import PowerManager from './pages/PowerManager'
import FileManager from './pages/FileManager'
import ResourceMonitor from './pages/ResourceMonitor'
import ConfigEditor from './pages/ConfigEditor'
import SharedFolders from './pages/SharedFolders'
import Events from './pages/Events'
import CloudManager from './pages/CloudManager'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'

/**
 * Tipo de respuesta del estado de inicialización
 */
interface InitialStatusResponse {
  success: boolean
  initialized: boolean
  userCount?: number
}

/**
 * Hook personalizado para verificar el estado de inicialización del sistema
 */
function useInitialStatus() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const response = await fetch('/api/auth/initial-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: InitialStatusResponse = await response.json()
        
        if (data.success) {
          // initialized = true significa que ya hay usuarios en el sistema
          setIsInitialized(data.initialized)
        } else {
          setError('Error al verificar estado de inicialización')
          // Por defecto, mostrar setup si hay error
          setIsInitialized(false)
        }
      } catch (err) {
        console.error('Error checking initial status:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
        // En caso de error de conexión, asumir que no está inicializado
        setIsInitialized(false)
      } finally {
        setLoading(false)
      }
    }

    checkInitialStatus()
  }, [])

  return { isInitialized, loading, error }
}

function App() {
  const { isAuthenticated, setAuthenticated } = useAuth()
  const { isInitialized, loading, error } = useInitialStatus()

  // Mostrar spinner de carga mientras se verifica el estado
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm font-medium">Verificando estado del sistema...</p>
        </div>
      </div>
    )
  }

  // Error al conectar con el backend
  if (error && isInitialized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">Error de Conexión</h1>
          <p className="text-slate-400 text-sm">
            No se pudo conectar con el servidor. Asegúrate de que el backend esté ejecutándose.
          </p>
          <p className="text-slate-500 text-xs mt-4">Detalle: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Ruta de Configuración Inicial - Solo accesible si NO hay usuarios */}
      <Route 
        path="/setup" 
        element={
          isInitialized === false ? (
            <Setup />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Ruta de Login - Solo accesible si YA hay usuarios */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : isInitialized === true ? (
            <Login onAuthSuccess={() => setAuthenticated({ id: '1', username: 'admin', role: 'admin' })} />
          ) : (
            <Navigate to="/setup" replace />
          )
        } 
      />
      
      {/* RUTAS PROTEGIDAS (Estructura centralizada) */}
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
      
      {/* Autocaptura Root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

