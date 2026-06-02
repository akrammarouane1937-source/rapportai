import { useState, useRef, useEffect } from "react";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";
import { Layout } from "@/components/layout";
import { ChatMessage, AgentSteps } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { PreviewPanel } from "@/components/preview-panel";

export default function Step11() {
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const previewContent = report.listeDesTableaux
    ? `## Liste des tableaux\n\n${report.listeDesTableaux}`
    : "";

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } =
    useConversation({
      step: 11,
      autoSend: "Génère la liste des tableaux.",
      onSectionGenerated: (section, content) => {
        if (section === "liste-tableaux") updateReport({ listeDesTableaux: content });
      },
      onStepComplete: () => setStepDone(true),
    });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout
      stepName="Liste des Tableaux"
      stepNumber={11}
      previewPanel={
        <PreviewPanel
          activeSection="liste-tableaux"
          content={previewContent}
          maxStep={11}
          isGenerating={isThinking || isGenerating}
        />
      }
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} />
        ))}
        <AgentSteps
          toolCalls={toolCalls}
          thinkingText={thinkingText}
          isGenerating={isGenerating}
        />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}

        {stepDone && !isThinking && !isGenerating && (
          <div className="ml-11 mt-4 mb-6">
            <p className="text-sm text-muted-foreground">
              Rapport complet ! Va dans "Mon Rapport" pour exporter.
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-background p-3 md:p-4">
        <ChatInput
          onSend={send}
          onAbort={abort}
          isGenerating={isThinking || isGenerating}
          disabled={stepDone}
        />
      </div>
    </Layout>
  );
}
