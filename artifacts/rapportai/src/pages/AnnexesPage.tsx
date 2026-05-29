import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";
import { Layout } from "@/components/layout";
import { ChatMessage, AgentSteps } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import type { AnnexeItem } from "@/lib/store";

const LETTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface ConvMsg {
  id: string;
  role: "agent" | "user";
  content: string;
}
let msgId = 0;
const newId = () => String(++msgId);

export default function AnnexesPage() {
  const { report, updateReport } = useReportStore();
  const [, setLocation] = useLocation();
  const items: AnnexeItem[] = report.annexeItems ?? [];
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ConvMsg[]>([
    {
      id: newId(),
      role: "agent",
      content: `Bonjour${report.studentName ? ` ${report.studentName.split(" ")[0]}` : ""} 👋 Je vais t'aider à construire les annexes de ton rapport.\n\nJe peux :\n- **Suggérer** quelles annexes inclure selon ton sujet et ta méthodologie\n- **Générer** un questionnaire ou guide d'entretien adapté à ton thème\n- **Formater** des données brutes que tu me colles ici\n\nTu peux aussi ajouter des annexes manuellement via le formulaire ci-dessous, ou me dire "génère les annexes" pour que je le fasse automatiquement.`,
    },
  ]);
  const [generated, setGenerated] = useState(false);
  // Track the agent message id being streamed into
  const streamingMsgIdRef = useRef<string | null>(null);

  const { generate, isGenerating, toolCalls, thinkingText, streamedContent } = useGenerate();

  const setItems = (next: AnnexeItem[]) => updateReport({ annexeItems: next });
  const addItem = () => setItems([...items, { title: "", content: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof AnnexeItem, value: string) =>
    setItems(items.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  // Stream content into the current agent message
  useEffect(() => {
    if (!streamingMsgIdRef.current || !streamedContent) return;
    const id = streamingMsgIdRef.current;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: streamedContent } : m))
    );
  }, [streamedContent]);

  // Detect generation completion
  useEffect(() => {
    if (!isGenerating && streamingMsgIdRef.current) {
      streamingMsgIdRef.current = null;
      setGenerated(true);
      // Parse generated annexes from streamed content and add to items
      const h2Matches = [...streamedContent.matchAll(/^##\s+Annexe\s+[A-Z]\s+[—–-]\s+(.+)$/gm)];
      if (h2Matches.length > 0) {
        const newItems: AnnexeItem[] = h2Matches.map((m) => ({
          title: m[1].trim(),
          content: "",
        }));
        setItems([...items, ...newItems]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isGenerating]);

  const send = async (text: string) => {
    if (isGenerating) return;

    setMessages((prev) => [...prev, { id: newId(), role: "user", content: text }]);

    const agentId = newId();
    streamingMsgIdRef.current = agentId;
    setMessages((prev) => [...prev, { id: agentId, role: "agent", content: "" }]);

    await generate("annexes", report, text);
  };

  const hasContent = items.some((a) => a.title.trim() || a.content.trim());

  return (
    <Layout stepName="Annexes" stepNumber={8}>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Chat panel */}
        <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3" style={{ minHeight: 0 }}>
          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role} content={m.content} />
          ))}
          <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
          {isGenerating && streamingMsgIdRef.current === null && (
            <ChatMessage role="agent" content="" isTyping />
          )}

          {generated && !isGenerating && (
            <div className="ml-11 mb-4 flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Annexes générées — retrouve-les dans le formulaire ci-dessous.
            </div>
          )}

          {/* Manual form */}
          <div className="ml-0 mt-6 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
              Annexes manuelles
            </p>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={{ border: "1px solid #ede9fe", background: "#fafafa" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#7c3aed", color: "#fff" }}>
                      Annexe {LETTER[i] ?? i + 1}
                    </span>
                    <button onClick={() => removeItem(i)} className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(i, "title", e.target.value)}
                    placeholder="Titre de l'annexe"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
                    style={{ border: "1px solid #e9d5ff", background: "#fff" }}
                  />
                  <textarea
                    value={item.content}
                    onChange={(e) => updateItem(i, "content", e.target.value)}
                    placeholder="Contenu (Markdown supporté)…"
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                    style={{ border: "1px solid #e9d5ff", background: "#fff", lineHeight: "1.6" }}
                  />
                </div>
              ))}

              <button
                onClick={addItem}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ border: "2px dashed #c4b5fd", color: "#7c3aed" }}
              >
                <Plus className="w-4 h-4" />
                Ajouter une annexe manuellement
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 px-1 pb-4">
            <button
              onClick={() => setLocation("/rapport/partie-ii")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Partie II
            </button>
            {hasContent && (
              <span className="text-xs text-purple-600 font-medium">
                {items.filter((a) => a.title.trim()).length} annexe{items.filter((a) => a.title.trim()).length !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={() => { updateReport({ currentStep: 9 }); setLocation("/rapport/step-9"); }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 2px 10px rgba(124,58,237,0.3)" }}
            >
              Conclusion <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div ref={bottomRef} />
        </div>

        {/* Chat input */}
        <div className="shrink-0 border-t border-border">
          <ChatInput
            isGenerating={isGenerating}
            onAbort={() => {}}
            onSend={send}
            disabled={isGenerating}
            placeholder="Demande-moi de générer un questionnaire, formater des données, suggérer des annexes…"
          />
        </div>
      </div>
    </Layout>
  );
}
