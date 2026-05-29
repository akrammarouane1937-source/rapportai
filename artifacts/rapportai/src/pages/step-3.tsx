import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";

const stripTitle = (text: string, title: string) =>
  text.replace(new RegExp(`^#{0,3}\\s*${title}\\s*\\n+`, "i"), "").trim();

export default function Step3() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 3,
    initialMessage: `${report.studentName ? `Bien joué ${report.studentName.split(" ")[0]}, ` : ""}la page de garde est faite. Maintenant les dédicaces — à qui tu veux dédier ton rapport ? Famille, amis, prof... ou dis-moi juste "peu importe" et je gère.`,
    onSectionGenerated: (section, content) => {
      if (section === "dedicaces") updateReport({ dedicaces: content });
      if (section === "remerciements") updateReport({ remerciements: content });
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  const previewContent =
    (report.dedicaces ? `## Dédicaces\n\n${stripTitle(report.dedicaces, "Dédicaces")}\n\n` : "") +
    (report.remerciements ? `## Remerciements\n\n${stripTitle(report.remerciements, "Remerciements")}` : "");

  return (
    <Layout stepName="Dédicaces & Remerciements" stepNumber={3}
      previewPanel={<PreviewPanel activeSection="dedicaces" content={previewContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Dédicaces & Remerciements prêts"
            subtitle="On génère maintenant ton résumé et abstract."
            onNext={() => { updateReport({ currentStep: 4 }); setLocation("/rapport/step-4"); }}
            nextLabel="Étape 4 : Résumé"
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
