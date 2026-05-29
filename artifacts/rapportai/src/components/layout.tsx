import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { useReportStore } from "@/lib/store";

interface LayoutProps {
  children: ReactNode;
  previewPanel?: ReactNode;
  stepName?: string;
  stepNumber?: number;
}

// Flashes "Enregistrement…" → "Enregistré" whenever the report changes. Data is
// persisted to localStorage on every change (Zustand persist); this just makes
// that visible so students trust their work is saved.
function SaveIndicator() {
  const report = useReportStore((s) => s.report);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("saved"), 700);
    return () => clearTimeout(timer.current);
  }, [report]);

  if (status === "idle") return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {status === "saving"
        ? <><Loader2 className="w-3 h-3 animate-spin" /> Enregistrement…</>
        : <><Check className="w-3 h-3 text-emerald-500" /> Enregistré</>}
    </span>
  );
}

export function Layout({ children, previewPanel, stepName, stepNumber }: LayoutProps) {
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between h-12 px-5 z-10 bg-background border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: "-0.01em" }}>
            RapportAI
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <SaveIndicator />
          {stepName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Étape {stepNumber}/9</span>
              <span className="opacity-40">·</span>
              <span>{stepName}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left — Chat */}
        <div
          className={`flex flex-col bg-background ${previewPanel ? "w-full md:w-[40%] border-r border-border" : "w-full max-w-2xl mx-auto"} min-h-0`}
        >
          {children}
        </div>

        {/* Right — Document preview (always light — simulates paper) */}
        {previewPanel && (
          <div className="hidden md:flex flex-col flex-1 min-h-0" style={{ background: "#f1f5f9" }}>
            {previewPanel}
          </div>
        )}
      </main>
    </div>
  );
}
