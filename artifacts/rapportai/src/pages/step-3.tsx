import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { UploadCard } from "@/components/upload-card";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";

type Phase = "dedicaces" | "remerciements" | "generating" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function Step3() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, abort, isGenerating, toolCalls, streamedContent, thinkingText, error } = useGenerate();
  const [phase, setPhase] = useState<Phase>("dedicaces");
  const [dedicacesPrompt, setDedicacesPrompt] = useState("");
  const [remPromptOverride, setRemPromptOverride] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      content: `On commence par les dédicaces${report.studentName ? `, ${report.studentName.split(" ")[0]}` : ""}. À qui tu veux dédier ton travail ? (famille, amis, etc. — ou tape "IA" pour que je génère automatiquement)`,
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const handleSend = async (text: string, files?: File[]) => {
    const t = text.trim();
    const isAI = /^(ia|ai|génère|genere|auto|automatique)$/i.test(t) || !t;

    if (phase === "dedicaces") {
      // If the user is already talking about remerciements, route it there
      const isAboutRem = /remerci/i.test(t);
      if (isAboutRem) {
        push(
          { role: "user", content: t },
          { role: "agent", content: `Noté — j'ajouterai ça dans les remerciements. Et pour les dédicaces, à qui tu veux dédier ton travail ? (ou "IA" pour automatique)` }
        );
        setDedicacesPrompt("");
        setRemPromptOverride(t);
        return;
      }
      setDedicacesPrompt(isAI ? "" : t);
      push(
        { role: "user", content: t || "Laisser l'IA décider" },
        { role: "agent", content: "Les remerciements — tu veux les personnaliser ou je génère depuis tes infos (encadrant, école) ?" }
      );
      setPhase("remerciements");
    } else if (phase === "remerciements") {
      const remPrompt = isAI ? "" : t;
      // Merge any earlier remerciements-specific text the user gave during the dédicaces step
      const finalRemPrompt = [remPromptOverride, remPrompt].filter(Boolean).join(" — ") || undefined;
      push({ role: "user", content: t || "Laisser l'IA décider" });
      push({ role: "agent", content: "Je génère tes dédicaces et remerciements..." });
      setPhase("generating");
      const dedicaces = await generate("dedicaces", report, dedicacesPrompt || undefined);
      if (!dedicaces) {
        push({ role: "agent", content: "❌ Génération échouée. Vérifie ta connexion et réessaie." });
        setPhase("remerciements");
        return;
      }
      updateReport({ dedicaces });
      const remerciements = await generate("remerciements", { ...report, dedicaces }, finalRemPrompt);
      if (remerciements) updateReport({ remerciements });
      push({ role: "agent", content: "Dédicaces et remerciements rédigés ✅" });
      setPhase("done");
    } else if (phase === "done") {
      push({ role: "user", content: t });
      const targetSection = /remerci/i.test(t) ? "remerciements" : "dedicaces";
      const sectionLabel = targetSection === "remerciements" ? "remerciements" : "dédicaces";
      push({ role: "agent", content: `Je révise les ${sectionLabel}...` });
      const revised = await generate(targetSection, report, t);
      if (revised) {
        updateReport(targetSection === "remerciements" ? { remerciements: revised } : { dedicaces: revised });
        push({ role: "agent", content: `${sectionLabel.charAt(0).toUpperCase() + sectionLabel.slice(1)} mis à jour ✅` });
      } else {
        push({ role: "agent", content: "❌ Révision échouée. Réessaie." });
      }
    }
  };

  // Strip any leading title the agent may have included (e.g. "Dédicaces\n" or "# Remerciements")
  const stripTitle = (text: string, title: string) =>
    text.replace(new RegExp(`^#{0,3}\\s*${title}\\s*\\n+`, "i"), "").trim();

  const previewContent =
    (report.dedicaces ? `## Dédicaces\n\n${stripTitle(report.dedicaces, "Dédicaces")}\n\n` : "") +
    (report.remerciements ? `## Remerciements\n\n${stripTitle(report.remerciements, "Remerciements")}` : "") ||
    streamedContent;

  return (
    <Layout
      stepName="Dédicaces & Remerciements"
      stepNumber={3}
      previewPanel={<PreviewPanel activeSection="dedicaces" content={previewContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc, i) => <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />)}
        {isGenerating && <ChatMessage role="agent" content="Rédaction en cours..." isTyping />}
        {error && !isGenerating && <ChatMessage role="agent" content={`❌ Erreur serveur : ${error}`} />}
        {phase === "done" && !isGenerating && (
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
        <ChatInput isGenerating={isGenerating} onAbort={abort}
          onSend={handleSend}
          disabled={isGenerating}
          placeholder={
            phase === "dedicaces" ? "À qui dédier ton travail ? (ou 'IA')" :
            phase === "remerciements" ? "Remerciements personnalisés ? (ou 'IA')" :
            phase === "done" ? "Demander une modification..." : ""
          }
        />
      </div>
    </Layout>
  );
}
