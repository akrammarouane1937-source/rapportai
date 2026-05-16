import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";

type Phase = "motsCles" | "generating" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function Step4() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, isGenerating, toolCalls, streamedContent, error } = useGenerate();
  const [phase, setPhase] = useState<Phase>("motsCles");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      content: (
        <div>
          <p>Je vais générer ton résumé (français) et ton abstract (anglais) depuis ton thème.</p>
          <p className="mt-2">Tu veux ajouter des mots-clés spécifiques ? <span className="text-muted-foreground">(ou tape "non" pour passer)</span></p>
        </div>
      ),
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const handleSend = async (text: string) => {
    const t = text.trim();
    const skip = /^(non|passer|\/|-)$/i.test(t);

    if (phase === "motsCles") {
      if (!skip && t) {
        const kws = t.split(/[,;]+/).map((k) => k.trim()).filter(Boolean);
        updateReport({ motsCles: kws });
      }
      push(
        { role: "user", content: skip ? "Passer" : t },
        { role: "agent", content: (
          <div>
            <p>Les abréviations (MPT, VaR, etc.) — <strong>je m'en occupe automatiquement</strong> à la fin quand tout le rapport est écrit. Rien à faire de ta part.</p>
            <p className="mt-2">Je génère maintenant ton résumé et ton abstract...</p>
          </div>
        )}
      );
      setPhase("generating");
      const resumeFr = await generate("resume", report);
      if (!resumeFr) {
        push({ role: "agent", content: "❌ Génération échouée. Vérifie ta connexion et réessaie." });
        setPhase("motsCles");
        return;
      }
      updateReport({ resumeFr });
      const abstractEn = await generate("abstract", { ...report, resumeFr });
      if (abstractEn) updateReport({ abstractEn });
      push({ role: "agent", content: "Résumé (FR) + Abstract (EN) générés ✅" });
      setPhase("done");
    } else if (phase === "done") {
      push({ role: "user", content: t });
      push({ role: "agent", content: "Je révise..." });
      const resumeFr = await generate("resume", report, t);
      if (resumeFr) {
        updateReport({ resumeFr });
        push({ role: "agent", content: "Résumé mis à jour ✅" });
      } else {
        push({ role: "agent", content: "❌ Révision échouée. Réessaie." });
      }
    }
  };

  const previewContent =
    (report.motsCles?.length ? `**Mots-clés :** ${report.motsCles.join(", ")}\n\n` : "") +
    (report.resumeFr ? `## Résumé\n\n${report.resumeFr}\n\n` : "") +
    (report.abstractEn ? `## Abstract\n\n${report.abstractEn}` : "") ||
    streamedContent;

  return (
    <Layout
      stepName="Résumé & Abstract"
      stepNumber={4}
      previewPanel={<PreviewPanel activeSection="resume" content={previewContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {toolCalls.map((tc, i) => <ToolCallCard key={i} name={tc.name} status={tc.status} />)}
        {isGenerating && <ChatMessage role="agent" content="Génération en cours..." isTyping />}
        {error && !isGenerating && <ChatMessage role="agent" content={`❌ Erreur serveur : ${error}`} />}
        {phase === "done" && !isGenerating && (
          <StepTransitionCard
            title="Résumé & Abstract prêts"
            subtitle="Je génère maintenant le sommaire de ton rapport."
            onNext={() => { updateReport({ currentStep: 5 }); setLocation("/rapport/step-5"); }}
            nextLabel="Étape 5 — Sommaire"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput
          onSend={handleSend}
          disabled={isGenerating || phase === "generating"}
          placeholder={
            phase === "motsCles" ? "Mots-clés séparés par virgule (ou 'non')..." :
            phase === "done" ? "Demander une modification..." : ""
          }
        />
      </div>
    </Layout>
  );
}
