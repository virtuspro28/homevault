import { useCallback, useEffect, useState } from 'react';
import {
  FileCode,
  Save,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/themes/prism-tomorrow.css';
import { getErrorMessage } from '../lib/errors';
import { reportClientError } from '../lib/runtimeLog';

interface ConfigFile {
  name: string;
  path: string;
  type: 'yaml' | 'json' | 'env' | 'conf';
}

export default function ConfigEditor() {
  const [files, setFiles] = useState<ConfigFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ConfigFile | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const getHighlightLanguage = (type: ConfigFile['type']) => {
    if (type === 'yaml') return Prism.languages.yaml;
    if (type === 'json') return Prism.languages.json;
    return Prism.languages.bash;
  };

  const handleSelectFile = async (file: ConfigFile) => {
    setSelectedFile(file);
    setContent('Cargando...');
    try {
      const res = await fetch(`/api/config/read?path=${encodeURIComponent(file.path)}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setContent(data.data);
      }
    } catch {
      setContent('Error al cargar el archivo.');
    }
  };

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/config/files', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const nextFiles = data.data as ConfigFile[];
        setFiles(nextFiles);
        if (nextFiles.length > 0) {
          await handleSelectFile(nextFiles[0]);
        }
      }
    } catch (error) {
      reportClientError('config-files', getErrorMessage(error, 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: selectedFile.path, content })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', msg: 'Archivo guardado correctamente' });
      } else {
        setStatus({ type: 'error', msg: data.error || 'Error al guardar' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Error de red al guardar' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RotateCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <FileCode className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Editor de Configuración</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión avanzada de archivos .conf, .yaml y .env</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !selectedFile}
          className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
        >
          {saving ? <RotateCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span>Guardar Cambios</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:col-span-1">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 px-2">Archivos Críticos</h3>
          <div className="space-y-2">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => void handleSelectFile(file)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  selectedFile?.path === file.path
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl text-slate-400 hover:bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold truncate">{file.name}</span>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <AnimatePresence mode="wait">
            {status && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-2xl border flex items-center space-x-3 ${
                  status.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="text-xs font-black uppercase tracking-widest">{status.msg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-slate-950 border border-white/5 rounded-[2.5rem] overflow-hidden min-h-[600px] font-mono text-sm">
            <div className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl backdrop-blur-xl border border-white/10 shadow-xl border-b border-white/5 flex items-center space-x-2">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20"></div>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-4">{selectedFile?.path || 'Ningún archivo seleccionado'}</span>
            </div>

            <div className="p-6">
              <Editor
                value={content}
                onValueChange={(code) => setContent(code)}
                highlight={(code) => Prism.highlight(code, getHighlightLanguage(selectedFile?.type ?? 'conf'), 'editor')}
                padding={20}
                className="code-editor"
                style={{
                  fontFamily: '"Fira Code", "Fira Mono", monospace',
                  fontSize: 14,
                  minHeight: '520px',
                  backgroundColor: 'transparent',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
