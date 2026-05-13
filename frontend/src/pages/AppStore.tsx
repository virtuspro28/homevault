import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  CheckCircle2,
  Cpu,
  Database,
  X,
  Globe,
  Package,
  Pencil,
  Trash2,
  Server,
  Shield,
  ShieldCheck,
  Play,
  Tv,
  Download,
  Radio,
  Image,
  Film,
  Home,
  Workflow,
  Lock,
  Boxes,
  BarChart3,
  GitBranch,
  FileText,
  RefreshCw,
  Cloud,
  Music,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getErrorMessage } from '../lib/errors';
import { CONTAINERS_CHANGED_EVENT } from '../lib/containerEvents';
import { resolveAppIconAsset } from '../lib/appIcons';

type Protocol = 'tcp' | 'udp';

interface PortMapping {
  host: string;
  container: string;
  protocol?: Protocol;
  label?: string;
}

interface VolumeMapping {
  host: string;
  container: string;
  label?: string;
}

interface EnvVar {
  key: string;
  value: string;
  label?: string;
}

interface StoreApp {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  image?: string;
  category?: string;
  source?: 'local' | 'custom';
  developer?: string;
  isInstalled?: boolean;
  defaultConfig?: {
    ports: PortMapping[];
    volumes: VolumeMapping[];
    env: EnvVar[];
    networkMode?: string;
    privileged?: boolean;
  };
  ports?: PortMapping[];
  volumes?: VolumeMapping[];
  env?: EnvVar[];
  networkMode?: string;
  privileged?: boolean;
}

interface AppFormState {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  developer: string;
  icon: string;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  env: EnvVar[];
  networkMode: string;
  privileged: boolean;
}

const EMPTY_PORT: PortMapping = { host: '', container: '', protocol: 'tcp', label: 'Web UI' };
const EMPTY_VOLUME: VolumeMapping = { host: '', container: '/config', label: 'Config' };
const EMPTY_ENV: EnvVar = { key: 'TZ', value: 'Europe/Madrid', label: 'Timezone' };

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Shield,
  ShieldCheck,
  Play,
  Tv,
  Download,
  Radio,
  Image,
  Film,
  Home,
  Workflow,
  Lock,
  Boxes,
  BarChart3,
  Database,
  GitBranch,
  FileText,
  Globe,
  RefreshCw,
  Cloud,
  Search,
  Music,
  Package,
  Server,
  Cpu,
};

function AppIcon({ app }: { app: StoreApp }) {
  const [imageFailed, setImageFailed] = useState(false);
  const icon = resolveAppIconAsset(app.id, app.name, app.icon) ?? app.icon ?? '';
  const normalizedIcon = icon.startsWith('assets/') ? `/${icon}` : icon;
  const isImageIcon =
    normalizedIcon.startsWith('http://') ||
    normalizedIcon.startsWith('https://') ||
    normalizedIcon.startsWith('/assets/') ||
    normalizedIcon.startsWith('data:image/');

  if (isImageIcon && !imageFailed) {
    return (
      <img
        src={normalizedIcon}
        alt={app.name ?? 'App icon'}
        className="w-8 h-8 rounded-xl object-cover"
        onError={() => {
          setImageFailed(true);
        }}
      />
    );
  }

  const IconComponent = LUCIDE_ICON_MAP[normalizedIcon];
  if (IconComponent) {
    return <IconComponent className="w-6 h-6 text-blue-400" />;
  }

  return <Database className="w-6 h-6 text-blue-400" />;
}

function normalizeStoreApps(value: unknown): StoreApp[] {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Record<string, unknown>)
      : [];

  return candidates
    .filter((item): item is Partial<StoreApp> => Boolean(item) && typeof item === 'object')
    .map((item, index) => {
      const app = item as Partial<StoreApp>;
      return {
        id: String(app.id ?? `app-${index}`),
        name: String(app.name ?? 'App sin nombre'),
        description: String(app.description ?? ''),
        icon: typeof app.icon === 'string' ? app.icon : 'Package',
        image: typeof app.image === 'string' ? app.image : '',
        category: String(app.category ?? 'General'),
        source: app.source === 'custom' ? 'custom' : 'local',
        developer: typeof app.developer === 'string' ? app.developer : '',
        isInstalled: Boolean(app.isInstalled),
        defaultConfig: app.defaultConfig,
        ports: Array.isArray(app.ports) ? app.ports : [],
        volumes: Array.isArray(app.volumes) ? app.volumes : [],
        env: Array.isArray(app.env) ? app.env : [],
        networkMode: typeof app.networkMode === 'string' ? app.networkMode : '',
        privileged: Boolean(app.privileged),
      };
    });
}

function toFormState(app?: StoreApp): AppFormState {
  const preset = app?.defaultConfig ?? app;

  return {
    id: app?.id ?? '',
    name: app?.name ?? '',
    description: app?.description ?? '',
    image: app?.image ?? '',
    category: app?.category ?? 'General',
    developer: app?.developer ?? '',
    icon: app?.icon ?? 'Package',
    ports: preset?.ports?.length ? preset.ports.map((port) => ({ ...port, protocol: port.protocol ?? 'tcp' })) : [{ ...EMPTY_PORT }],
    volumes: preset?.volumes?.length ? preset.volumes.map((volume) => ({ ...volume })) : [{ ...EMPTY_VOLUME }],
    env: preset?.env?.length ? preset.env.map((item) => ({ ...item })) : [{ ...EMPTY_ENV }],
    networkMode: preset?.networkMode ?? app?.networkMode ?? '',
    privileged: Boolean(preset?.privileged ?? app?.privileged),
  };
}

function sanitizeAppPayload(state: AppFormState) {
  return {
    id: state.id.trim(),
    name: state.name.trim(),
    description: state.description.trim(),
    image: state.image.trim(),
    category: state.category.trim(),
    developer: state.developer.trim(),
    icon: state.icon.trim() || 'Package',
    networkMode: state.networkMode.trim(),
    privileged: state.privileged,
    ports: state.ports
      .map((port) => ({
        host: port.host.trim(),
        container: port.container.trim(),
        protocol: port.protocol ?? 'tcp',
        label: port.label?.trim() ?? '',
      }))
      .filter((port) => port.host && port.container),
    volumes: state.volumes
      .map((volume) => ({
        host: volume.host.trim(),
        container: volume.container.trim(),
        label: volume.label?.trim() ?? '',
      }))
      .filter((volume) => volume.host && volume.container),
    env: state.env
      .map((item) => ({
        key: item.key.trim(),
        value: item.value,
        label: item.label?.trim() ?? '',
      }))
      .filter((item) => item.key),
  };
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">{children}</p>;
}

function EmptyStateButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] rounded-xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-300"
    >
      {label}
    </button>
  );
}

export default function AppStore() {
  const [apps, setApps] = useState<StoreApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedApp, setSelectedApp] = useState<StoreApp | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState('');
  const [installForm, setInstallForm] = useState<AppFormState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorForm, setEditorForm] = useState<AppFormState>(toFormState());
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/store/apps', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudieron cargar las apps');
      }
      setApps(normalizeStoreApps(data.data));
      setError(null);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, 'Error cargando apps'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApps();
    const handleContainersChanged = () => {
      void loadApps();
    };
    window.addEventListener(CONTAINERS_CHANGED_EVENT, handleContainersChanged);
    return () => {
      window.removeEventListener(CONTAINERS_CHANGED_EVENT, handleContainersChanged);
    };
  }, [loadApps]);

  useEffect(() => {
    if (!selectedApp) return;
    setInstallForm(toFormState(selectedApp));
    setInstallLog('');
  }, [selectedApp]);

  const filteredApps = useMemo(
    () =>
      apps.filter((app) =>
        [app.name, app.description, app.category, app.developer ?? '']
          .join(' ')
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [apps, filter],
  );

  const customAppsCount = apps.filter((app) => app.source === 'custom').length;

  const updateInstallForm = (updater: (current: AppFormState) => AppFormState) => {
    setInstallForm((current) => (current ? updater(current) : current));
  };

  const updateEditorForm = (updater: (current: AppFormState) => AppFormState) => {
    setEditorForm((current) => updater(current));
  };

  const handleInstall = async () => {
    if (!selectedApp || !installForm) return;

    setInstalling(true);
    setInstallLog(`Iniciando instalación de ${selectedApp.name ?? 'la app seleccionada'}...\n`);
    setError(null);

    try {
      const payload = sanitizeAppPayload(toFormState({ ...selectedApp, ...installForm }));
      const res = await fetch(`/api/store/install/${selectedApp.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      setInstallLog((prev) => `${prev}\nOK ${data.message}`);
      setFeedback(`${selectedApp.name ?? 'La app'} lanzada correctamente`);
      await loadApps();
    } catch (installError) {
      setInstallLog((prev) => `${prev}\nERROR: ${getErrorMessage(installError, 'Error crítico durante la instalación.')}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleSaveCustomApp = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = sanitizeAppPayload(editorForm);
    const isEdit = editorMode === 'edit';
    const url = isEdit ? `/api/store/custom-apps/${payload.id}` : '/api/store/custom-apps';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo guardar la app');
      }
      setEditorOpen(false);
      setFeedback(isEdit ? 'App personalizada actualizada' : 'App personalizada creada');
      await loadApps();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar la app personalizada'));
    }
  };

  const handleDeleteCustomApp = async (app: StoreApp) => {
    if (app.source !== 'custom') return;
    if (!window.confirm(`¿Eliminar la app personalizada ${app.name}?`)) return;

    try {
      const res = await fetch(`/api/store/custom-apps/${app.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo eliminar la app');
      }
      setFeedback('App personalizada eliminada');
      if (selectedApp?.id === app.id) {
        setSelectedApp(null);
      }
      await loadApps();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'No se pudo eliminar la app personalizada'));
    }
  };

  const openCreateEditor = () => {
    setEditorMode('create');
    setEditorForm(toFormState());
    setEditorOpen(true);
  };

  const openEditEditor = (app: StoreApp) => {
    setEditorMode('edit');
    setEditorForm(toFormState(app));
    setEditorOpen(true);
  };

  const renderPortRows = (
    form: AppFormState,
    onChange: (updater: (current: AppFormState) => AppFormState) => void,
  ) => (
    <div className="space-y-3">
      {form.ports.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
          No hay puertos definidos para esta app.
        </div>
      )}
      {form.ports.map((port, index) => (
        <div key={`port-${index}`} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px_44px] gap-3 items-start">
          <input
            value={port.label ?? ''}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                ports: current.ports.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item),
              }))
            }
            placeholder="Etiqueta"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <input
            value={port.host}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                ports: current.ports.map((item, itemIndex) => itemIndex === index ? { ...item, host: event.target.value } : item),
              }))
            }
            placeholder="Puerto host"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <input
            value={port.container}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                ports: current.ports.map((item, itemIndex) => itemIndex === index ? { ...item, container: event.target.value } : item),
              }))
            }
            placeholder="Puerto contenedor"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <select
            value={port.protocol ?? 'tcp'}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                ports: current.ports.map((item, itemIndex) => itemIndex === index ? { ...item, protocol: event.target.value as Protocol } : item),
              }))
            }
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          >
            <option value="tcp">tcp</option>
            <option value="udp">udp</option>
          </select>
          <button
            type="button"
            onClick={() =>
              onChange((current) => ({
                ...current,
                ports: current.ports.filter((_, itemIndex) => itemIndex !== index),
              }))
            }
            className="h-[46px] p-3 rounded-xl bg-red-500/10 text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <EmptyStateButton
        label="Añadir puerto"
        onClick={() =>
          onChange((current) => ({
            ...current,
            ports: [...current.ports, { ...EMPTY_PORT, label: '' }],
          }))
        }
      />
    </div>
  );

  const renderVolumeRows = (
    form: AppFormState,
    onChange: (updater: (current: AppFormState) => AppFormState) => void,
  ) => (
    <div className="space-y-3">
      {form.volumes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
          No hay volúmenes definidos para esta app.
        </div>
      )}
      {form.volumes.map((volume, index) => (
        <div key={`volume-${index}`} className="grid grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 items-start">
          <input
            value={volume.label ?? ''}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                volumes: current.volumes.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item),
              }))
            }
            placeholder="Etiqueta"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <input
            value={volume.host}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                volumes: current.volumes.map((item, itemIndex) => itemIndex === index ? { ...item, host: event.target.value } : item),
              }))
            }
            placeholder="/ruta/host"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <input
            value={volume.container}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                volumes: current.volumes.map((item, itemIndex) => itemIndex === index ? { ...item, container: event.target.value } : item),
              }))
            }
            placeholder="/ruta/contenedor"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <button
            type="button"
            onClick={() =>
              onChange((current) => ({
                ...current,
                volumes: current.volumes.filter((_, itemIndex) => itemIndex !== index),
              }))
            }
            className="h-[46px] p-3 rounded-xl bg-red-500/10 text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <EmptyStateButton
        label="Añadir volumen"
        onClick={() =>
          onChange((current) => ({
            ...current,
            volumes: [...current.volumes, { ...EMPTY_VOLUME, label: '' }],
          }))
        }
      />
    </div>
  );

  const renderEnvRows = (
    form: AppFormState,
    onChange: (updater: (current: AppFormState) => AppFormState) => void,
  ) => (
    <div className="space-y-3">
      {form.env.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
          No hay variables definidas para esta app.
        </div>
      )}
      {form.env.map((envItem, index) => (
        <div key={`env-${index}`} className="grid grid-cols-1 xl:grid-cols-[180px_180px_minmax(0,1fr)_44px] gap-3 items-start">
          <input
            value={envItem.label ?? ''}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                env: current.env.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item),
              }))
            }
            placeholder="Etiqueta"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <input
            value={envItem.key}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                env: current.env.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item),
              }))
            }
            placeholder="Clave"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <input
            value={envItem.value}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                env: current.env.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item),
              }))
            }
            placeholder="Valor"
            className="min-w-0 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />
          <button
            type="button"
            onClick={() =>
              onChange((current) => ({
                ...current,
                env: current.env.filter((_, itemIndex) => itemIndex !== index),
              }))
            }
            className="h-[46px] p-3 rounded-xl bg-red-500/10 text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <EmptyStateButton
        label="Añadir variable"
        onClick={() =>
          onChange((current) => ({
            ...current,
            env: [...current.env, { ...EMPTY_ENV, key: '', value: '', label: '' }],
          }))
        }
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 md:space-y-8">
      <div className="flex flex-col items-start gap-4 rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 xl:flex-row xl:items-center xl:justify-between lg:rounded-[2.5rem] lg:p-8">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <ShoppingBag className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">App Store</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
              Catálogo instalable y editable
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {apps.length} apps disponibles. {customAppsCount} personalizadas.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar apps, categorías o imagen..."
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <button
            onClick={openCreateEditor}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white transition-all hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            Nueva app
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[2rem] border border-red-500/20 bg-red-500/10 px-6 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 px-6 py-4 text-sm text-emerald-200">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {filteredApps.map((app) => (
          <motion.div
            key={app.id}
            whileHover={{ y: -5 }}
            className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] group hover:border-blue-500/30 transition-all cursor-pointer"
            onClick={() => {
              setSelectedApp(app);
              setInstallLog('');
            }}
          >
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 group-hover:border-blue-500/50 transition-colors min-w-[64px] min-h-[64px] flex items-center justify-center">
                <AppIcon app={app} />
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {app.category}
                </span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${app.isInstalled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                  {app.isInstalled ? 'Instalada' : 'No instalada'}
                </span>
              </div>
            </div>

            <h3 className="text-lg font-black text-white mb-2">{app.name}</h3>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 min-h-[54px] font-bold">
              {app.description}
            </p>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {app.source === 'custom' ? <Package className="w-3 h-3 text-amber-500" /> : <Globe className="w-3 h-3 text-slate-600" />}
                <span className="text-[10px] font-black text-slate-600 uppercase">
                  {app.source === 'custom' ? 'Personalizada' : 'Catálogo HomeVault'}
                </span>
              </div>
              {app.source === 'custom' && (
                <div className="flex gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditEditor(app);
                    }}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 p-2 text-slate-300 hover:bg-white/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteCustomApp(app);
                    }}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedApp && installForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !installing && setSelectedApp(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative h-[100dvh] w-full max-w-6xl overflow-x-hidden overflow-y-auto border border-white/10 bg-slate-900 p-4 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[2.5rem] sm:p-6 md:p-8"
            >
              <div className="flex justify-between items-start mb-8 gap-4">
                <div className="flex items-center space-x-4">
                  <div className="p-5 bg-blue-500/10 rounded-2xl min-w-[72px] min-h-[72px] flex items-center justify-center">
                    <AppIcon app={selectedApp} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Instalar {selectedApp.name}</h2>
                    <p className="text-sm text-blue-400 font-bold uppercase tracking-widest mt-1">{selectedApp.image}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/5 p-3 transition-all hover:bg-white/10"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="bg-white/5 p-4 rounded-2xl flex items-center space-x-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">
                      Fuente: {selectedApp.source === 'custom' ? 'App personalizada' : 'Catálogo local de HomeVault'}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Cpu className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">
                      {selectedApp.developer ? `Desarrollador: ${selectedApp.developer}` : 'Compatible con despliegue Docker'}
                    </p>
                  </div>
                </div>

                {selectedApp.defaultConfig && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setInstallForm(toFormState(selectedApp))}
                      className="min-h-[44px] rounded-xl bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300 hover:bg-white/10"
                    >
                      Restaurar preset oficial
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2 2xl:gap-8">
                  <div className="space-y-6">
                    <div>
                      <SectionTitle>Asignación de puertos</SectionTitle>
                      {renderPortRows(installForm, updateInstallForm)}
                    </div>
                    <div>
                      <SectionTitle>Volúmenes</SectionTitle>
                      {renderVolumeRows(installForm, updateInstallForm)}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <SectionTitle>Variables de entorno</SectionTitle>
                      {renderEnvRows(installForm, updateInstallForm)}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div>
                        <SectionTitle>Network mode</SectionTitle>
                        <input
                          value={installForm.networkMode}
                          onChange={(event) => updateInstallForm((current) => ({ ...current, networkMode: event.target.value }))}
                          placeholder="bridge, host..."
                          className="w-full min-w-0 bg-white/5 border border-white/10 p-4 rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold text-slate-300">
                          <input
                            type="checkbox"
                            checked={installForm.privileged}
                            onChange={(event) => updateInstallForm((current) => ({ ...current, privileged: event.target.checked }))}
                          />
                          Ejecutar como `privileged`
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <Server className="w-4 h-4 text-blue-400" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Resumen</p>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{selectedApp.description}</p>
                    </div>
                  </div>
                </div>

                {(installing || installLog) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-widest">
                        {installing ? 'Desplegando contenedor...' : 'Resultado de la instalación'}
                      </span>
                    </div>
                    <pre className="p-6 bg-slate-950 rounded-2xl text-[10px] font-mono text-emerald-400 h-56 overflow-y-auto leading-relaxed border border-white/5">
                      {installLog}
                    </pre>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-4">
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="flex min-h-[48px] w-full items-center justify-center space-x-3 rounded-2xl bg-slate-800 px-8 py-4 font-black text-white transition-all hover:bg-slate-700"
                  >
                    <span>Cancelar</span>
                  </button>
                  <button
                    onClick={() => void handleInstall()}
                    disabled={installing}
                    className="flex min-h-[48px] w-full items-center justify-center space-x-3 rounded-2xl bg-blue-600 px-8 py-4 font-black text-white transition-all hover:bg-blue-500 disabled:opacity-60"
                  >
                    <Plus className="w-5 h-5" />
                    <span>{installing ? 'Instalando...' : 'Instalar'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditorOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onSubmit={handleSaveCustomApp}
              className="relative h-[100dvh] w-full max-w-5xl overflow-y-auto border border-white/10 bg-slate-900 p-4 shadow-2xl space-y-8 sm:h-auto sm:max-h-[92vh] sm:rounded-[2.5rem] sm:p-8"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">{editorMode === 'edit' ? 'Editar app personalizada' : 'Nueva app personalizada'}</h2>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Define imagen, puertos, volúmenes y variables para que luego sea instalable desde la tienda.
                  </p>
                </div>
                <button type="button" onClick={() => setEditorOpen(false)} className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/5 p-3 transition-all hover:bg-white/10">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={editorForm.name} onChange={(event) => updateEditorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm" required />
                <input value={editorForm.id} onChange={(event) => updateEditorForm((current) => ({ ...current, id: event.target.value }))} placeholder="ID único" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm" required disabled={editorMode === 'edit'} />
                <input value={editorForm.image} onChange={(event) => updateEditorForm((current) => ({ ...current, image: event.target.value }))} placeholder="Imagen Docker" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm md:col-span-2" required />
                <input value={editorForm.category} onChange={(event) => updateEditorForm((current) => ({ ...current, category: event.target.value }))} placeholder="Categoría" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm" />
                <input value={editorForm.developer} onChange={(event) => updateEditorForm((current) => ({ ...current, developer: event.target.value }))} placeholder="Desarrollador" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm" />
                <input value={editorForm.icon} onChange={(event) => updateEditorForm((current) => ({ ...current, icon: event.target.value }))} placeholder="Icono o URL" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm md:col-span-2" />
                <textarea value={editorForm.description} onChange={(event) => updateEditorForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descripción" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm md:col-span-2 min-h-28" />
              </div>

              <div>
                <SectionTitle>Puertos</SectionTitle>
                {renderPortRows(editorForm, updateEditorForm)}
              </div>

              <div>
                <SectionTitle>Volúmenes</SectionTitle>
                {renderVolumeRows(editorForm, updateEditorForm)}
              </div>

              <div>
                <SectionTitle>Variables de entorno</SectionTitle>
                {renderEnvRows(editorForm, updateEditorForm)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={editorForm.networkMode} onChange={(event) => updateEditorForm((current) => ({ ...current, networkMode: event.target.value }))} placeholder="Network mode opcional" className="bg-white/5 border border-white/10 p-4 rounded-xl text-sm" />
                <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold text-slate-300">
                  <input type="checkbox" checked={editorForm.privileged} onChange={(event) => updateEditorForm((current) => ({ ...current, privileged: event.target.checked }))} />
                  Ejecutar como `privileged`
                </label>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <button type="button" onClick={() => setEditorOpen(false)} className="min-h-[48px] w-full rounded-2xl bg-slate-800 px-6 py-4 font-black text-white hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" className="min-h-[48px] w-full rounded-2xl bg-blue-600 px-6 py-4 font-black text-white hover:bg-blue-500">
                  {editorMode === 'edit' ? 'Guardar cambios' : 'Crear app'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
