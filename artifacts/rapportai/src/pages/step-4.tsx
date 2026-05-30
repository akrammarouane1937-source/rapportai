import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";

export default function Step4() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLocked = !report.partieI || !report.partieII;

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 4,
    autoSend: isLocked ? undefined : "Démarre.",
    onSectionGenerated: (section, content) => {
      if (section === "resume") updateReport({ resumeFr: content });
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  const previewContent = report.resumeFr ?? "";

  return (
    <Layout stepName="Résumé & Abstract" stepNumber={4}
      previewPanel={<PreviewPanel activeSection="resume" content={previewContent} />}
    >
      {isLocked ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
            </svg>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-gray-800 text-base">Le résumé se rédige après le rapport</p>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              Termine les Parties I et II d'abord — l'agent lira tout ton rapport pour rédiger un vrai résumé académique.
            </p>
          </div>
          <button
            onClick={() => setLocation("/rapport/partie-i")}
            className="mt-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#7c3aed" }}
          >
            Aller à Partie I →
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
          {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
          <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
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
      )}
      {!isLocked && (
        <div className="shrink-0 border-t border-border">
          <ChatInput
            isGenerating={isThinking || isGenerating}
            onAbort={abort}
            onSend={(text, files) => send(text, files)}
            disabled={isThinking || isGenerating}
            placeholder="Réponds naturellement..."
          />
        </div>
      )}
    </Layout>
  );
}
