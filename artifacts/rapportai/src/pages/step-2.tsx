import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";

function capitalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function Step2Page() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { user } = useUser();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const studentName = capitalizeName(
    user?.fullName || user?.firstName || report.studentName || ""
  );

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 2,
    initialMessage: `${studentName ? `Salut ${studentName.split(" ")[0]} 👋` : "Salut 👋"} — on attaque la page de garde. Pour ${report.school}, filière ${report.filiere}, ${report.reportType.toUpperCase()}. Dis-moi juste le nom de ton encadrant pédagogique et je m'occupe du reste.`,
    onSectionGenerated: (section, content) => {
      if (section === "page-de-garde") {
        updateReport({ pageDeGarde: content, studentName: studentName || report.studentName });
      }
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout
      stepName="Page de garde"
      stepNumber={2}
      previewPanel={<PreviewPanel activeSection="page-de-garde" content={report.pageDeGarde} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Page de garde prête"
            subtitle="On passe aux dédicaces et remerciements."
            onNext={() => { updateReport({ currentStep: 3 }); setLocation("/rapport/step-3"); }}
            nextLabel="Étape 3 : Dédicaces"
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
