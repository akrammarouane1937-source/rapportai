import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { UploadCard } from "@/components/upload-card";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";

type Phase = "context" | "upload" | "generating" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function Step6() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, isGenerating, toolCalls, streamedContent } = useGenerate();
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

  useEffect(() => {
    if (streamedContent && !isGenerating) {
      updateReport({ introduction: streamedContent });
    }
  }, [streamedContent, isGenerating]);

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
        push({ role: "user", content: `${files.length} fichier(s) uploadé(s)` });
        files.forEach((f) => push({ role: "agent", content: <UploadCard file={f} status="ready" /> }));
      } else {
        push({ role: "user", content: skip ? "Non, continuer" : t });
      }
      push({ role: "agent", content: "Parfait, je génère l'introduction générale..." });
      setPhase("generating");
      const contextPrompt = report.checkpoints?.introContext || undefined;
      await generate("introduction", report, contextPrompt, hasFiles ? files : undefined);
      push({ role: "agent", content: `Introduction générée ✅ — ${streamedContent.split(/\s+/).filter(Boolean).length} mots` });
      setPhase("done");
    } else if (phase === "done") {
      push({ role: "user", content: t });
      push({ role: "agent", content: "Je révise l'introduction..." });
      await generate("introduction", report, t);
      updateReport({ introduction: streamedContent });
      push({ role: "agent", content: "Introduction mise à jour ✅" });
    }
  };

  return (
    <Layout
      stepName="Introduction Générale"
      stepNumber={6}
      previewPanel={<PreviewPanel activeSection="introduction" content={report.introduction || streamedContent} />}
    >
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {toolCalls.map((tc, i) => <ToolCallCard key={i} name={tc.name} status={tc.status} />)}
        {isGenerating && <ChatMessage role="agent" content="Rédaction de l'introduction..." isTyping />}
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
      <div className="p-4 border-t bg-background">
        <ChatInput
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
