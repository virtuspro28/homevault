import { 
  Server, 
  LayoutDashboard, 
  Component, 
  Settings, 
  LogOut, 
  Shield, 
  ShoppingBag, 
  Users, 
  Terminal, 
  Globe, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Activity, 
  Code, 
  FolderLock, 
  History 
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  // Lista de navegación para fácil extensión en futuras fases
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Tienda de Apps', icon: ShoppingBag, path: '/store' },
    { name: 'Nube', icon: Globe, path: '/cloud' },
    { name: 'Aplicaciones', icon: Component, path: '/apps' },
    { name: 'Active Backup', icon: Shield, path: '/backup' },
    { name: 'Usuarios', icon: Users, path: '/users' },
    { name: 'Archivos', icon: HardDrive, path: '/files' },
    { name: 'Recursos Compartidos', icon: FolderLock, path: '/shared-folders' },
    { name: 'Almacenamiento', icon: HardDrive, path: '/storage' },
    { name: 'Pool Almacenamiento', icon: Layers, path: '/storage-pool' },
    { name: 'Terminal SSH', icon: Terminal, path: '/terminal' },
    { name: 'Gestión Energía', icon: Zap, path: '/power' },
    { name: 'Seguridad', icon: Shield, path: '/security' },
    { name: 'Acceso Remoto', icon: ShieldCheck, path: '/remote' },
    { name: 'Monitor Recursos', icon: Activity, path: '/monitor' },
    { name: 'Editor Config', icon: Code, path: '/config-editor' },
    { name: 'Visor de Eventos', icon: History, path: '/events' },
    { name: 'Configuración Red', icon: Globe, path: '/network' },
    { name: 'Ajustes', icon: Settings, path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-slate-900/80 backdrop-blur-md border-r border-slate-800 flex flex-col h-full flex-shrink-0">
      {/* Título y Logo del NAS */}
      <div className="h-20 flex items-center px-6 border-b border-slate-800/50">
        <Server className="w-8 h-8 text-blue-500 mr-3" />
        <h1 className="text-xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
          HomePiNAS
        </h1>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-2xl transition-all duration-300 group relative ${
                isActive
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 mr-3 shrink-0 transition-transform duration-300 ${
                  isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'group-hover:scale-105'
                }`} />
                <span className={`font-bold tracking-tight text-sm ${isActive ? 'text-white' : ''}`}>
                  {item.name}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="activeGlow"
                    className="absolute inset-0 bg-blue-500/5 blur-xl rounded-full"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Panel inferior y boton de salida */}
      <div className="p-4 border-t border-slate-800/50">
        <button
          onClick={onLogout}
          className="flex items-center w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-colors duration-200"
        >
          <LogOut className="w-5 h-5 mr-3 shrink-0" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
