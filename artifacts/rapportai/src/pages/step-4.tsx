import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";

export default function Step4() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 4,
    initialMessage: "Je vais générer ton résumé (français) et ton abstract (anglais). Tu veux ajouter des mots-clés spécifiques ? (ou tape \"non\" pour passer)",
    onSectionGenerated: (section, content) => {
      if (section === "resume") updateReport({ resumeFr: content });
      if (section === "abstract") updateReport({ abstractEn: content });
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  const previewContent =
    (report.resumeFr ? `## Résumé\n\n${report.resumeFr}\n\n` : "") +
    (report.abstractEn ? `## Abstract\n\n${report.abstractEn}` : "");

  return (
    <Layout stepName="Résumé & Abstract" stepNumber={4}
      previewPanel={<PreviewPanel activeSection="resume" content={previewContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc) => <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />)}
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Résumé & Abstract prêts"
            subtitle="Je génère maintenant le sommaire de ton rapport."
            onNext={() => { updateReport({ currentStep: 5 }); setLocation("/rapport/step-5"); }}
            nextLabel="Étape 5 : Sommaire"
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
          placeholder="Réponds naturellement..."
        />
      </div>
    </Layout>
  );
}
