import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore, type Report } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";
import { ArrowLeft } from "lucide-react";

function buildTableauxContext(report: Report): string {
  const lines: string[] = ["Démarre. Génère la liste académique des tableaux de ce rapport."];

  if (report.theme) lines.push(`\nThème du rapport : ${report.theme}`);

  if (report.partieI?.trim()) {
    const preview = report.partieI.length > 4000
      ? report.partieI.slice(0, 4000) + "\n[...tronqué]"
      : report.partieI;
    lines.push(`\nPartie I (extraire les références aux tableaux) :\n${preview}`);
  }

  if (report.partieII?.trim()) {
    const preview = report.partieII.length > 4000
      ? report.partieII.slice(0, 4000) + "\n[...tronqué]"
      : report.partieII;
    lines.push(`\nPartie II (extraire les références aux tableaux) :\n${preview}`);
  }

  return lines.join("\n");
}

export default function ListeTableauxPage() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [done, setDone] = useState(() => Boolean(report.listeDesTableaux?.trim()));
  const bottomRef = useRef<HTMLDivElement>(null);

  const contextRef = useRef<string | null>(null);
  if (contextRef.current === null) {
    contextRef.current = buildTableauxContext(report);
  }

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 11,
    autoSend: contextRef.current,
    onSectionGenerated: (section, content) => {
      if (section === "liste-tableaux") {
        updateReport({ listeDesTableaux: content });
        setDone(true);
      }
    },
    onStepComplete: () => setDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout
      stepName="Liste des tableaux"
      stepNumber={8}
      previewPanel={
        <PreviewPanel
          activeSection="liste-tableaux"
          content={report.listeDesTableaux ?? ""}
          maxStep={99}
        />
      }
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} />
        ))}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {done && !isThinking && !isGenerating && (
          <div className="ml-11 mt-4 mb-6">
            <button
              onClick={() => setLocation("/rapports")}
              className="flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 border border-violet-200 rounded-xl px-4 py-2.5 bg-violet-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à Mon Rapport
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border">
        <ChatInput
          isGenerating={isThinking || isGenerating}
          onAbort={abort}
          onSend={(text, files) => {
            if (done) setDone(false);
            send(text, files);
          }}
          disabled={isThinking || isGenerating}
          placeholder={done ? "Demander une modification de la liste..." : "Réponds naturellement..."}
        />
      </div>
    </Layout>
  );
}
