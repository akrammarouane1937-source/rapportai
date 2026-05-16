import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { UploadCard } from "@/components/upload-card";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";
import { useFileStore } from "@/lib/fileStore";

type Phase = "context" | "upload" | "generating" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function Step6() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, abort, isGenerating, toolCalls, streamedContent, thinkingText, error } = useGenerate();
  const addFiles = useFileStore((s) => s.addFiles);
  const [phase, setPhase] = useState<Phase>("context");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      content: (
        <div>
          <p>On passe à l'introduction générale.</p>
          {report.sommaire && (
            <p className="mt-2 text-muted-foreground text-sm">J'ai ton sommaire et ta problématique. Tu veux ajouter un contexte particulier ou je pars directement de ces éléments ? <span className="text-foreground">(tape "non" pour laisser l'IA décider)</span></p>
          )}
          {!report.sommaire && (
            <p className="mt-2 text-muted-foreground text-sm">Tu veux préciser un contexte particulier ? <span className="text-foreground">(tape "non" pour laisser l'IA décider)</span></p>
          )}
        </div>
      ),
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const handleSend = async (text: string, files?: File[]) => {
    const t = text.trim();
    const skip = /^(non|passer|\/|-)$/i.test(t) || !t;

    if (phase === "context") {
      push(
        { role: "user", content: skip ? "Laisser l'IA décider" : t },
        { role: "agent", content: "Tu veux uploader des documents de référence ? (articles, notes encadrant — tape 'non' pour passer)" }
      );
      updateReport({ checkpoints: { ...report.checkpoints, introContext: skip ? "" : t } });
      setPhase("upload");
    } else if (phase === "upload") {
      const hasFiles = files && files.length > 0;
      if (hasFiles) {
        setUploadedFiles(files);
        addFiles(files);
        push({ role: "user", content: `${files.length} fichier(s) uploadé(s)` });
        files.forEach((f) => push({ role: "agent", content: <UploadCard file={f} status="ready" /> }));
      } else {
        push({ role: "user", content: skip ? "Non, continuer" : t });
      }
      push({ role: "agent", content: "Parfait, je génère l'introduction générale..." });
      setPhase("generating");
      const contextPrompt = report.checkpoints?.introContext || undefined;
      const introduction = await generate("introduction", report, contextPrompt, hasFiles ? files : undefined);
      if (!introduction) {
        push({ role: "agent", content: "❌ Génération échouée. Vérifie ta connexion et réessaie." });
        setPhase("upload");
        return;
      }
      updateReport({ introduction });
      push({ role: "agent", content: `Introduction générée ✅ — ${introduction.split(/\s+/).filter(Boolean).length} mots` });
      setPhase("done");
    } else if (phase === "done") {
      push({ role: "user", content: t });
      push({ role: "agent", content: "Je révise l'introduction..." });
      const introduction = await generate("introduction", report, t);
      if (introduction) {
        updateReport({ introduction });
        push({ role: "agent", content: "Introduction mise à jour ✅" });
      } else {
        push({ role: "agent", content: "❌ Révision échouée. Réessaie." });
      }
    }
  };

  return (
    <Layout
      stepName="Introduction Générale"
      stepNumber={6}
      previewPanel={<PreviewPanel activeSection="introduction" content={report.introduction || streamedContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc, i) => <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />)}
        {isGenerating && <ChatMessage role="agent" content="Rédaction de l'introduction..." isTyping />}
        {error && <ChatMessage role="agent" content={`❌ Erreur : ${error}. Réessaie.`} />}
        {phase === "done" && !isGenerating && (
          <StepTransitionCard
            title="Introduction prête"
            subtitle="On attaque le cœur du sujet — la Partie I."
            onNext={() => { updateReport({ currentStep: 7 }); setLocation("/rapport/partie-i"); }}
            nextLabel="Partie I"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput isGenerating={isGenerating} onAbort={abort}
          onSend={handleSend}
          disabled={isGenerating || phase === "generating"}
          placeholder={
            phase === "context" ? "Contexte particulier (ou 'non')..." :
            phase === "upload" ? "Uploader des docs ou tape 'non'..." :
            phase === "done" ? "Demander une modification..." : ""
          }
        />
      </div>
    </Layout>
  );
}
