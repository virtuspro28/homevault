import { useState, useEffect, useCallback } from 'react';
import { 
  FolderLock, 
  Search, 
  Plus, 
  Trash2, 
  Download, 
  Edit2, 
  ArrowLeft,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Film,
  Music,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { reportClientError } from '../lib/runtimeLog';

const FILES_LIST_ENDPOINT = '/api/files/list';
const FILE_MANAGER_PATH_KEY = 'homevault:file-manager:path';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export default function FileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const requestPath = path && path.trim() ? path : '/';
      const res = await fetch(`${FILES_LIST_ENDPOINT}?path=${encodeURIComponent(requestPath)}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo cargar el directorio');
      }
      setFiles(Array.isArray(data.data) ? data.data : []);
      setCurrentPath(typeof data.path === 'string' && data.path.trim() ? data.path : requestPath);
      setError(null);
    } catch (err) {
      reportClientError('file-manager-fetch', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el explorador');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedPath = window.localStorage.getItem(FILE_MANAGER_PATH_KEY) || '/';
    void fetchFiles(savedPath);
  }, [fetchFiles]);

  useEffect(() => {
    window.localStorage.setItem(FILE_MANAGER_PATH_KEY, currentPath || '/');
  }, [currentPath]);

  const handleNavigate = (path: string) => {
    void fetchFiles(path);
  };

  const goBack = () => {
    if (currentPath === '/' || !currentPath) {
      return;
    }

    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    handleNavigate(parts.length > 0 ? `/${parts.join('/')}` : '/');
  };

  const getIcon = (file: FileItem) => {
    if (file.isDirectory) return <FolderOpen className="w-6 h-6 text-blue-400" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'svg', 'webp'].includes(ext!)) return <ImageIcon className="w-6 h-6 text-emerald-400" />;
    if (['mp4', 'mov', 'avi'].includes(ext!)) return <Film className="w-6 h-6 text-purple-400" />;
    if (['mp3', 'wav', 'flac'].includes(ext!)) return <Music className="w-6 h-6 text-pink-400" />;
    return <FileText className="w-6 h-6 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));

  const handleCreateFolder = async () => {
    const name = window.prompt('Nombre de la nueva carpeta');
    if (!name) return;

    try {
      const res = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: currentPath, name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo crear la carpeta');
      }
      await fetchFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la carpeta');
    }
  };

  const handleDelete = async (file: FileItem) => {
    const confirmed = window.confirm(`¿Eliminar ${file.name}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/files/delete?path=${encodeURIComponent(file.path)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo eliminar el elemento');
      }
      await fetchFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el elemento');
    }
  };

  const handleRename = async (file: FileItem) => {
    const nextName = window.prompt('Nuevo nombre', file.name);
    if (!nextName || nextName === file.name) return;

    const parentPath = file.path.includes('/')
      ? file.path.slice(0, file.path.lastIndexOf('/'))
      : '/';
    const newPath = [parentPath === '/' ? '' : parentPath, nextName].filter(Boolean).join('/');
    const normalizedNewPath = newPath.startsWith('/') ? newPath : `/${newPath}`;

    try {
      const res = await fetch('/api/files/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPath: file.path, newPath: normalizedNewPath }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo renombrar el elemento');
      }
      await fetchFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renombrar el elemento');
    }
  };

  const handleDownload = (file: FileItem) => {
    window.open(`/api/files/download?path=${encodeURIComponent(file.path)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <FolderLock className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">File Station</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Navegador de archivos nativo</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
             <input 
               type="text"
               placeholder="Buscar en esta carpeta..."
               className="w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
             />
          </div>
          <button onClick={handleCreateFolder} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all">
             <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between mb-6 px-4">
           <div className="flex items-center space-x-4 text-xs font-black text-slate-500 uppercase tracking-widest">
              {currentPath !== '/' && (
                <button onClick={goBack} className="p-2 hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl rounded-lg text-white transition-all">
                   <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <span>{currentPath}</span>
           </div>
           <div className="flex bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >
                 <Plus className="w-4 h-4 rotate-45" /> 
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >
                 <MoreVertical className="w-4 h-4" />
              </button>
           </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6" : "space-y-2"}>
             <AnimatePresence mode="popLayout">
               {filteredFiles.map((file) => (
                 <motion.div
                   key={file.path}
                   layout
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className={viewMode === 'grid' 
                    ? "flex flex-col items-center p-6 rounded-[2rem] hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl transition-all group cursor-pointer border border-transparent hover:border-white/5 text-center"
                    : "flex items-center justify-between p-4 rounded-xl hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl transition-all group cursor-pointer border border-transparent hover:border-white/5"
                   }
                   onClick={() => file.isDirectory && handleNavigate(file.path)}
                 >
                    <div className={viewMode === 'grid' ? "mb-4" : "flex items-center space-x-4"}>
                       <div className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl group-hover:bg-blue-500/10 transition-all">
                          {getIcon(file)}
                       </div>
                       {viewMode === 'list' && (
                          <div>
                             <p className="text-sm font-black text-white">{file.name}</p>
                             <p className="text-[10px] text-slate-500 font-bold uppercase">{file.isDirectory ? 'Carpeta' : formatSize(file.size)}</p>
                          </div>
                       )}
                    </div>
                    {viewMode === 'grid' && (
                      <>
                        <p className="text-xs font-black text-white truncate w-full mb-1">{file.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{file.isDirectory ? 'Carpeta' : formatSize(file.size)}</p>
                      </>
                    )}
                    <div className={viewMode === 'grid' 
                      ? "flex mt-4 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                      : "flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    }>
                       {!file.isDirectory && (
                         <button
                           onClick={(event) => {
                             event.stopPropagation();
                             handleDownload(file);
                           }}
                           className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg"
                         >
                           <Download className="w-4 h-4" />
                         </button>
                       )}
                       <button
                         onClick={(event) => {
                           event.stopPropagation();
                           void handleRename(file);
                         }}
                         className="p-2 hover:bg-amber-500/20 text-amber-400 rounded-lg"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button
                         onClick={(event) => {
                           event.stopPropagation();
                           void handleDelete(file);
                         }}
                         className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>
        )}

        {!loading && !error && filteredFiles.length === 0 && (
          <div className="py-20 text-center">
             <FolderOpen className="mx-auto mb-4 h-12 w-12 text-blue-400/70" />
             <p className="font-bold text-slate-300">Esta carpeta está vacía</p>
             <p className="mt-2 text-sm text-slate-500">Crea una carpeta nueva o sube archivos para empezar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
