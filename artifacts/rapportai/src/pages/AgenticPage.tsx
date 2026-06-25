// Agentic report builder (the product). Polished chat — markdown, upload, working indicator,
// conversation memory, stop, copy, and reload persistence — on the left; live preview on the right.
// Route: /agentic.

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Paperclip, ArrowUp, Square, Loader2, FileText, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";
import { ensureSession } from "@/lib/useGenerate";
import { useReportStore } from "@/lib/store";
import { Layout } from "@/components/layout";
import { PreviewPanel } from "@/components/preview-panel";

interface Msg { role: "user" | "agent"; content: string }
interface Step { name: string; detail?: string }
interface Upload { name: string; status: "uploading" | "done" | "error" }

const STORAGE_KEY = "agentic-chat-v1";

const TOOL_LABEL: Record<string, string> = {
  set_preference: "Préférence enregistrée",
  update_plan: "Plan mis à jour",
  write_section: "Rédaction",
  humanize_section: "Humanisation",
  read_library: "Lecture de tes documents",
  ask_user: "Question",
  mark_confirmed: "Section validée",
};

const SECTION_FIELD: Record<string, string> = {
  "page-de-garde": "pageDeGarde", dedicaces: "dedicaces", remerciements: "remerciements",
  resume: "resumeFr", sommaire: "sommaire", introduction: "introduction",
  "partie-i": "partieI", "partie-ii": "partieII", conclusion: "conclusion",
};

const WORKING_MSGS = [
  "Je rédige ta section…",
  "Je structure le contenu académique…",
  "Je vérifie tes sources et tes citations…",
  "J'humanise le texte pour qu'il passe les détecteurs d'IA…",
  "Presque fini — la qualité prend un peu de temps, garde l'onglet ouvert…",
];

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
  code: ({ children }) => <code className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono">{children}</code>,
  a: ({ children, href }) => <a href={href} className="text-purple-600 underline" target="_blank" rel="noreferrer">{children}</a>,
};

export default function AgenticPage() {
  const { updateReport } = useReportStore();
  const [messages, setMessages] = useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<string[] | null>(null);
  const [activeSection, setActiveSection] = useState("introduction");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
  const [streaming, setStreaming] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, steps, busy, streaming]);

  // Persist conversation across reloads.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100))); } catch { /* quota */ }
  }, [messages]);

  // Elapsed-time ticker for the working indicator.
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const sessionId = await ensureSession();
    for (const file of Array.from(files)) {
      setUploads((u) => [...u.filter((x) => x.name !== file.name), { name: file.name, status: "uploading" }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch(`${API_BASE}/api/session/${sessionId}/upload-document`, { method: "POST", body: fd });
        setUploads((u) => u.map((x) => x.name === file.name ? { ...x, status: r.ok ? "done" : "error" } : x));
      } catch {
        setUploads((u) => u.map((x) => x.name === file.name ? { ...x, status: "error" } : x));
      }
    }
  };

  const stop = () => { abortRef.current?.abort(); setBusy(false); };

  const clearChat = () => {
    setMessages([]); setSteps([]); setChoices(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const copyMsg = (i: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true); setChoices(null); setSteps([]); setStreaming("");
    // Conversation memory: send prior turns so the agent remembers the discussion.
    const history = messages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    abortRef.current = new AbortController();
    try {
      const sessionId = await ensureSession();
      const resp = await fetch(`${API_BASE}/api/orchestrator/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: abortRef.current.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let ev: any;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          if (ev.type === "tool_call") {
            setSteps((s) => [...s, { name: ev.name, detail: ev.detail }]);
          } else if (ev.type === "text_delta") {
            if (typeof ev.text === "string") setStreaming((s) => s + ev.text);
          } else if (ev.type === "file_written") {
            const field = SECTION_FIELD[ev.section as string];
            if (field && typeof ev.content === "string") {
              updateReport({ [field]: ev.content } as Record<string, string>);
              setActiveSection(ev.section as string);
            }
          } else if (ev.type === "reply") {
            setStreaming("");  // finalize the live-streamed text into a permanent message
            if (ev.content) setMessages((m) => [...m, { role: "agent", content: ev.content }]);
            if (ev.askUser) {
              setMessages((m) => [...m, { role: "agent", content: ev.askUser.question }]);
              if (ev.askUser.choices?.length) setChoices(ev.askUser.choices);
            }
          } else if (ev.type === "error") {
            setMessages((m) => [...m, { role: "agent", content: "⚠️ " + (ev.message ?? "Erreur") }]);
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((m) => [...m, { role: "agent", content: "⚠️ Échec de la requête. Réessaie." }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const workingMsg = WORKING_MSGS[Math.min(Math.floor(elapsed / 12), WORKING_MSGS.length - 1)];
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Layout
      stepName="Agent — Construction du rapport"
      previewPanel={<PreviewPanel activeSection={activeSection} content="" maxStep={99} isGenerating={busy} />}
    >
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-white text-xs">
        <span className="text-gray-400">Assistant rédaction</span>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-gray-400 hover:text-gray-700">Nouvelle conversation</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-5 bg-white">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 max-w-prose">
            Bonjour 👋 Dis-moi ton sujet et comment tu veux ton rapport, et je le construis section par section.
            Tu peux aussi joindre tes sources avec 📎.
          </div>
        )}

        {messages.map((m, i) => (
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="px-3.5 py-2 rounded-2xl rounded-br-md max-w-[80%] text-sm bg-purple-600 text-white whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5 group">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs">📝</span>
              </div>
              <div className="text-sm text-gray-800 max-w-[85%] min-w-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                <button
                  onClick={() => copyMsg(i, m.content)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied === i ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  {copied === i ? "Copié" : "Copier"}
                </button>
              </div>
            </div>
          )
        ))}

        {streaming && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs">📝</span>
            </div>
            <div className="text-sm text-gray-800 max-w-[85%] min-w-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{streaming}</ReactMarkdown>
              <span className="inline-block w-1.5 h-3.5 bg-purple-400 animate-pulse align-middle ml-0.5" />
            </div>
          </div>
        )}

        {busy && !streaming && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
            </div>
            <div className="rounded-xl border border-purple-100 bg-purple-50/60 px-3 py-2 text-xs min-w-0">
              <div className="flex items-center gap-2 font-semibold text-purple-700">
                <span>{workingMsg}</span>
                <span className="text-purple-400 font-mono tabular-nums">{mm}:{ss}</span>
              </div>
              {steps.length > 0 && (
                <div className="mt-1 space-y-0.5 text-purple-500">
                  {steps.slice(-4).map((s, i) => (
                    <div key={i}>• {TOOL_LABEL[s.name] ?? s.name}{s.detail ? ` : ${s.detail}` : ""}</div>
                  ))}
                </div>
              )}
              <div className="mt-1 text-[11px] text-purple-400">La qualité prend un peu de temps — garde cet onglet ouvert.</div>
            </div>
          </div>
        )}

        {choices && (
          <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 space-y-2">
            <div className="text-xs font-semibold text-purple-700">Choisis — ou écris ta propre réponse en bas :</div>
            <div className="flex flex-wrap gap-2">
              {choices.map((c, i) => (
                <button key={i} onClick={() => send(c)} className="px-3 py-1.5 rounded-full border border-purple-300 bg-white text-purple-700 text-sm hover:bg-purple-100 transition-colors">{c}</button>
              ))}
              <button onClick={() => { setChoices(null); inputRef.current?.focus(); }} className="px-3 py-1.5 rounded-full border border-dashed border-purple-300 text-purple-500 text-sm hover:bg-purple-100 transition-colors">✏️ Autre…</button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-white px-4 py-3 space-y-2">
        {uploads.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {uploads.map((u, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 text-[11px] text-gray-600">
                {u.status === "uploading" ? <Loader2 className="w-3 h-3 animate-spin" /> : u.status === "done" ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                <FileText className="w-3 h-3" />{u.name}
              </span>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} title="Joindre un document ou une image" className="flex-shrink-0 w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            disabled={busy}
            rows={3}
            placeholder={choices ? "Choisis ci-dessus ou écris ta réponse…" : "Écris à l'agent…  (Entrée pour envoyer · Maj+Entrée = saut de ligne)"}
            className="flex-1 resize-none px-4 py-3 rounded-2xl border border-gray-200 text-sm leading-relaxed outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[76px] max-h-60"
          />
          {busy ? (
            <button type="button" onClick={stop} title="Arrêter" className="flex-shrink-0 w-9 h-9 rounded-xl bg-gray-800 text-white flex items-center justify-center hover:bg-gray-900">
              <Square className="w-3.5 h-3.5" fill="currentColor" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="flex-shrink-0 w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-purple-700">
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </Layout>
  );
}
