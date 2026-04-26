import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'

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

interface InitialStatusResponse {
  success: boolean
  initialized: boolean
  userCount?: number
}

function useInitialStatus() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const checkInitialStatus = async () => {
      setLoading(true)
      setError(null)

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
          setIsInitialized(data.initialized)
        } else {
          setError('Error al verificar estado de inicialización')
          setIsInitialized(false)
        }
      } catch (err) {
        console.error('Error checking initial status:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
        setIsInitialized(false)
      } finally {
        setLoading(false)
      }
    }

    checkInitialStatus()
  }, [refreshKey])

  return {
    isInitialized,
    loading,
    error,
    refresh: () => setRefreshKey((current) => current + 1),
  }
}

function App() {
  const { isAuthenticated, setAuthenticated } = useAuth()
  const { isInitialized, loading, error, refresh } = useInitialStatus()

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

  if (error && isInitialized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="text-red-500 text-5xl mb-4">!</div>
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
      <Route
        path="/setup"
        element={
          isInitialized === false ? (
            <Setup
              onSetupComplete={() => {
                refresh()
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
                setAuthenticated(user)
                refresh()
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

      <Route path="*" element={<Navigate to={isInitialized ? '/login' : '/setup'} replace />} />
    </Routes>
  )
}

export default App
