import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles, ChevronRight, CheckCircle2, BrainCircuit,
  Loader2, BookOpen, PenLine, Pencil, Globe, FolderSearch,
  Terminal, Search, FileText, Eye,
} from "lucide-react";

// ─── Markdown renderer used for agent messages ───────────────────────────────

function AgentMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-violet-900">{children}</strong>,
        em: ({ children }) => <em className="italic text-violet-800">{children}</em>,
        ul: ({ children }) => <ul className="list-disc ml-4 mb-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-4 mb-1.5 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        h1: ({ children }) => <p className="font-bold text-sm mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-medium text-sm mb-0.5">{children}</p>,
        code: ({ children }) => (
          <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: "#ede9fe", color: "#5b21b6" }}>
            {children}
          </code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-violet-300 pl-3 italic text-violet-700 my-1">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── ChatMessage ─────────────────────────────────────────────────────────────

export function ChatMessage({
  role,
  content,
  isTyping = false,
}: {
  role: "agent" | "user";
  content: ReactNode;
  isTyping?: boolean;
}) {
  if (role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-3 px-4"
      >
        <div
          className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
          style={{ background: "#7c3aed", color: "#fff", lineHeight: "1.55" }}
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
      className="flex gap-3 mb-3 px-4"
    >
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
      >
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>

      <div
        className="flex-1 min-w-0 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm"
        style={{ background: "#f5f0ff", color: "#1e1b4b", lineHeight: "1.6", border: "1px solid #ede9fe" }}
      >
        {typeof content === "string" ? <AgentMarkdown content={content} /> : content}
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

// ─── GeneratedCard ────────────────────────────────────────────────────────────
// Shown after a section finishes generating — compact preview in the chat.

export function GeneratedCard({
  label,
  wordCount,
  snippet,
}: {
  label: string;
  wordCount: number;
  snippet: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 mb-3 px-4"
    >
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
      </div>

      <div
        className="flex-1 min-w-0 rounded-2xl rounded-tl-sm overflow-hidden"
        style={{ border: "1px solid #d1fae5", background: "#f0fdf4" }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold text-emerald-900 truncate">{label}</span>
            <span className="text-xs text-emerald-600 shrink-0">{wordCount} mots</span>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
          >
            <Eye className="w-3 h-3" />
            {expanded ? "Masquer" : "Aperçu"}
          </button>
        </div>

        {expanded && snippet && (
          <div
            className="px-4 pb-3 pt-0 text-xs leading-relaxed border-t"
            style={{ borderColor: "#bbf7d0", color: "#065f46" }}
          >
            <p className="line-clamp-4">{snippet}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── ToolCallCard ─────────────────────────────────────────────────────────────

const TOOL_CONFIG: Record<string, { icon: ReactNode; color: string }> = {
  "Lecture du rapport":   { icon: <BookOpen className="h-3.5 w-3.5" />,    color: "#7c3aed" },
  "Analyse des fichiers": { icon: <FolderSearch className="h-3.5 w-3.5" />, color: "#a855f7" },
  "Rédaction en cours":   { icon: <PenLine className="h-3.5 w-3.5" />,     color: "#059669" },
  "Révision en cours":    { icon: <Pencil className="h-3.5 w-3.5" />,      color: "#d97706" },
  "Révision":             { icon: <Pencil className="h-3.5 w-3.5" />,      color: "#d97706" },
  "Recherche académique": { icon: <Search className="h-3.5 w-3.5" />,      color: "#2563eb" },
  "Recherche de sources": { icon: <Globe className="h-3.5 w-3.5" />,       color: "#2563eb" },
  "Traitement":           { icon: <Terminal className="h-3.5 w-3.5" />,    color: "#6b7280" },
};

function getToolCfg(name: string) {
  if (TOOL_CONFIG[name]) return TOOL_CONFIG[name];
  const key = Object.keys(TOOL_CONFIG).find((k) => name.includes(k) || k.includes(name));
  return key ? TOOL_CONFIG[key] : { icon: <Search className="h-3.5 w-3.5" />, color: "#7c3aed" };
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
        background: isDone ? "#fafafa" : "#faf5ff",
        border: `1px solid ${isDone ? "#f0f0f0" : "#ede9fe"}`,
      }}
    >
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full"
        style={{ background: isDone ? "#e5e7eb" : cfg.color }}
        animate={isDone ? {} : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <span className="shrink-0 ml-1.5" style={{ color: isDone ? "#d1d5db" : cfg.color }}>
        {cfg.icon}
      </span>

      <span className="text-xs font-medium shrink-0" style={{ color: isDone ? "#9ca3af" : "#374151" }}>
        {name}
      </span>

      {detail && (
        <span className="font-mono text-xs truncate flex-1" style={{ color: isDone ? "#d1d5db" : "#6b7280" }}>
          {detail}
        </span>
      )}

      <span className="shrink-0 ml-auto">
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: cfg.color }} />
        )}
      </span>
    </motion.div>
  );
}

// ─── ThinkingCard ─────────────────────────────────────────────────────────────

export function ThinkingCard({ text, streaming, title, detail }: {
  text?: string;
  streaming?: boolean;
  title?: string;
  detail?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayText = text ?? (detail ?? title ?? "");

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 text-sm overflow-hidden mb-2 mx-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-purple-100 transition-colors"
        style={{ color: "#7c3aed" }}
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
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && displayText && (
        <div className="px-3 pb-3 pt-1">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-purple-700">
            {displayText}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── StepTransitionCard ───────────────────────────────────────────────────────

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
      style={{ background: "#f5f0ff", border: "1px solid #ede9fe" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          {subtitle && <p className="text-xs mt-0.5 text-gray-500">{subtitle}</p>}
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
