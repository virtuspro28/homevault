import { LayoutDashboard, ShoppingBag, FolderLock, HardDrive, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const mobileItems = [
  { name: 'Inicio', icon: LayoutDashboard, path: '/' },
  { name: 'Store', icon: ShoppingBag, path: '/store' },
  { name: 'Archivos', icon: FolderLock, path: '/files' },
  { name: 'Red', icon: HardDrive, path: '/cloud' },
  { name: 'Ajustes', icon: Settings, path: '/settings' },
];

export default function MobileTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 rounded-[1.75rem] border border-white/10 bg-white/5 p-1.5 shadow-2xl shadow-black/30">
        {mobileItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex min-h-[60px] flex-col items-center justify-center rounded-2xl px-1 py-2 text-center transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <item.icon className="mb-1 h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-tight">{item.name}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
