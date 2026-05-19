import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight, CheckCircle2, BrainCircuit, Loader2, BookOpen, PenLine, Pencil, Globe, FolderSearch, Terminal, Search } from "lucide-react";

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

const TOOL_CONFIG: Record<string, { icon: ReactNode; color: string }> = {
  "Lecture du rapport":   { icon: <BookOpen className="h-3.5 w-3.5" />,    color: "#60a5fa" },
  "Analyse des fichiers": { icon: <FolderSearch className="h-3.5 w-3.5" />, color: "#a78bfa" },
  "Rédaction en cours":   { icon: <PenLine className="h-3.5 w-3.5" />,     color: "#34d399" },
  "Révision en cours":    { icon: <Pencil className="h-3.5 w-3.5" />,      color: "#fbbf24" },
  "Révision":             { icon: <Pencil className="h-3.5 w-3.5" />,      color: "#fbbf24" },
  "Recherche académique": { icon: <Search className="h-3.5 w-3.5" />,      color: "#f97316" },
  "Recherche de sources": { icon: <Globe className="h-3.5 w-3.5" />,       color: "#f97316" },
  "Traitement":           { icon: <Terminal className="h-3.5 w-3.5" />,    color: "#94a3b8" },
};

function getToolCfg(name: string) {
  if (TOOL_CONFIG[name]) return TOOL_CONFIG[name];
  const key = Object.keys(TOOL_CONFIG).find((k) => name.includes(k) || k.includes(name));
  return key ? TOOL_CONFIG[key] : { icon: <Search className="h-3.5 w-3.5" />, color: "#64748b" };
}

export function ToolCallCard({ name, detail, status, done }: { name: string; detail?: string; status?: "running" | "done"; done?: boolean }) {
  const isDone = done ?? status === "done";
  const cfg = getToolCfg(name);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 mb-1.5 mx-4 overflow-hidden relative"
      style={{
        background: isDone ? "#0f172a" : "#0d1117",
        border: `1px solid ${isDone ? "#1e293b" : cfg.color + "50"}`,
        boxShadow: isDone ? "none" : `inset 0 0 24px ${cfg.color}0a`,
      }}
    >
      {/* Animated left accent */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full"
        style={{ background: isDone ? "#1e293b" : cfg.color }}
        animate={isDone ? {} : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Icon */}
      <span className="shrink-0 ml-1.5" style={{ color: isDone ? "#334155" : cfg.color }}>
        {cfg.icon}
      </span>

      {/* Label */}
      <span className="text-xs font-medium shrink-0" style={{ color: isDone ? "#475569" : "#e2e8f0" }}>
        {name}
      </span>

      {/* Detail */}
      {detail && (
        <span className="font-mono text-xs truncate flex-1" style={{ color: isDone ? "#1e293b" : "#475569" }}>
          {detail}
        </span>
      )}

      {/* Status */}
      <span className="shrink-0 ml-auto">
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: cfg.color }} />
        )}
      </span>
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
