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
  History,
  HardDrive
} from 'lucide-react';
import { NavLink } from 'react-router-dom';


interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'App Store', icon: ShoppingBag, path: '/store' },
    { name: 'Explorador', icon: FolderLock, path: '/files' },
    { name: 'Compartidos', icon: HardDrive, path: '/shared-folders' },
    { name: 'Almacenamiento', icon: Layers, path: '/storage-pool' },
    { name: 'Contenedores', icon: Component, path: '/apps' },

    { name: 'Terminal', icon: Terminal, path: '/terminal' },
    { name: 'Red', icon: Globe, path: '/network' },
    { name: 'Acceso Remoto', icon: ShieldCheck, path: '/remote' },
    { name: 'Energía', icon: Zap, path: '/power' },
    { name: 'Seguridad', icon: Shield, path: '/security' },
    { name: 'Backups', icon: Code, path: '/backup' },

    { name: 'Respaldos Activos', icon: Activity, path: '/active-backup' },
    { name: 'Eventos', icon: History, path: '/events' },
    { name: 'Usuarios', icon: Users, path: '/users' },
    { name: 'Logs', icon: History, path: '/logs' },
    { name: 'Ajustes', icon: Settings, path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-slate-900/80 backdrop-blur-md border-r border-slate-800 flex flex-col h-full flex-shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-black text-white flex items-center space-x-2">
          <Server className="w-6 h-6 text-blue-500" />
          <span>HomeVault</span>
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto px-4 space-y-1 py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-bold text-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
