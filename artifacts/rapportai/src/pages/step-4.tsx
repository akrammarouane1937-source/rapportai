import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useStepAgent } from "@/hooks/use-step-agent";

const stripTitle = (text: string, title: string) =>
  text.replace(new RegExp(`^#{0,3}\\s*${title}\\s*\\n+`, "i"), "").trim();

export default function Step4() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(() => !!report.resumeFr);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useStepAgent({
    step: 4,
    autoSend: "Démarre.",
    onSectionGenerated: (section, content) => {
      if (section === "resume") {
        // The agent sometimes returns both Résumé FR and Abstract EN in a single "resume" block.
        // Detect and split them so each field in the store is clean.
        const abstractIdx = content.search(/^##\s*Abstract\b/im);
        if (abstractIdx > 0) {
          updateReport({
            resumeFr: content.slice(0, abstractIdx).trim(),
            abstractEn: content.slice(abstractIdx).trim(),
          });
        } else {
          updateReport({ resumeFr: content });
        }
      }
      if (section === "abstract") updateReport({ abstractEn: content });
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  // Combine both fields into a single preview string — same pattern as step-3 for dedicaces+remerciements.
  // stripTitle removes any leading ## header that the agent already embedded to avoid doubling.
  const previewContent =
    (report.resumeFr   ? `## Résumé\n\n${stripTitle(report.resumeFr, "Résumé")}\n\n`   : "") +
    (report.abstractEn ? `## Abstract\n\n${stripTitle(report.abstractEn, "Abstract")}` : "");

  return (
    <Layout stepName="Résumé & Abstract" stepNumber={4}
      previewPanel={<PreviewPanel activeSection="resume" content={previewContent} maxStep={4} isGenerating={isThinking || isGenerating} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Résumé & Abstract prêts"
            subtitle="On passe maintenant au sommaire."
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
          onSend={(text, files) => send(text, files)}
          disabled={isThinking || isGenerating}
          placeholder="Réponds naturellement..."
        />
      </div>
    </Layout>
  );
}
