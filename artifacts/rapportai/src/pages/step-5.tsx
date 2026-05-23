import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";

export default function Step5() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 5,
    initialMessage: "Je génère le sommaire de ton rapport...",
    autoSend: "Génère le sommaire maintenant.",
    onSectionGenerated: (section, content) => {
      if (section === "sommaire") updateReport({ sommaire: content });
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout stepName="Sommaire" stepNumber={5}
      previewPanel={<PreviewPanel activeSection="sommaire" content={report.sommaire ?? ""} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc) => <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />)}
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Sommaire prêt"
            subtitle="On passe à l'introduction générale."
            onNext={() => { updateReport({ currentStep: 6 }); setLocation("/rapport/step-6"); }}
            nextLabel="Étape 6 : Introduction"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border">
        <ChatInput
          isGenerating={isThinking || isGenerating}
          onAbort={abort}
          onSend={send}
          disabled={isThinking || isGenerating}
          placeholder="Demander une modification du sommaire..."
        />
      </div>
    </Layout>
  );
}
