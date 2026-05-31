import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Sparkles, Loader2, Plus } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";
import { ensureSession } from "@/lib/useGenerate";

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  streaming?: boolean;
};

interface AttachedItem {
  file: File;
  previewUrl?: string;
}

type RevisionFileBlock =
  | { type: "image";    name: string; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; name: string; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; name: string; source: { type: "text";   media_type: "text/plain"; data: string } };

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processRevisionFiles(files: File[]): Promise<RevisionFileBlock[]> {
  const blocks: RevisionFileBlock[] = [];
  for (const file of files) {
    if (file.type === "application/pdf") {
      const data = await readAsBase64(file);
      blocks.push({ type: "document", name: file.name, source: { type: "base64", media_type: "application/pdf", data } });
    } else if (file.type.startsWith("image/")) {
      const data = await readAsBase64(file);
      blocks.push({ type: "image", name: file.name, source: { type: "base64", media_type: file.type, data } });
    } else if (
      file.type === "text/plain" ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md")
    ) {
      const text = await file.text();
      blocks.push({ type: "document", name: file.name, source: { type: "text", media_type: "text/plain", data: text } });
    } else {
      const data = await readAsBase64(file);
      blocks.push({ type: "document", name: file.name, source: { type: "base64", media_type: file.type || "application/octet-stream", data } });
    }
  }
  return blocks;
}

function FileTypeIcon({ file }: { file: File }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "docx" || ext === "doc") {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#2B579A", fontSize: 13, fontFamily: "Georgia, serif" }}
      >
        W
      </div>
    );
  }
  if (ext === "pdf") {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#E74C3C", fontSize: 10 }}
      >
        PDF
      </div>
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
      style={{ background: "#6b7280", fontSize: 9 }}
    >
      FILE
    </div>
  );
}

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
      content: `Je peux réviser n'importe quelle partie de ${sectionLabel ?? "cette section"}. Dis-moi ce que tu veux changer : reformuler, raccourcir, approfondir, ajouter une source, changer le ton…`,
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [items, setItems] = useState<AttachedItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setItems((prev) => {
      const names = new Set(prev.map((i) => i.file.name));
      return [
        ...prev,
        ...arr
          .filter((f) => !names.has(f.name))
          .map((f) => ({
            file: f,
            previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
          })),
      ];
    });
  }, []);

  const removeItem = (idx: number) => {
    setItems((prev) => {
      const item = prev[idx];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const send = useCallback(
    async (instruction: string) => {
      const text = instruction.trim();
      if ((!text && items.length === 0) || streaming) return;
      setInput("");

      const filesToSend = [...items];
      setItems([]);
      filesToSend.forEach((i) => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });

      const userId  = Date.now().toString();
      const agentId = (Date.now() + 1).toString();

      const userLabel = text + (filesToSend.length > 0
        ? `\n\n[${filesToSend.length} fichier(s) joint(s) : ${filesToSend.map((f) => f.file.name).join(", ")}]`
        : "");

      setMessages((prev) => [
        ...prev,
        { id: userId,  role: "user",  content: userLabel },
        { id: agentId, role: "agent", content: "", streaming: true },
      ]);
      setStreaming(true);
      scrollBottom();

      try {
        const sessionId = await ensureSession();

        // Encode attached files as content blocks (same format as ChatInput / use-conversation)
        const fileBlocks = filesToSend.length > 0
          ? await processRevisionFiles(filesToSend.map((i) => i.file))
          : undefined;

        const resp = await fetch(`${API_BASE}/api/session/${sessionId}/revise`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId,
            instruction: text,
            files: fileBlocks,
          }),
        });

        if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

        const reader = resp.body.getReader();
        const dec    = new TextDecoder();
        let buf       = "";
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
              ? { ...m, content: "Une erreur s'est produite. Réessaie.", streaming: false }
              : m
          )
        );
      } finally {
        setStreaming(false);
        scrollBottom();
      }
    },
    [streaming, sectionId, onContentUpdated, items]
  );

  const canSend = (input.trim().length > 0 || items.length > 0) && !streaming;

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
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
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

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
        {/* Attached file previews */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {items.map((item, idx) =>
              item.previewUrl ? (
                <div
                  key={idx}
                  className="relative rounded-xl overflow-hidden shrink-0"
                  style={{ width: 80, height: 56 }}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  key={idx}
                  className="relative flex items-center gap-2 px-2.5 py-2 rounded-xl shrink-0"
                  style={{ background: "#f9f6ff", border: "1px solid #ede9fe", maxWidth: 180 }}
                >
                  <FileTypeIcon file={item.file} />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-xs font-medium truncate"
                      style={{ color: "#1e1b4b", maxWidth: 110 }}
                      title={item.file.name}
                    >
                      {item.file.name}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>
                      {item.file.size < 1024 * 1024
                        ? `${(item.file.size / 1024).toFixed(0)} KB`
                        : `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center hover:opacity-70"
                    style={{ background: "#ddd6fe" }}
                  >
                    <X className="w-2.5 h-2.5" style={{ color: "#7c3aed" }} />
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Textarea + buttons row */}
        <div className="flex items-end gap-2">
          {/* "+" file upload button */}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
          />
          <button
            type="button"
            title="Joindre un fichier (image, PDF, Word…)"
            onClick={() => fileRef.current?.click()}
            disabled={streaming}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 self-end mb-0.5"
            style={{ color: "#9ca3af", border: "1px solid #e5e7eb", background: "#f9fafb" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#7c3aed";
              e.currentTarget.style.borderColor = "#a78bfa";
              e.currentTarget.style.background = "#f5f0ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#9ca3af";
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.background = "#f9fafb";
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

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
            disabled={!canSend}
            className="w-9 h-9 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors self-end"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-[10px] text-gray-300 mt-1 px-1">
          Enter pour envoyer · Shift+Enter pour nouvelle ligne
        </p>
      </div>
    </div>
  );
}
