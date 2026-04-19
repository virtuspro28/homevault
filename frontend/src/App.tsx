// frontend/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
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



function App() {
  const { isAuthenticated, isInitialized, setAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Ruta de Configuración Inicial */}
      <Route 
        path="/setup" 
        element={
          !isInitialized ? (
            <Setup />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Ruta de Login */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : !isInitialized ? (
            <Navigate to="/setup" replace />
          ) : (
            <Login onAuthSuccess={() => setAuthenticated(true)} />
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

