import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";
import { FileText, Sparkles } from "lucide-react";

// ─── Choice phase shown before the conversation starts ───────────────────────

function SommaireChoice({ onChoice }: { onChoice: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 py-12">
      <div className="text-center space-y-1">
        <p className="text-base font-medium text-foreground">Pour le sommaire, comment tu veux procéder ?</p>
        <p className="text-sm text-muted-foreground">Le plan structure tout ce qui suit — chapitres, parties, sections.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button
          onClick={() => onChoice("J'ai déjà un plan existant à partager.")}
          className="flex-1 flex items-start gap-3 rounded-xl border border-border bg-card hover:bg-muted/50 p-4 text-left transition-colors"
        >
          <FileText className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">J'ai un plan</p>
            <p className="text-xs text-muted-foreground mt-0.5">Envoie un fichier ou tape ton plan — je l'adapte et le formate.</p>
          </div>
        </button>

        <button
          onClick={() => onChoice("Génère un plan depuis mon thème et mon profil.")}
          className="flex-1 flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/60 dark:border-purple-900 dark:bg-purple-950/30 p-4 text-left transition-colors"
        >
          <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Génère automatiquement</p>
            <p className="text-xs text-muted-foreground mt-0.5">Je propose un plan complet basé sur ton thème — tu valides ou modifies avant de générer.</p>
          </div>
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Dans les deux cas, tu verras le plan avant qu'il soit généré et tu pourras demander des modifications.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Step5() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [stepDone, setStepDone] = useState(() => !!report.sommaire);
  // Choice is already made if there's a saved conversation or sommaire exists
  const [choiceMade, setChoiceMade] = useState(() => {
    if (report.sommaire) return true;
    try {
      const raw = localStorage.getItem("rapportai_chat_step5");
      if (raw) {
        const parsed = JSON.parse(raw) as unknown[];
        return Array.isArray(parsed) && parsed.length > 0;
      }
    } catch { /* corrupt */ }
    return false;
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  // No autoSend — we call send() directly when the user picks a path.
  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 5,
    onSectionGenerated: (section, content) => {
      if (section === "sommaire") {
        updateReport({ sommaire: content });
        setStepDone(true);
      }
    },
    onStepComplete: () => setStepDone(true),
  });

  // Live preview: extract the latest plan structure from the chat so the preview
  // updates as soon as the agent proposes a version — before generate_section fires.
  const liveContent = useMemo(() => {
    const lastAgent = [...messages].reverse().find(
      (m) => m.role === "agent" && typeof m.content === "string"
    );
    if (!lastAgent || typeof lastAgent.content !== "string") return null;
    const txt = lastAgent.content.trim();
    // Only treat it as a plan preview if it has multiple heading lines
    const headings = (txt.match(/^#{1,3}\s+.+/gm) ?? []).length;
    return headings >= 2 ? txt : null;
  }, [messages]);

  const previewContent = liveContent ?? report.sommaire ?? "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  // Called when user clicks a choice button or types directly
  const handleChoice = (msg: string, files?: File[]) => {
    setChoiceMade(true);
    send(msg, files, { silent: true });
  };

  const handleSend = (text: string, files?: File[]) => {
    if (!choiceMade) {
      handleChoice(text, files);
      return;
    }
    if (stepDone) setStepDone(false);
    send(text, files);
  };

  return (
    <Layout
      stepName="Sommaire"
      stepNumber={5}
      previewPanel={<PreviewPanel activeSection="sommaire" content={previewContent} maxStep={5} isGenerating={isThinking || isGenerating} />}
    >
      <div className="flex-1 overflow-y-auto flex flex-col py-4 px-2 md:py-5 md:px-3">

        {/* Choice screen — shown before any conversation */}
        {!choiceMade && messages.length === 0 && (
          <SommaireChoice onChoice={handleChoice} />
        )}

        {/* Conversation */}
        {(choiceMade || messages.length > 0) && (
          <>
            {messages.map((m) => (
              <ChatMessage key={m.id} role={m.role} content={m.content} />
            ))}
            <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
            {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
          </>
        )}

        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Sommaire prêt"
            subtitle="On passe à l'introduction générale."
            onNext={() => { updateReport({ currentStep: 6 }); setLocation("/rapport/step-6"); }}
            nextLabel="Étape 6 : Introduction"
          />
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border">
        <ChatInput
          isGenerating={isThinking || isGenerating}
          onAbort={abort}
          onSend={handleSend}
          disabled={isThinking || isGenerating}
          placeholder={
            !choiceMade
              ? "Ou tape / colle ton plan ici directement..."
              : stepDone
              ? "Demander une modification du sommaire..."
              : "Modifier le plan, ajouter une section..."
          }
        />
      </div>
    </Layout>
  );
}
