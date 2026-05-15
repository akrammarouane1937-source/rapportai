import { ReactNode } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  previewPanel?: ReactNode;
  stepName?: string;
  stepNumber?: number;
}

export function Layout({ children, previewPanel, stepName, stepNumber }: LayoutProps) {
  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: "#0f172a" }}>
      {/* Header — dark */}
      <header className="shrink-0 flex items-center justify-between h-12 px-5 z-10" style={{ background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: "-0.01em" }}>
            RapportAI
          </span>
        </Link>

        {stepName && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#64748b" }}>
            <span style={{ color: "#475569" }}>Étape {stepNumber}/9</span>
            <span style={{ color: "#334155" }}>·</span>
            <span style={{ color: "#94a3b8" }}>{stepName}</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left — Chat (dark) */}
        <div
          className={`flex flex-col ${previewPanel ? "w-full md:w-[40%]" : "w-full max-w-2xl mx-auto"} min-h-0`}
          style={{ background: "#0f172a", borderRight: previewPanel ? "1px solid #1e293b" : undefined }}
        >
          {children}
        </div>

        {/* Right — Document preview (light) */}
        {previewPanel && (
          <div className="hidden md:flex flex-col flex-1 min-h-0" style={{ background: "#f1f5f9" }}>
            {previewPanel}
          </div>
        )}
      </main>
    </div>
  );
}
