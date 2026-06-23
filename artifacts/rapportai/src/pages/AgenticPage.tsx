// Agentic report builder (Phase 4 — the real product). Chat drives the orchestrator;
// generated sections sync into the report store so the existing PreviewPanel renders them
// and the Word/PDF export work. Route: /agentic.

import { useState, useRef, useEffect } from "react";
import { API_BASE } from "@/lib/apiBase";
import { ensureSession } from "@/lib/useGenerate";
import { useReportStore } from "@/lib/store";
import { Layout } from "@/components/layout";
import { PreviewPanel } from "@/components/preview-panel";

interface Msg { role: "user" | "agent"; content: string }
interface Step { name: string; detail?: string }

const TOOL_LABEL: Record<string, string> = {
  set_preference: "Préférence enregistrée",
  update_plan: "Plan mis à jour",
  write_section: "Rédaction",
  humanize_section: "Humanisation",
  read_library: "Lecture de la bibliothèque",
  ask_user: "Question",
  mark_confirmed: "Section validée",
};

// Orchestrator section id → report store field (so the preview + export pick it up).
const SECTION_FIELD: Record<string, string> = {
  "page-de-garde": "pageDeGarde",
  dedicaces: "dedicaces",
  remerciements: "remerciements",
  resume: "resumeFr",
  sommaire: "sommaire",
  introduction: "introduction",
  "partie-i": "partieI",
  "partie-ii": "partieII",
  conclusion: "conclusion",
};

export default function AgenticPage() {
  const { updateReport } = useReportStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<string[] | null>(null);
  const [activeSection, setActiveSection] = useState("introduction");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, steps, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setChoices(null);
    setSteps([]);
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

  return (
    <Layout
      stepName="Agent — Construction du rapport"
      previewPanel={<PreviewPanel activeSection={activeSection} content="" maxStep={99} isGenerating={busy} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 px-2">
            Dis-moi ton sujet et comment tu veux ton rapport. Ex : « Mon sujet est X. Construis ma Partie I, Chapitre 1, Section 1 avec sous-sections 1.1 et 1.2, ~6 pages. »
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-xs space-y-1">
            <div className="font-semibold text-purple-700">L'agent travaille…</div>
            {steps.map((s, i) => (
              <div key={i} className="text-purple-600">• {TOOL_LABEL[s.name] ?? s.name}{s.detail ? ` : ${s.detail}` : ""}</div>
            ))}
          </div>
        )}

        {choices && (
          <div className="flex flex-wrap gap-2">
            {choices.map((c, i) => (
              <button key={i} onClick={() => send(c)} className="px-3 py-1.5 rounded-full border border-purple-300 text-purple-700 text-sm hover:bg-purple-50">
                {c}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder="Écris à l'agent…"
            className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none focus:border-purple-400"
          />
          <button type="submit" disabled={busy || !input.trim()} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm disabled:opacity-40">
            Envoyer
          </button>
        </form>
      </div>
    </Layout>
  );
}
