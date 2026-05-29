import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getReport } from "@/lib/reportStore";

import { API_BASE as BASE_PATH } from "@/lib/apiBase";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  streaming?: boolean;
}

const INTRO: Message = {
  id: "intro",
  role: "assistant",
  text: "Bonjour ! Je suis ton assistant IA pour ton rapport. Pose-moi n'importe quelle question : structure, formulations académiques, citations, méthodologie… Je suis là pour t'aider.",
};

export function FloatingChat() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([INTRO]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const abortRef                = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", text: "", streaming: true },
    ]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const history = [...messages, userMsg]
      .filter((m) => m.id !== "intro")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));

    const report = getReport();

    try {
      const resp = await fetch(`${BASE_PATH}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages:   history,
          mode:       "assistant",
          theme:      report.theme,
          reportType: report.reportType,
          school:     report.school,
          filiere:    report.filiere,
          studentName: report.studentName,
        }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
            if (msg.error) throw new Error(msg.error);
            if (msg.done) break;
            if (msg.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: m.text + msg.content } : m
                )
              );
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: "Désolé, une erreur est survenue. Réessayez.", streaming: false }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-80 bg-white rounded-2xl overflow-hidden"
            style={{
              boxShadow: "0 8px 40px rgba(124,58,237,0.18), 0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid rgba(124,58,237,0.12)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100"
              style={{ background: "#fff" }}
            >
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="RapportAI" className="w-7 h-7 object-contain" />
                <div>
                  <div className="text-gray-900 text-sm font-semibold leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Assistant IA
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">Pose-moi n'importe quelle question</div>
                </div>
              </div>
              <button
                data-testid="button-close-chat"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            <div className="h-64 overflow-y-auto p-4 space-y-4 bg-white">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2.5"}`}>
                  {msg.role === "assistant" && (
                    <img src="/logo.png" alt="RapportAI" className="w-5 h-5 object-contain shrink-0 mt-0.5" />
                  )}
                  {msg.role === "assistant" ? (
                    <div className="flex-1 text-xs text-gray-800 leading-relaxed">
                      {msg.text || (
                        msg.streaming && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            En train d'écrire…
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <div
                      className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-tr-sm text-xs leading-relaxed text-white"
                      style={{ background: "#7c3aed" }}
                    >
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-gray-100 bg-white flex items-center gap-2">
              <input
                data-testid="input-chat-message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={loading}
                placeholder="Comment améliorer ma Partie I ?"
                className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                data-testid="button-send-chat"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-8 h-8 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  : <Send className="w-3.5 h-3.5 text-white" />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        data-testid="button-open-chat"
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 rounded-full flex items-center justify-center relative"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
          boxShadow: "0 4px 24px rgba(124,58,237,0.4)",
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageSquare className="w-5 h-5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
        {!open && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
}
