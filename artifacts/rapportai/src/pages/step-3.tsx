import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
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
    initialMessage: `On commence par les dédicaces${report.studentName ? `, ${report.studentName.split(" ")[0]}` : ""}. À qui tu veux dédier ton travail ? (famille, amis... ou tape "IA" pour que je m'en charge)`,
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
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc) => <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />)}
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Dédicaces & Remerciements prêts"
            subtitle="On génère maintenant ton résumé et abstract."
            onNext={() => { updateReport({ currentStep: 4 }); setLocation("/rapport/step-4"); }}
            nextLabel="Étape 4 — Résumé"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
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
