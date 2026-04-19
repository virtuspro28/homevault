import { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Shield } from 'lucide-react';
import { Terminal } from 'xterm';
// @ts-ignore
import { FitAddon } from 'xterm-addon-fit';
import { io } from 'socket.io-client';
import 'xterm/css/xterm.css';

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Inicializar XTerm
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#020617', // slate-950
        foreground: '#f8fafc',
        cursor: '#3b82f6',
      },
      fontSize: 14,
      fontFamily: '"Fira Code", monospace',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    // Conectar Socket.io
    const socket = io('/terminal', {
      auth: { token: localStorage.getItem('token') }
    });
    socketRef.current = socket;

    socket.on('output', (data: string) => {
      term.write(data);
    });

    term.onData((data) => {
      socket.emit('input', data);
    });

    window.addEventListener('resize', () => fitAddon.fit());

    return () => {
      socket.disconnect();
      term.dispose();
    };
  }, []);

  return (
    <div className="space-y-8 pb-12 h-[calc(100vh-160px)]">
      <div className="flex items-center space-x-4 bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
        <div className="p-4 bg-emerald-500/10 rounded-2xl">
          <TerminalIcon className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Consola SSH Segura</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Terminal de sistema (Modo no-root)</p>
        </div>
        <div className="ml-auto hidden md:flex items-center space-x-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
           <Shield className="w-4 h-4 text-emerald-500" />
           <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Conexión Encriptada</span>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 border border-white/5 rounded-[2.5rem] overflow-hidden p-6 h-full min-h-[500px]">
         <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
}
