// Agentic test page (Phase 1 validation). Talks to /api/orchestrator/:sessionId and shows
// the orchestrator's tool calls live, so we can SEE it reason + obey preferences.
// Route: /agentic  — opt-in, does not touch the existing step flow.

import { useState, useRef, useEffect } from "react";
import { API_BASE } from "@/lib/apiBase";
import { ensureSession } from "@/lib/useGenerate";

interface Msg { role: "user" | "agent"; content: string }
interface Step { name: string; detail?: string }

const TOOL_LABEL: Record<string, string> = {
  set_preference: "Préférence enregistrée",
  update_plan: "Plan mis à jour",
  write_section: "Rédaction de la section",
  humanize_section: "Humanisation",
  read_library: "Lecture de la bibliothèque",
  ask_user: "Question",
  mark_confirmed: "Section validée",
};

export default function AgenticPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<string[] | null>(null);
  const [doc, setDoc] = useState("");          // latest generated section content (for ZeroGPT)
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
          } else if (ev.type === "reply") {
            if (ev.content) setMessages((m) => [...m, { role: "agent", content: ev.content }]);
            if (ev.askUser) {
              setMessages((m) => [...m, { role: "agent", content: ev.askUser.question }]);
              if (ev.askUser.choices?.length) setChoices(ev.askUser.choices);
            }
          } else if (ev.type === "file_written") {
            if (typeof ev.content === "string") setDoc(ev.content);
          } else if (ev.type === "error") {
            setMessages((m) => [...m, { role: "agent", content: "⚠️ " + (ev.message ?? "Erreur") }]);
          }
        }
      }
    } catch {
      setMessages((m) => [...m, { role: "agent", content: "⚠️ Échec — vérifie qu'une session existe (commence un rapport d'abord)." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="text-center py-3 border-b">
        <h1 className="text-lg font-bold">RapportAI — Agent (test)</h1>
        <p className="text-xs text-gray-500">Ex : « Génère ma Partie I, Section 1 avec sous-sections 1.1 et 1.2, vise 50 pages »</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              {m.content}
            </div>
          </div>
        ))}

        {busy && steps.length > 0 && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-xs space-y-1">
            <div className="font-semibold text-purple-700">L'agent travaille…</div>
            {steps.map((s, i) => (
              <div key={i} className="text-purple-600">• {TOOL_LABEL[s.name] ?? s.name}{s.detail ? ` : ${s.detail}` : ""}</div>
            ))}
          </div>
        )}
        {busy && steps.length === 0 && <div className="text-xs text-gray-400">L'agent réfléchit…</div>}

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

      {doc && (
        <div className="border-t pt-2 mt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-600">
              Contenu généré ({doc.split(/\s+/).filter(Boolean).length} mots) — copie-le dans ZeroGPT
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(doc).catch(() => {})}
              className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
            >
              Copier
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto text-xs whitespace-pre-wrap bg-gray-50 border rounded p-2 text-gray-700">
            {doc}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2 border-t pt-3"
      >
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
  );
}
