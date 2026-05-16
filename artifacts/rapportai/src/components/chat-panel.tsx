import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, CheckCircle2, BrainCircuit } from "lucide-react";

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

export function ToolCallCard({ name, status }: { name: string; status: "running" | "done" }) {
  const label = TOOL_LABELS[name] || name;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 ml-10 mb-2 px-4"
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
        style={{
          background: status === "done" ? "#14532d22" : "#7c3aed15",
          border: `1px solid ${status === "done" ? "#16a34a33" : "#7c3aed33"}`,
          color: status === "done" ? "#4ade80" : "#a78bfa",
        }}
      >
        {status === "running" ? (
          <div className="w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin" />
        ) : (
          <CheckCircle2 className="w-3 h-3" />
        )}
        {label}
      </div>
    </motion.div>
  );
}

export function ThinkingCard({ title, detail }: { title: string; detail?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-2.5 mb-2 px-4"
    >
      <div
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: "#1e293b", border: "1px solid #334155" }}
      >
        <BrainCircuit className="w-3 h-3" style={{ color: "#7c3aed" }} />
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: "#64748b" }}
        >
          <ChevronRight
            className="w-3 h-3 transition-transform"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          {title}
        </button>
        <AnimatePresence>
          {expanded && detail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1.5 px-3 py-2 rounded-lg text-xs"
              style={{
                background: "#0f172a",
                color: "#475569",
                borderLeft: "2px solid #334155",
                lineHeight: "1.6",
              }}
            >
              {detail}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
