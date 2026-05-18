import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";

export default function Step6() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 6,
    initialMessage: report.sommaire
      ? "J'ai ton sommaire et ta problématique. Tu veux ajouter un contexte particulier pour l'introduction ? (ou tape \"non\" pour que je parte de ces éléments directement)"
      : "On passe à l'introduction générale. Tu veux préciser un contexte particulier ? (ou \"non\" pour laisser l'IA décider)",
    onSectionGenerated: (section, content) => {
      if (section === "introduction") updateReport({ introduction: content });
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout stepName="Introduction Générale" stepNumber={6}
      previewPanel={<PreviewPanel activeSection="introduction" content={report.introduction ?? ""} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc) => <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />)}
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Introduction prête"
            subtitle="On attaque le cœur du sujet — la Partie I."
            onNext={() => { updateReport({ currentStep: 7 }); setLocation("/rapport/partie-i"); }}
            nextLabel="Partie I"
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
