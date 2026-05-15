import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";

type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function Step5() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, isGenerating, toolCalls, streamedContent } = useGenerate();
  const [generated, setGenerated] = useState(!!report.sommaire);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", content: "Je génère le sommaire depuis la structure standard de ton rapport. Un instant..." },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didGenerate = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  useEffect(() => {
    if (!didGenerate.current && !report.sommaire) {
      didGenerate.current = true;
      generate("sommaire", report).then(() => {
        updateReport({ sommaire: streamedContent });
        setGenerated(true);
        setMsgs((p) => [...p, { role: "agent", content: "Sommaire prêt ✅ Tu peux me demander des modifications." }]);
      });
    } else if (report.sommaire && !generated) {
      setGenerated(true);
      setMsgs((p) => [...p, { role: "agent", content: "Sommaire déjà disponible ✅ Tu peux me demander des modifications." }]);
    }
  }, []);

  useEffect(() => {
    if (streamedContent && !isGenerating) {
      updateReport({ sommaire: streamedContent });
    }
  }, [streamedContent, isGenerating]);

  const handleSend = async (text: string) => {
    const t = text.trim();
    setMsgs((p) => [...p, { role: "user", content: t }]);
    setMsgs((p) => [...p, { role: "agent", content: "Je mets à jour le sommaire..." }]);
    await generate("sommaire", report, t);
    updateReport({ sommaire: streamedContent });
    setMsgs((p) => [...p, { role: "agent", content: "Sommaire mis à jour ✅" }]);
  };

  return (
    <Layout
      stepName="Sommaire"
      stepNumber={5}
      previewPanel={<PreviewPanel activeSection="sommaire" content={report.sommaire || streamedContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {toolCalls.map((tc, i) => <ToolCallCard key={i} name={tc.name} status={tc.status} />)}
        {isGenerating && <ChatMessage role="agent" content="Génération du sommaire..." isTyping />}
        {generated && !isGenerating && (
          <StepTransitionCard
            title="Sommaire prêt"
            subtitle="On passe à l'introduction générale."
            onNext={() => { updateReport({ currentStep: 6 }); setLocation("/rapport/step-6"); }}
            nextLabel="Étape 6 — Introduction"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput
          onSend={handleSend}
          disabled={isGenerating || !generated}
          placeholder="Modifier le sommaire..."
        />
      </div>
    </Layout>
  );
}
