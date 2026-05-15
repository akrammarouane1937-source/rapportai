import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";
import { ensureSession } from "@/lib/useGenerate";

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  streaming?: boolean;
};

const SUGGESTIONS = [
  "Reformule le chapitre 1 de façon plus concise",
  "Ajoute une transition entre les chapitres",
  "Rends l'introduction plus accrocheuse",
  "Approfondie la partie sur la méthodologie",
];

export function ChatRevision({
  sectionId,
  sectionLabel,
  onContentUpdated,
  onClose,
}: {
  sectionId: string;
  sectionLabel?: string;
  onContentUpdated: (content: string) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content: `Je peux réviser n'importe quelle partie de ${sectionLabel ?? "cette section"}. Dis-moi ce que tu veux changer — reformuler, raccourcir, approfondir, ajouter une source, changer le ton…`,
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);

  const send = useCallback(
    async (instruction: string) => {
      const text = instruction.trim();
      if (!text || streaming) return;
      setInput("");

      const userId = Date.now().toString();
      const agentId = (Date.now() + 1).toString();

      setMessages((prev) => [
        ...prev,
        { id: userId,  role: "user",  content: text },
        { id: agentId, role: "agent", content: "", streaming: true },
      ]);
      setStreaming(true);
      scrollBottom();

      try {
        const sessionId = await ensureSession();
        const resp = await fetch(`${API_BASE}/api/session/${sessionId}/revise`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId, instruction: text }),
        });

        if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let agentText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const msg = JSON.parse(line.slice(6)) as {
                content?: string;
                done?: boolean;
                updatedContent?: string;
              };

              if (msg.content) {
                agentText += msg.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === agentId ? { ...m, content: agentText } : m))
                );
                scrollBottom();
              }

              if (msg.done) {
                const finalText = agentText || "✓ Section mise à jour.";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentId ? { ...m, content: finalText, streaming: false } : m
                  )
                );
                if (msg.updatedContent) onContentUpdated(msg.updatedContent);
              }
            } catch { /* skip malformed */ }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentId
              ? { ...m, content: "Une erreur s'est produite — réessaie.", streaming: false }
              : m
          )
        );
      } finally {
        setStreaming(false);
        scrollBottom();
      }
    },
    [streaming, sectionId, onContentUpdated]
  );

  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-gray-800">Révision IA</span>
          <span className="text-xs text-gray-400 ml-2">{sectionLabel}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "agent" && (
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-tr-sm"
                    : "bg-gray-50 text-gray-700 border border-gray-100 rounded-tl-sm"
                }`}
              >
                {msg.content || (msg.streaming && (
                  <div className="flex gap-1.5 items-center py-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-gray-400"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Suggestions (only when no user messages yet) */}
        {messages.length === 1 && (
          <div className="pt-1 space-y-1.5">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide px-1">Suggestions</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 border border-gray-100 hover:border-purple-200 rounded-xl px-3 py-2 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Reformule le chapitre 2, ajoute une source…"
            rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="w-9 h-9 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-1 px-1">Enter pour envoyer · Shift+Enter pour nouvelle ligne</p>
      </div>
    </div>
  );
}
