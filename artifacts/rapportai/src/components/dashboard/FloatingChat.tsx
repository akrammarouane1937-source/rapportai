import { useState } from "react";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "jury" | "user";
  text: string;
}

const INTRO_MESSAGES: Message[] = [
  {
    id: "1",
    role: "jury",
    text: "Bonjour. Je suis ton jury IA. Commençons la simulation de ta soutenance. Quelle est la problématique principale de ton rapport ?",
  },
];

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INTRO_MESSAGES);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: input.trim() },
    ]);
    setInput("");
    // Simulate jury response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "jury",
          text: "Intéressant. Pouvez-vous préciser quelle méthodologie vous avez utilisée pour valider cette hypothèse ? Et quels sont vos critères de sélection ?",
        },
      ]);
    }, 1200);
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
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    JuryAI
                  </div>
                  <div className="text-purple-200 text-xs mt-0.5">Simulation de soutenance</div>
                </div>
              </div>
              <button
                data-testid="button-close-chat"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Pro badge */}
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pro</span>
              <span className="text-xs text-amber-700">Disponible avec le plan Pro ou Premium</span>
            </div>

            {/* Messages */}
            <div className="h-56 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed
                      ${msg.role === "jury"
                        ? "bg-white text-gray-700 border border-gray-100 rounded-tl-sm"
                        : "bg-purple-600 text-white rounded-tr-sm"
                      }
                    `}
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-100 bg-white flex items-center gap-2">
              <input
                data-testid="input-chat-message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Répondre au jury..."
                className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                data-testid="button-send-chat"
                onClick={sendMessage}
                disabled={!input.trim()}
                className="w-8 h-8 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
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
        {/* Notification dot */}
        {!open && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
}
