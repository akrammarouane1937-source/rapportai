// Agentic report builder (the product). Polished chat (markdown + upload + working indicator)
// on the left, live report preview on the right. Route: /agentic.

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Paperclip, ArrowUp, Loader2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";
import { ensureSession } from "@/lib/useGenerate";
import { useReportStore } from "@/lib/store";
import { Layout } from "@/components/layout";
import { PreviewPanel } from "@/components/preview-panel";

interface Msg { role: "user" | "agent"; content: string }
interface Step { name: string; detail?: string }
interface Upload { name: string; status: "uploading" | "done" | "error" }

const TOOL_LABEL: Record<string, string> = {
  set_preference: "Préférence enregistrée",
  update_plan: "Plan mis à jour",
  write_section: "Rédaction",
  humanize_section: "Humanisation",
  read_library: "Lecture de tes documents",
  ask_user: "Question",
  mark_confirmed: "Section validée",
};

// Orchestrator section id → report store field (so the preview + export pick it up).
const SECTION_FIELD: Record<string, string> = {
  "page-de-garde": "pageDeGarde", dedicaces: "dedicaces", remerciements: "remerciements",
  resume: "resumeFr", sommaire: "sommaire", introduction: "introduction",
  "partie-i": "partieI", "partie-ii": "partieII", conclusion: "conclusion",
};

// Rotating reassurance shown while the agent works (long generations).
const WORKING_MSGS = [
  "Je rédige ta section…",
  "Je structure le contenu académique…",
  "Je vérifie tes sources et tes citations…",
  "J'humanise le texte pour qu'il passe les détecteurs d'IA…",
  "Presque fini — la qualité prend un peu de temps, garde l'onglet ouvert…",
];

// Markdown styling so agent replies render like Claude/ChatGPT, not raw **text**.
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
  const [messages, setMessages] = useState<Msg[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<string[] | null>(null);
  const [activeSection, setActiveSection] = useState("introduction");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, steps, busy]);

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

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true); setChoices(null); setSteps([]);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    try {
      const sessionId = await ensureSession();
      const resp = await fetch(`${API_BASE}/api/orchestrator/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
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
          } else if (ev.type === "file_written") {
            const field = SECTION_FIELD[ev.section as string];
            if (field && typeof ev.content === "string") {
              updateReport({ [field]: ev.content } as Record<string, string>);
              setActiveSection(ev.section as string);
            }
          } else if (ev.type === "reply") {
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
    } catch {
      setMessages((m) => [...m, { role: "agent", content: "⚠️ Échec de la requête. Réessaie." }]);
    } finally {
      setBusy(false);
    }
  };

  const workingMsg = WORKING_MSGS[Math.min(Math.floor(elapsed / 12), WORKING_MSGS.length - 1)];
  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Layout
      stepName="Agent — Construction du rapport"
      previewPanel={<PreviewPanel activeSection={activeSection} content="" maxStep={99} isGenerating={busy} />}
    >
      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-5 bg-white">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 max-w-prose">
            Bonjour 👋 Dis-moi ton sujet et comment tu veux ton rapport, et je le construis section par section.
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
            <div key={i} className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs">📝</span>
              </div>
              <div className="text-sm text-gray-800 max-w-[85%] min-w-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
              </div>
            </div>
          )
        ))}

        {busy && (
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            disabled={busy}
            rows={1}
            placeholder={choices ? "Choisis ci-dessus ou écris ta réponse…" : "Écris à l'agent…  (Entrée pour envoyer)"}
            className="flex-1 resize-none px-3.5 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 max-h-32"
          />
          <button type="submit" disabled={busy || !input.trim()} className="flex-shrink-0 w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-purple-700">
            <ArrowUp className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Layout>
  );
}
