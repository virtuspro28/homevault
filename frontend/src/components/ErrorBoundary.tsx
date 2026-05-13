import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "../lib/runtimeLog";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Error desconocido en la interfaz.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportClientError("error-boundary", { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
          <div className="w-full max-w-xl rounded-[2rem] border border-red-500/20 bg-slate-900/70 p-8 text-center backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">UI Recovery</p>
            <h1 className="mt-3 text-2xl font-black text-white">La interfaz encontro un error</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Se ha evitado la pantalla en blanco. Recarga la pagina o revisa el componente que fallo.
            </p>
            <pre className="mt-6 overflow-auto rounded-2xl bg-slate-950/80 p-4 text-left font-mono text-xs text-red-200">
              {this.state.errorMessage}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
