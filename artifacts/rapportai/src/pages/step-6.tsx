import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
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
      ? `Le plan est bon. Pour l'introduction — y'a un contexte, une problématique ou un angle particulier que tu veux mettre en avant ? Sinon je pars de ce qu'on a.`
      : `On attaque l'introduction. Tu veux mettre en avant un contexte particulier, ou je pars directement de ton thème ?`,
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
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Introduction prête"
            subtitle="On attaque le cœur du sujet : la Partie I."
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
          onSend={(text) => send(text)}
          disabled={isThinking || isGenerating}
          placeholder="Réponds naturellement..."
        />
      </div>
    </Layout>
  );
}
