import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore, type Report } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";

/**
 * Build the silent first message sent to the Introduction agent.
 * This is never shown to the user — it gives the agent all the context
 * it needs to generate without asking redundant questions.
 */
function buildIntroContext(report: Report): string {
  const lines: string[] = ["Démarre. Voici le contexte complet du projet :"];

  if (report.theme)        lines.push(`- Thème : ${report.theme}`);
  if (report.filiere)      lines.push(`- Filière : ${report.filiere}`);
  if (report.reportType)   lines.push(`- Type : ${report.reportType}`);
  if (report.school)       lines.push(`- École : ${report.school}`);
  if (report.academicYear) lines.push(`- Année : ${report.academicYear}`);
  if (report.entreprise)   lines.push(`- Entreprise / lieu de stage : ${report.entreprise}`);

  if (report.sommaire?.trim()) {
    // Send first 2000 chars — enough to convey the full chapter structure
    const preview = report.sommaire.length > 2000
      ? report.sommaire.slice(0, 2000) + "\n[...tronqué]"
      : report.sommaire;
    lines.push(`\nSommaire validé (structure du rapport) :\n${preview}`);
  }

  // Inject orchestrator context if present (set when navigating from Mon Rapport chat)
  if (report.pendingContextInjection?.trim()) {
    lines.push(`\nContexte supplémentaire fourni par l'étudiant :\n${report.pendingContextInjection}`);
  }

  return lines.join("\n");
}

export default function Step6() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(() => !!report.introduction);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Computed once — autoSend is only consumed at mount by the hook
  const contextMessageRef = useRef<string | null>(null);
  if (contextMessageRef.current === null) {
    contextMessageRef.current = buildIntroContext(report);
  }

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 6,
    autoSend: contextMessageRef.current,
    onSectionGenerated: (section, content) => {
      if (section === "introduction") {
        updateReport({ introduction: content });
        setStepDone(true);
      }
    },
    onStepComplete: () => setStepDone(true),
  });

  // Clear pendingContextInjection after it has been consumed by buildIntroContext
  useEffect(() => {
    if (report.pendingContextInjection) {
      updateReport({ pendingContextInjection: "" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout stepName="Introduction Générale" stepNumber={6}
      previewPanel={<PreviewPanel activeSection="introduction" content={report.introduction ?? ""} maxStep={6} />}
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
          onSend={(text, files) => {
            if (stepDone) setStepDone(false);
            send(text, files);
          }}
          disabled={isThinking || isGenerating}
          placeholder={stepDone ? "Demander une modification de l'introduction..." : "Réponds naturellement..."}
        />
      </div>
    </Layout>
  );
}
