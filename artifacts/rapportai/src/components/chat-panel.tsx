import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, CheckCircle2, BrainCircuit, Wrench, Loader2 } from "lucide-react";

export function ChatMessage({
  role,
  content,
  isTyping = false,
}: {
  role: "agent" | "user";
  content: React.ReactNode;
  isTyping?: boolean;
}) {
  if (role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-4 px-4"
      >
        <div
          className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
          style={{ background: "#1e293b", color: "#e2e8f0", lineHeight: "1.55" }}
        >
          {content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 mb-4 px-4"
    >
      {/* Agent avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
      >
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>

      {/* Message bubble */}
      <div
        className="flex-1 min-w-0 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm"
        style={{ background: "#1e293b", color: "#cbd5e1", lineHeight: "1.6" }}
      >
        {content}
        {isTyping && (
          <span className="inline-flex gap-1 ml-2 align-middle">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
      </div>
    </motion.div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  Read: "📖 Lecture du rapport",
  WebSearch: "🔍 Recherche académique",
  WebFetch: "🔍 Recherche de sources",
  Write: "✍️ Rédaction en cours",
  Edit: "✏️ Révision",
  Glob: "📂 Analyse des fichiers",
};

export function ToolCallCard({ name, detail, status, done }: { name: string; detail?: string; status?: "running" | "done"; done?: boolean }) {
  const isDone = done ?? status === "done";
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm mb-1.5 mx-4"
      style={{ background: "#1e293b", border: "1px solid #334155" }}
    >
      <Wrench className="h-3.5 w-3.5 shrink-0" style={{ color: "#475569" }} />
      <span className="font-medium text-xs shrink-0" style={{ color: "#cbd5e1" }}>
        {name}
      </span>
      {detail && (
        <span className="font-mono text-xs truncate flex-1" style={{ color: "#475569" }}>
          {detail}
        </span>
      )}
      {isDone ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#10b981" }} />
      ) : (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: "#475569" }} />
      )}
    </motion.div>
  );
}

export function ThinkingCard({ text, streaming, title, detail }: {
  text?: string;
  streaming?: boolean;
  // legacy props from step-1 static thinking cards
  title?: string;
  detail?: string;
}) {
  const [open, setOpen] = useState(true);
  const displayText = text ?? (detail ?? title ?? "");

  return (
    <div className="rounded-lg border border-violet-800 bg-violet-950/30 text-sm overflow-hidden mb-2 mx-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-violet-900/30 transition-colors"
        style={{ color: "#a78bfa" }}
      >
        <BrainCircuit className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-xs flex-1 text-left">
          Thinking
          {streaming && (
            <span className="ml-2 inline-flex gap-0.5 align-middle">
              <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-violet-500" style={{ animationDelay: "0ms" }} />
              <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-violet-500" style={{ animationDelay: "150ms" }} />
              <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-violet-500" style={{ animationDelay: "300ms" }} />
            </span>
          )}
        </span>
        {open ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 transition-transform" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform" />
        )}
      </button>
      {open && displayText && (
        <div className="px-3 pb-3 pt-1">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed" style={{ color: "#8b5cf6" }}>
            {displayText}
          </pre>
        </div>
      )}
    </div>
  );
}

export function StepTransitionCard({
  title,
  subtitle,
  onNext,
  nextLabel = "Continuer",
}: {
  title: string;
  subtitle?: string;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 rounded-xl p-4"
      style={{ background: "#1e293b", border: "1px solid #334155" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{title}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{subtitle}</p>}
        </div>
        <button
          onClick={onNext}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}
        >
          {nextLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
