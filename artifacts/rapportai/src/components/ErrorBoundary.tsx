import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

// Catches any render crash so the user sees a friendly screen instead of a white page.
// Report data lives in localStorage, so a reload recovers their work.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f8ff] px-6">
        <div className="max-w-md w-full text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="text-4xl mb-3">😅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Oups, un petit pépin
          </h1>
          <p className="text-sm text-gray-500 mb-5">
            Quelque chose s'est mal affiché. Pas d'inquiétude — ton rapport est sauvegardé.
            Recharge la page pour continuer là où tu étais.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
          >
            Recharger la page
          </button>
          <a
            href="/dashboard"
            className="block mt-3 text-xs text-purple-600 hover:underline"
          >
            Retour au tableau de bord
          </a>
        </div>
      </div>
    );
  }
}
