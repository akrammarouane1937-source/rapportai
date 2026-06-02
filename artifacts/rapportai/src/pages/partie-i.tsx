import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, AgentSteps, StepTransitionCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useStepAgent } from "@/hooks/use-step-agent";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function PartieI() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasSommaire = Boolean(report.sommaire?.trim());
  const hasPartieI  = Boolean(report.partieI?.trim());

  const [stepDone, setStepDone] = useState(() => hasPartieI);

  // Build the initial auto-send message for the coordinator
  const autoSendMsg = (() => {
    if (!hasSommaire) return undefined;
    const title    = report.partieITitle    || "Cadre théorique";
    const chapters = report.partieIChapters || 2;
    if (hasPartieI) {
      const wc = report.partieI.split(/\s+/).filter(Boolean).length;
      return `Ma Partie I est déjà générée (${wc.toLocaleString("fr-FR")} mots, ${chapters} chapitres, titre : "${title}"). Je suis en mode révision.`;
    }
    return `Démarre. Mon plan : titre "${title}", ${chapters} chapitres. ${report.pendingContextInjection ? `Contexte supplémentaire : ${report.pendingContextInjection}` : ""}`;
  })();

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useStepAgent({
    step: "partie-i",
    autoSend: autoSendMsg,
    onSectionGenerated: (section, content) => {
      if (section === "partie-i") {
        updateReport({ partieI: content });
        // Clear injected context after use
        updateReport({ pendingContextInjection: "" });
      }
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  // If sommaire is missing, show a blocking message
  if (!hasSommaire) {
    return (
      <Layout
        stepName="Partie I"
        stepNumber={7}
        previewPanel={<PreviewPanel activeSection="partie-i" content="" maxStep={7} isGenerating={false} />}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 max-w-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Sommaire manquant</p>
              <p className="text-xs text-amber-700 mt-1">
                La Partie I suit la structure de ton sommaire. Génère d'abord le sommaire à l'étape 5.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/rapport/step-5")}
            className="flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retourner à l'Étape 5 — Sommaire
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      stepName="Partie I — Cadre théorique"
      stepNumber={7}
      previewPanel={
        <PreviewPanel
          activeSection="partie-i"
          content={report.partieI ?? ""}
          maxStep={7}
          isGenerating={isThinking || isGenerating}
        />
      }
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} />
        ))}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}

        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Partie I générée"
            subtitle="On passe au cadre empirique — Partie II."
            onNext={() => { updateReport({ currentStep: 8 }); setLocation("/rapport/partie-ii"); }}
            nextLabel="Partie II : Cadre empirique"
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
          placeholder={
            isGenerating
              ? "Génération en cours (5-10 min)…"
              : stepDone
              ? "Demander une modification de la Partie I…"
              : "Répondre à l'assistant…"
          }
        />
      </div>
    </Layout>
  );
}
