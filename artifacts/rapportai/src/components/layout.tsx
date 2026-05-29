import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { useReportStore } from "@/lib/store";
import { useReportSync } from "@/hooks/use-report-sync";

interface LayoutProps {
  children: ReactNode;
  previewPanel?: ReactNode;
  stepName?: string;
  stepNumber?: number;
}

const STEPS = [
  { n: 1, label: "Info",       path: "/rapport/step-1" },
  { n: 2, label: "Garde",      path: "/rapport/step-2" },
  { n: 3, label: "Dédicaces",  path: "/rapport/step-3" },
  { n: 4, label: "Résumé",     path: "/rapport/step-4" },
  { n: 5, label: "Sommaire",   path: "/rapport/step-5" },
  { n: 6, label: "Intro",      path: "/rapport/step-6" },
  { n: 7, label: "Partie I",   path: "/rapport/partie-i" },
  { n: 8, label: "Partie II",  path: "/rapport/partie-ii" },
  { n: 9, label: "Conclusion", path: "/rapport/step-9" },
];

function SaveIndicator() {
  const report = useReportStore((s) => s.report);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

function StepNav({ currentStepNumber }: { currentStepNumber?: number }) {
  const [location] = useLocation();
  const maxStep = useReportStore((s) => s.report.currentStep);

  return (
    <div className="flex items-center gap-0.5">
      {STEPS.map(({ n, label, path }) => {
        const isActive = currentStepNumber === n || location === path;
        const isReachable = n <= maxStep;
        const isDone = isReachable && !isActive;

        const inner = (
          <span
            key={n}
            title={label}
            className="flex items-center justify-center rounded-full text-[10px] font-semibold transition-colors select-none"
            style={{
              width: 22,
              height: 22,
              background: isActive
                ? "linear-gradient(135deg,#7c3aed,#a855f7)"
                : isDone
                ? "#ede9fe"
                : "#f3f4f6",
              color: isActive ? "#fff" : isDone ? "#7c3aed" : "#c4c4c4",
              cursor: isReachable ? "pointer" : "default",
            }}
          >
            {isDone ? <Check style={{ width: 10, height: 10 }} /> : n}
          </span>
        );

        return isReachable ? (
          <Link key={n} href={path}>{inner}</Link>
        ) : (
          <span key={n}>{inner}</span>
        );
      })}
    </div>
  );
}

export function Layout({ children, previewPanel, stepName, stepNumber }: LayoutProps) {
  useReportSync();

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
          <StepNav currentStepNumber={stepNumber} />
          {stepName && (
            <span className="hidden lg:inline text-xs text-muted-foreground opacity-60 pl-1">
              {stepName}
            </span>
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

        {/* Right — Document preview */}
        {previewPanel && (
          <div className="hidden md:flex flex-col flex-1 min-h-0" style={{ background: "#f1f5f9" }}>
            {previewPanel}
          </div>
        )}
      </main>
    </div>
  );
}
