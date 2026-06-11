import { useState, useEffect, useRef, type ReactNode, useCallback } from "react";
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
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-violet-600 underline underline-offset-2 hover:text-violet-800 transition-colors"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Attachments in the message stream ───────────────────────────────────────
// use-step-agent encodes uploaded files into the message string with a marker:
// ⟦ATTACH:[{name,size,type,thumb?}]⟧ — parsed here and rendered as cards, like
// modern LLM chats (image thumbnails, file cards with name + type + size).

type AttachInfo = { name: string; size: number; type: string; thumb?: string };
const ATTACH_RE = /⟦ATTACH:([\s\S]+?)⟧/;

function parseAttachments(content: ReactNode): { text: ReactNode; attachments: AttachInfo[] } {
  if (typeof content !== "string") return { text: content, attachments: [] };
  const m = content.match(ATTACH_RE);
  if (!m) return { text: content, attachments: [] };
  let attachments: AttachInfo[] = [];
  try { attachments = JSON.parse(m[1]) as AttachInfo[]; } catch { /* malformed — ignore */ }
  return { text: content.replace(ATTACH_RE, "").trim(), attachments };
}

function fmtSize(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function fileKindLabel(type: string, name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  if (ext && ext.length <= 5) return ext;
  return (type.split("/")[1] ?? "FICHIER").toUpperCase();
}

function AttachmentCards({ items }: { items: AttachInfo[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {items.map((a, i) =>
        a.thumb ? (
          <img
            key={i}
            src={a.thumb}
            alt={a.name}
            title={a.name}
            className="rounded-xl object-cover"
            style={{ width: 76, height: 76, border: "1px solid #e9d5ff", boxShadow: "0 1px 4px rgba(124,58,237,0.12)" }}
          />
        ) : (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: "#fff", border: "1px solid #e9d5ff", maxWidth: 230, boxShadow: "0 1px 4px rgba(124,58,237,0.10)" }}
            title={a.name}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "#f5f0ff" }}
            >
              <FileText className="w-4 h-4" style={{ color: "#7c3aed" }} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-gray-800 truncate">{a.name}</div>
              <div className="text-[10px] text-gray-400">
                {fileKindLabel(a.type, a.name)}{a.size ? ` · ${fmtSize(a.size)}` : ""}
              </div>
            </div>
          </div>
        )
      )}
    </div>
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
    const { text, attachments } = parseAttachments(content);
    const hasText = typeof text === "string" ? text.trim().length > 0 : !!text;
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-4 px-4"
      >
        <div className="max-w-[80%] flex flex-col items-end gap-1.5">
          {attachments.length > 0 && <AttachmentCards items={attachments} />}
          {hasText && (
            <div
              className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
              style={{ background: "#7c3aed", color: "#fff", lineHeight: "1.55" }}
            >
              {text}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 mb-5 px-4"
    >
      <img src="/logo.png" alt="RapportAI" className="shrink-0 w-6 h-6 mt-0.5 object-contain" />

      <div className="flex-1 min-w-0 text-sm" style={{ color: "#111827", lineHeight: "1.7" }}>
        {typeof content === "string" ? <AgentMarkdown content={content} /> : content}
        {isTyping && (
          <span className="flex items-center gap-1.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "140ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "280ms" }} />
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
  // Collapsed by default — raw reasoning is opt-in, not dumped in the user's face.
  // The narrated tool-call cards are the primary activity feed (Replit pattern).
  const [open, setOpen] = useState(false);
  const displayText = text ?? (detail ?? title ?? "");
  const isDone = !streaming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 mx-4 overflow-hidden rounded-xl"
      style={{
        border: `1px solid ${isDone ? "#e9d5ff" : "#c4b5fd"}`,
        background: isDone ? "#faf5ff" : "#f5f0ff",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-purple-100/60"
      >
        <motion.div
          animate={streaming ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
          transition={streaming ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
          style={{ color: isDone ? "#a78bfa" : "#7c3aed" }}
        >
          <BrainCircuit className="h-3.5 w-3.5 shrink-0" />
        </motion.div>

        <span className="font-medium text-xs flex-1 text-left" style={{ color: isDone ? "#7c3aed" : "#5b21b6" }}>
          {streaming ? (
            <span className="flex items-center gap-1.5">
              En train de réfléchir
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-violet-500" style={{ animationDelay: "0ms" }} />
                <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-violet-500" style={{ animationDelay: "120ms" }} />
                <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-violet-500" style={{ animationDelay: "240ms" }} />
              </span>
            </span>
          ) : (
            "Réflexion terminée"
          )}
        </span>

        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          style={{ color: "#a78bfa" }}
        />
      </button>

      {open && displayText && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="px-3 pb-3 pt-0"
          style={{ borderTop: "1px solid #ede9fe" }}
        >
          <div
            className="whitespace-pre-wrap text-xs leading-relaxed mt-2 max-h-40 overflow-y-auto italic"
            style={{ color: "#7c6f9c" }}
          >
            {displayText}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── AgentSteps ───────────────────────────────────────────────────────────────
// Perplexity/Replit-style activity panel: one collapsible block that shows the
// agent's steps live, with a completed-count, and the raw reasoning expandable.

interface StepItem { id: string; name: string; detail?: string; done?: boolean }

export function AgentSteps({
  toolCalls,
  thinkingText,
  isGenerating,
}: {
  toolCalls: StepItem[];
  thinkingText?: string;
  isGenerating?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const [slow, setSlow] = useState(false);
  const wasGenerating = useRef(false);

  // Auto-collapse once the work finishes (like Perplexity's "N steps completed").
  useEffect(() => {
    if (wasGenerating.current && !isGenerating) setOpen(false);
    wasGenerating.current = !!isGenerating;
  }, [isGenerating]);

  // Long-generation reassurance: never leave the student staring at a silent spinner.
  useEffect(() => {
    if (!isGenerating) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 40000);
    return () => clearTimeout(t);
  }, [isGenerating]);

  if (toolCalls.length === 0 && !thinkingText) return null;

  const doneCount = toolCalls.filter((t) => t.done).length;
  const label = isGenerating
    ? doneCount > 0
      ? `RapportAI travaille… (${doneCount} étape${doneCount > 1 ? "s" : ""})`
      : "RapportAI travaille…"
    : `${toolCalls.length} étape${toolCalls.length > 1 ? "s" : ""} terminée${toolCalls.length > 1 ? "s" : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-3 overflow-hidden rounded-xl"
      style={{ border: `1px solid ${isGenerating ? "#c4b5fd" : "#e9d5ff"}`, background: isGenerating ? "#f5f0ff" : "#faf5ff" }}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-purple-100/50 transition-colors">
        {isGenerating
          ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: "#7c3aed" }} />
          : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
        <span className="text-xs font-semibold flex-1 text-left" style={{ color: "#5b21b6" }}>{label}</span>
        {!isGenerating && doneCount > 0 && (
          <span className="text-[10px] text-purple-400">{doneCount}/{toolCalls.length}</span>
        )}
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} style={{ color: "#a78bfa" }} />
      </button>

      {slow && isGenerating && (
        <div className="px-3 py-1.5 text-[11px]" style={{ background: "#fffbeb", borderTop: "1px solid #fde68a", color: "#92400e" }}>
          ⏳ Ça prend un peu plus de temps que d'habitude — c'est normal pour les longues sections. Tu peux patienter, ou cliquer sur Arrêter et relancer.
        </div>
      )}

      {open && (
        <div className="px-3 pb-2.5 pt-0.5" style={{ borderTop: "1px solid #ede9fe" }}>
          <div className="flex flex-col gap-1 mt-1.5">
            {toolCalls.map((step) => {
              const cfg = getToolCfg(step.name);
              return (
                <div key={step.id} className="flex items-center gap-2 py-0.5">
                  <span className="shrink-0" style={{ color: step.done ? "#a78bfa" : cfg.color }}>{cfg.icon}</span>
                  <span className="text-xs shrink-0" style={{ color: step.done ? "#6b7280" : "#374151" }}>{step.name}</span>
                  {step.detail && (
                    <span className="font-mono text-[11px] truncate flex-1" style={{ color: "#9ca3af" }}>{step.detail}</span>
                  )}
                  <span className="shrink-0 ml-auto">
                    {step.done
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      : <Loader2 className="h-3 w-3 animate-spin" style={{ color: cfg.color }} />}
                  </span>
                </div>
              );
            })}
          </div>

          {thinkingText && (
            <div className="mt-2">
              <button
                onClick={() => setThoughtsOpen((o) => !o)}
                className="flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: "#7c3aed" }}
              >
                <BrainCircuit className="h-3 w-3" />
                {thoughtsOpen ? "Masquer le raisonnement" : "Voir le raisonnement"}
                <ChevronRight className={`h-2.5 w-2.5 transition-transform ${thoughtsOpen ? "rotate-90" : ""}`} />
              </button>
              {thoughtsOpen && (
                <div className="whitespace-pre-wrap text-[11px] leading-relaxed mt-1.5 max-h-44 overflow-y-auto italic" style={{ color: "#7c6f9c" }}>
                  {thinkingText}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
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

// ─── ChoiceCard ───────────────────────────────────────────────────────────────

export function ChoiceCard({
  question,
  choices,
  onChoice,
}: {
  question: string;
  choices: string[];
  onChoice: (choice: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = useCallback(
    (choice: string) => {
      if (selected) return;
      setSelected(choice);
      onChoice(choice);
    },
    [selected, onChoice]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3 max-w-xs"
    >
      <p className="text-sm font-medium text-violet-900 leading-snug">{question}</p>
      <div className="space-y-2">
        {choices.map((choice) => (
          <button
            key={choice}
            onClick={() => handleClick(choice)}
            disabled={!!selected}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-all duration-150 ${
              selected === choice
                ? "border-violet-600 bg-violet-600 text-white font-semibold shadow-sm"
                : selected
                ? "border-gray-200 bg-white text-gray-300 cursor-not-allowed"
                : "border-gray-200 bg-white text-gray-700 hover:border-violet-400 hover:bg-violet-50 cursor-pointer"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                selected === choice
                  ? "border-white"
                  : "border-gray-300"
              }`}
            >
              {selected === choice && (
                <span className="w-2 h-2 rounded-full bg-white block" />
              )}
            </span>
            {choice}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
