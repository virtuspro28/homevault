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

const SELECT_CLASSNAME = "rounded-xl border border-white/10 bg-slate-950 text-white p-4 text-sm";
const OPTION_CLASSNAME = "bg-slate-950 text-white";

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

export default function CloudManager() {
  const [providers, setProviders] = useState<ProviderDefinition[]>(PROVIDER_DEFINITIONS);
  const [remotes, setRemotes] = useState<CloudRemote[]>([]);
  const [profiles, setProfiles] = useState<RemoteProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<RemoteProfile>(EMPTY_FORM);
  const [manualOptionsJson, setManualOptionsJson] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === form.provider),
    [form.provider, providers],
  );

  const fetchData = async () => {
    try {
      const [providersRes, remotesRes, profilesRes] = await Promise.all([
        fetch("/api/cloud/providers", { credentials: "include" }),
        fetch("/api/cloud/remotes", { credentials: "include" }),
        fetch("/api/cloud/profiles", { credentials: "include" }),
      ]);

      const [providersData, remotesData, profilesData] = await Promise.all([
        providersRes.json(),
        remotesRes.json(),
        profilesRes.json(),
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
    setManualOptionsJson(buildManualOptionsJson(profile.manualOptions));
    setEditorOpen(true);
  };

  const handleMount = async (remote: CloudRemote) => {
    setActionLoading(remote.name);
    try {
      const method = remote.isMounted ? "DELETE" : "POST";
      const res = await fetch(`/api/cloud/mount/${remote.name}`, { method, credentials: "include" });
      const data = await res.json();
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
      const data = await res.json();
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
      const data = await res.json();
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
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-6 rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-md xl:flex-row xl:items-center xl:justify-between">
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
          className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white transition-all hover:bg-blue-500"
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
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
              className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-8 backdrop-blur-xl"
            >
              <div className={`absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full blur-[80px] opacity-30 ${remote.isMounted ? "bg-emerald-500" : "bg-blue-500"}`}></div>

              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <HardDrive className={`h-6 w-6 ${remote.isMounted ? "text-emerald-400" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-white">{remote.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{remote.provider}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${remote.isMounted ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
                  {remote.isMounted ? "Montada" : "Desconectada"}
                </span>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/5 bg-slate-950/60 p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Origen</p>
                  <p className="mt-1 text-sm text-slate-300">{remote.summary}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Montaje local</p>
                  <p className="mt-1 break-all text-sm text-blue-300">{remote.mountPath}</p>
                </div>
                {remote.remotePath && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subruta remota</p>
                    <p className="mt-1 text-sm text-slate-300">{remote.remotePath}</p>
                  </div>
                )}
              </div>

              {remote.usage && (
                <div className="mt-5 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>Uso detectado</span>
                    <span>{Math.round((remote.usage.used / remote.usage.total) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(remote.usage.used / remote.usage.total) * 100}%` }} />
                  </div>
                  <div className="mt-3 flex justify-between text-[11px] text-slate-400">
                    <span>{formatBytes(remote.usage.used)} usados</span>
                    <span>{formatBytes(remote.usage.free)} libres</span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => void handleMount(remote)}
                  disabled={actionLoading === remote.name}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest transition-all ${remote.isMounted ? "border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20" : "bg-blue-600 text-white hover:bg-blue-500"}`}
                >
                  {actionLoading === remote.name ? <Loader2 className="h-4 w-4 animate-spin" /> : remote.isMounted ? <PlugZap className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
                  <span>{remote.isMounted ? "Desmontar" : "Montar"}</span>
                </button>
                <button
                  onClick={() => {
                    const profile = profiles.find((item) => item.name === remote.name);
                    if (profile) {
                      openEdit(profile);
                    }
                  }}
                  className="rounded-2xl bg-white/5 p-4 text-slate-300 hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void handleDelete(remote.name)}
                  className="rounded-2xl bg-red-500/10 p-4 text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="flex items-start gap-6 rounded-[2.5rem] border border-blue-600/20 bg-blue-600/5 p-8">
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
              className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2.5rem] border border-white/10 bg-slate-900 p-8 shadow-2xl"
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
                <button type="button" onClick={() => setEditorOpen(false)} className="rounded-2xl bg-white/5 p-3 hover:bg-white/10">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nombre único"
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm"
                  disabled={editorMode === "edit"}
                  required
                />
                  <select
                    value={form.provider}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...EMPTY_FORM,
                        ...current,
                        name: current.name,
                        provider: event.target.value as RemoteProvider,
                      }))
                    }
                    className={SELECT_CLASSNAME}
                    style={{ backgroundColor: "#020617", color: "#ffffff" }}
                  >
                  {providers.map((provider) => (
                    <option
                      key={provider.id}
                      value={provider.id}
                      className={OPTION_CLASSNAME}
                      style={{ backgroundColor: "#020617", color: "#ffffff" }}
                    >
                      {provider.label}
                    </option>
                  ))}
                </select>
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
                    className: "w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm",
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
                    className="min-h-[160px] w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm"
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 md:flex-row">
                <button type="button" onClick={() => setEditorOpen(false)} className="w-full rounded-2xl bg-slate-800 px-6 py-4 font-black text-white hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" className="w-full rounded-2xl bg-blue-600 px-6 py-4 font-black text-white hover:bg-blue-500">
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
