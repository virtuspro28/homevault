import { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  HardDrive,
  Plus,
  Loader2,
  Globe,
  Info,
  Trash2,
  X,
  Pencil,
  PlugZap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getErrorMessage } from "../lib/errors";

type RemoteProvider = "webdav" | "smb" | "ftp" | "sftp" | "drive" | "onedrive";

interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "textarea";
  placeholder?: string;
  required?: boolean;
  help?: string;
}

interface ProviderDefinition {
  id: RemoteProvider;
  label: string;
  description: string;
  fields: ProviderField[];
}

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "webdav",
    label: "WebDAV",
    description: "Ideal para Nextcloud, ownCloud, SharePoint WebDAV y otros servicios compatibles.",
    fields: [
      { key: "url", label: "URL WebDAV", type: "text", required: true, placeholder: "https://cloud.midominio.com/remote.php/dav/files/usuario" },
      { key: "vendor", label: "Vendor", type: "text", placeholder: "nextcloud, owncloud, sharepoint..." },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
      { key: "remotePath", label: "Path", type: "text", placeholder: "Documentos/Media" },
    ],
  },
  {
    id: "smb",
    label: "SMB",
    description: "Conecta recursos compartidos Samba o carpetas Windows montadas a través de Rclone.",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "192.168.1.50" },
      { key: "port", label: "Puerto", type: "number", placeholder: "445" },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
    ],
  },
  {
    id: "sftp",
    label: "SFTP",
    description: "Acceso seguro por SSH a otro NAS o VPS, montando carpetas remotas como si fueran locales.",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "mi-servidor.example.com" },
      { key: "port", label: "Puerto", type: "number", placeholder: "22" },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
    ],
  },
  {
    id: "ftp",
    label: "FTP",
    description: "Montaje de servidores FTP clásicos con soporte de usuario, clave y ruta remota.",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "ftp.midominio.com" },
      { key: "port", label: "Puerto", type: "number", placeholder: "21" },
      { key: "username", label: "Usuario", type: "text", required: true },
      { key: "password", label: "Contraseña", type: "password", required: true },
    ],
  },
  {
    id: "drive",
    label: "Google Drive",
    description: "Usa credenciales OAuth ya generadas: client ID, secret y token JSON de Rclone.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Google OAuth client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Google OAuth client secret" },
      { key: "token", label: "Token JSON", type: "textarea", required: true, placeholder: "{\"access_token\":\"...\"}" },
    ],
  },
  {
    id: "onedrive",
    label: "OneDrive",
    description: "Usa token OAuth de OneDrive/SharePoint generado con Rclone y, si quieres, tus credenciales de app.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Azure app client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Azure app client secret" },
      { key: "token", label: "Token JSON", type: "textarea", required: true, placeholder: "{\"access_token\":\"...\"}" },
    ],
  },
];

interface CloudRemote {
  name: string;
  provider: RemoteProvider;
  isMounted: boolean;
  mountPath: string;
  remotePath?: string;
  summary: string;
  usage?: {
    total: number;
    used: number;
    free: number;
  };
}

interface RemoteProfile {
  name: string;
  provider: RemoteProvider;
  remotePath?: string;
  summary: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  vendor?: string;
  url?: string;
  clientId?: string;
  clientSecret?: string;
  token?: string;
  manualOptions?: Record<string, string>;
}

const EMPTY_FORM: RemoteProfile = {
  name: "",
  provider: "webdav",
  summary: "",
  host: "",
  port: "",
  username: "",
  password: "",
  vendor: "",
  url: "",
  clientId: "",
  clientSecret: "",
  token: "",
  remotePath: "",
  manualOptions: {},
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function buildManualOptionsJson(input: Record<string, string> | undefined): string {
  return input && Object.keys(input).length > 0 ? JSON.stringify(input, null, 2) : "";
}

function normalizeProviders(value: unknown): ProviderDefinition[] {
  const list = Array.isArray(value) ? value : [];
  const providers = list
    .map((provider) => {
      const id = (provider as ProviderDefinition | undefined)?.id;
      return PROVIDER_DEFINITIONS.find((item) => item.id === id);
    })
    .filter((provider): provider is ProviderDefinition => Boolean(provider));

  return providers.length === PROVIDER_DEFINITIONS.length ? providers : PROVIDER_DEFINITIONS;
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(text.startsWith("<") ? fallbackMessage : text || fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export default function CloudManager() {
  const [providers, setProviders] = useState<ProviderDefinition[]>(PROVIDER_DEFINITIONS);
  const [remotes, setRemotes] = useState<CloudRemote[]>([]);
  const [profiles, setProfiles] = useState<RemoteProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<RemoteProfile>(EMPTY_FORM);
  const [selectedProvider, setSelectedProvider] = useState<RemoteProvider>(EMPTY_FORM.provider);
  const [manualOptionsJson, setManualOptionsJson] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider) ?? PROVIDER_DEFINITIONS.find((provider) => provider.id === selectedProvider),
    [providers, selectedProvider],
  );

  const fetchData = async () => {
    try {
      const [providersRes, remotesRes, profilesRes] = await Promise.all([
        fetch("/api/cloud/providers", { credentials: "include" }),
        fetch("/api/cloud/remotes", { credentials: "include" }),
        fetch("/api/cloud/profiles", { credentials: "include" }),
      ]);

      const [providersData, remotesData, profilesData] = await Promise.all([
        parseApiResponse<{ success: boolean; data?: unknown; error?: string }>(providersRes, "La ruta /api/cloud/providers no está devolviendo JSON válido."),
        parseApiResponse<{ success: boolean; data?: unknown; error?: string }>(remotesRes, "La ruta /api/cloud/remotes no está devolviendo JSON válido."),
        parseApiResponse<{ success: boolean; data?: unknown; error?: string }>(profilesRes, "La ruta /api/cloud/profiles no está devolviendo JSON válido."),
      ]);

      setProviders(providersData.success ? normalizeProviders(providersData.data) : PROVIDER_DEFINITIONS);
      setRemotes(remotesData.success ? normalizeArray<CloudRemote>(remotesData.data) : []);
      setProfiles(profilesData.success ? normalizeArray<RemoteProfile>(profilesData.data) : []);

      setError(null);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, "No se pudieron cargar las unidades de red."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      await fetchData();
      if (disposed) {
        return;
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, []);

  const openCreate = () => {
    setEditorMode("create");
    setForm(EMPTY_FORM);
    setSelectedProvider(EMPTY_FORM.provider);
    setManualOptionsJson("");
    setEditorOpen(true);
  };

  const openEdit = (profile: RemoteProfile) => {
    setEditorMode("edit");
    setForm({
      ...EMPTY_FORM,
      ...profile,
      password: "",
      clientSecret: profile.clientSecret ?? "",
      token: profile.token ?? "",
    });
    setSelectedProvider(profile.provider);
    setManualOptionsJson(buildManualOptionsJson(profile.manualOptions));
    setEditorOpen(true);
  };

  const handleProviderSelect = (provider: RemoteProvider) => {
    setSelectedProvider(provider);
    setForm((current) => ({
      ...EMPTY_FORM,
      ...current,
      name: current.name,
      provider,
    }));
  };

  const handleMount = async (remote: CloudRemote) => {
    setActionLoading(remote.name);
    try {
      const method = remote.isMounted ? "DELETE" : "POST";
      const res = await fetch(`/api/cloud/mount/${remote.name}`, { method, credentials: "include" });
      const data = await parseApiResponse<{ success: boolean; error?: string; message?: string }>(
        res,
        "La ruta de montaje de unidades devolvió una respuesta no válida.",
      );
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar el estado del montaje");
      }
      setFeedback(remote.isMounted ? `Unidad ${remote.name} desmontada` : `Unidad ${remote.name} montada`);
      await fetchData();
    } catch (mountError) {
      setError(getErrorMessage(mountError, "No se pudo montar la unidad"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`¿Eliminar la unidad ${name}?`)) {
      return;
    }

    setActionLoading(name);
    try {
      const res = await fetch(`/api/cloud/profiles/${name}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await parseApiResponse<{ success: boolean; error?: string; message?: string }>(
        res,
        "La ruta de borrado de perfiles devolvió una respuesta no válida.",
      );
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar la unidad");
      }
      setFeedback(`Unidad ${name} eliminada`);
      await fetchData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "No se pudo eliminar la unidad"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionLoading(form.name || "save");

    try {
      let manualOptions: Record<string, string> | undefined;
      if (manualOptionsJson.trim()) {
        manualOptions = JSON.parse(manualOptionsJson) as Record<string, string>;
      }

      const payload = {
        ...form,
        manualOptions,
      };

      const endpoint = editorMode === "edit" ? `/api/cloud/profiles/${form.name}` : "/api/cloud/profiles";
      const method = editorMode === "edit" ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse<{ success: boolean; error?: string; data?: unknown }>(
        res,
        "La ruta de guardado de perfiles devolvió una respuesta no válida.",
      );
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar la unidad");
      }

      setFeedback(editorMode === "edit" ? "Unidad actualizada" : "Unidad creada");
      setEditorOpen(false);
      await fetchData();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "No se pudo guardar la unidad"));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 md:space-y-8">
      <div className="flex flex-col gap-6 rounded-[2rem] border border-white/5 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6 xl:flex-row xl:items-center xl:justify-between lg:rounded-[2.5rem] lg:p-8">
        <div className="flex items-center space-x-4">
          <div className="rounded-3xl bg-blue-500/10 p-4">
            <Cloud className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Unidades de Red</h1>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-slate-500">
              WebDAV, SMB, FTP, SFTP, Google Drive y OneDrive vía Rclone
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white transition-all hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Nueva unidad
        </button>
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:gap-6">
        {loading ? (
          [1, 2, 3].map((index) => (
            <div key={index} className="h-72 animate-pulse rounded-[2rem] border border-white/5 bg-slate-900/40" />
          ))
        ) : remotes.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-white/10 bg-slate-900/40 py-20 text-center">
            <Globe className="mb-4 h-16 w-16 text-slate-700" />
            <h3 className="text-xl font-bold text-slate-300">No hay unidades configuradas</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Crea una unidad con credenciales guardadas en HomeVault y podrás montarla o desmontarla desde aquí.
            </p>
          </div>
        ) : (
          remotes.map((remote) => (
            <motion.div
              key={remote.name}
              whileHover={{ y: -4 }}
              className="relative overflow-hidden rounded-xl border border-gray-700/50 bg-slate-900/60 p-6 backdrop-blur-sm shadow-lg group flex flex-col"
            >
              <div className={`absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full blur-[80px] opacity-30 ${remote.isMounted ? "bg-emerald-500" : "bg-blue-500"}`}></div>

              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl border border-gray-700/50 bg-slate-800 p-3 shadow-inner">
                    <HardDrive className={`h-6 w-6 ${remote.isMounted ? "text-emerald-400" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-white">{remote.name}</h3>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400">{remote.provider}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${remote.isMounted ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-800 text-gray-400"}`}>
                  {remote.isMounted ? "Montada" : "Desconectada"}
                </span>
              </div>

              <div className="space-y-3 rounded-xl border border-gray-800 bg-slate-950/40 p-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500">Origen</p>
                  <p className="mt-1 text-[13px] text-gray-300 truncate">{remote.summary}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500">Montaje local</p>
                  <p className="mt-1 text-[13px] text-blue-400 truncate">{remote.mountPath}</p>
                </div>
                {remote.remotePath && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500">Subruta remota</p>
                    <p className="mt-1 text-[13px] text-gray-300 truncate">{remote.remotePath}</p>
                  </div>
                )}
              </div>

              {remote.usage && (
                <div className="mt-5 rounded-xl border border-gray-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-gray-400">
                    <span>Uso detectado</span>
                    <span>{Math.round((remote.usage.used / remote.usage.total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(remote.usage.used / remote.usage.total) * 100}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                    <span>{formatBytes(remote.usage.used)} usados</span>
                    <span>{formatBytes(remote.usage.free)} libres</span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 mt-auto pt-4 border-t border-gray-800">
                <button
                  onClick={() => void handleMount(remote)}
                  disabled={actionLoading === remote.name}
                  className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${remote.isMounted ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-blue-600 text-white hover:bg-blue-500"}`}
                >
                  {actionLoading === remote.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : remote.isMounted ? <PlugZap className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
                  <span>{remote.isMounted ? "Desmontar" : "Montar"}</span>
                </button>
                <button
                  onClick={() => {
                    const profile = profiles.find((item) => item.name === remote.name);
                    if (profile) {
                      openEdit(profile);
                    }
                  }}
                  className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-700 bg-slate-800 p-2 text-gray-300 transition hover:bg-slate-700 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void handleDelete(remote.name)}
                  className="min-h-[44px] min-w-[44px] rounded-lg bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="flex flex-col items-start gap-4 rounded-[2rem] border border-blue-600/20 bg-blue-600/5 p-5 sm:flex-row sm:gap-6 sm:p-6 lg:rounded-[2.5rem] lg:p-8">
        <div className="rounded-3xl bg-blue-600/20 p-4">
          <Info className="h-8 w-8 text-blue-400" />
        </div>
        <div className="space-y-2">
          <h4 className="text-lg font-bold text-white">Cómo funciona</h4>
          <p className="text-sm leading-relaxed text-slate-400">
            HomeVault guarda los perfiles, genera `rclone.conf` y monta cada unidad bajo `/opt/homevault/remote/[nombre]`.
            Para Google Drive y OneDrive el flujo usa token OAuth ya generado con Rclone, porque esos proveedores no aceptan
            un simple usuario y contraseña.
          </p>
        </div>
      </div>

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
              onSubmit={handleSave}
              className="relative h-[100dvh] w-full max-w-4xl overflow-y-auto border border-white/10 bg-slate-900 p-4 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[2.5rem] sm:p-8"
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    {editorMode === "edit" ? "Editar unidad de red" : "Nueva unidad de red"}
                  </h2>
                  <p className="mt-1 text-sm font-bold uppercase tracking-widest text-slate-500">
                    Credenciales guardadas, generación de Rclone y montaje con un clic
                  </p>
                </div>
                <button type="button" onClick={() => setEditorOpen(false)} className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/5 p-3 hover:bg-white/10">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nombre único"
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white"
                  disabled={editorMode === "edit"}
                  required
                />
                <div className="overflow-visible rounded-2xl border border-white/10 bg-slate-950/80 p-3">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de unidad</p>
                  <div className="grid grid-cols-2 gap-2">
                    {providers.map((provider) => {
                      const isActive = provider.id === selectedProvider;
                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => handleProviderSelect(provider.id)}
                          className={`min-h-[44px] rounded-xl border px-3 py-3 text-left text-sm font-bold transition-all ${
                            isActive
                              ? "border-blue-400/40 bg-blue-500/20 text-white shadow-lg shadow-blue-900/20"
                              : "border-white/10 bg-slate-900 text-white hover:border-blue-400/30 hover:bg-slate-800 hover:text-blue-300"
                          }`}
                        >
                          {provider.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {activeProvider && (
                <div className="mt-8 rounded-2xl border border-white/5 bg-slate-950/50 p-5">
                  <p className="text-sm font-black text-white">{activeProvider.label}</p>
                  <p className="mt-2 text-sm text-slate-400">{activeProvider.description}</p>
                </div>
              )}

              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeProvider?.fields.map((field) => {
                  const value = String((form as unknown as Record<string, unknown>)[field.key] ?? "");
                  const isTextArea = field.type === "textarea";
                  const commonProps = {
                    placeholder: field.placeholder,
                    required: field.required,
                    className: "w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white",
                  };

                  return (
                    <div key={field.key} className={isTextArea ? "md:col-span-2" : ""}>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{field.label}</p>
                      {isTextArea ? (
                        <textarea
                          value={value}
                          onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                          {...commonProps}
                          rows={6}
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={value}
                          onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                          {...commonProps}
                        />
                      )}
                      {field.help && <p className="mt-2 text-xs text-slate-500">{field.help}</p>}
                    </div>
                  );
                })}

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Opciones avanzadas JSON</p>
                  <textarea
                    value={manualOptionsJson}
                    onChange={(event) => setManualOptionsJson(event.target.value)}
                    placeholder='{"encoding":"Slash,BackSlash,Del,Ctl,RightSpace,InvalidUtf8,Dot"}'
                    className="min-h-[160px] w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 md:flex-row">
                <button type="button" onClick={() => setEditorOpen(false)} className="min-h-[48px] w-full rounded-2xl bg-slate-800 px-6 py-4 font-black text-white hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" className="min-h-[48px] w-full rounded-2xl bg-blue-600 px-6 py-4 font-black text-white hover:bg-blue-500">
                  {editorMode === "edit" ? "Guardar cambios" : "Crear unidad"}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
