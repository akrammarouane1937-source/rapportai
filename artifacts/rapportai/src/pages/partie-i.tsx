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
import { getApprovedFigures } from "@/lib/figureStore";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

type Phase = "confirm" | "sources" | "figures" | "generating" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function PartieI() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, abort, isGenerating, toolCalls, streamedContent, thinkingText, error } = useGenerate();
  const addFiles = useFileStore((s) => s.addFiles);
  const [phase, setPhase] = useState<Phase>("confirm");
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [figureFiles, setFigureFiles] = useState<File[]>([]);

  const titleFromStore = report.partieITitle || "Partie I — Cadre théorique";
  const chaptersFromStore = report.partieIChapters || 2;

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      content: (
        <div>
          <p>On attaque la Partie I. D'après ton sommaire :</p>
          <p className="mt-2 font-semibold">"{titleFromStore}"</p>
          <p className="mt-1 text-muted-foreground text-sm">{chaptersFromStore} chapitre(s) prévu(s). C'est toujours bon ?</p>
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
    const skip = /^(non|passer|\/|-)$/i.test(t) || (!t && (!files || files.length === 0));
    const ok = /^(oui|ok|yes|ouais|yep|c'est bon|ça marche|d'acc)/i.test(t);

    if (phase === "confirm") {
      if (!ok && t && !skip) {
        // User is editing the title
        const newTitle = t;
        updateReport({ partieITitle: newTitle });
        push(
          { role: "user", content: t },
          { role: "agent", content: `Titre mis à jour : "${newTitle}". C'est bon maintenant ?` }
        );
        return;
      }
      push(
        { role: "user", content: t || "Oui" },
        {
          role: "agent",
          content: (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Sources académiques recommandées</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Ton encadrant va vérifier tes citations. Avec tes PDFs Google Scholar j'intègre les auteurs exacts, années et DOI — impossible à contester. Sans sources les références seront génériques.
                  </p>
                </div>
              </div>
              <p className="text-sm">Uploade tes sources (articles, PDF de recherche) ou tape "non" pour continuer sans.</p>
            </motion.div>
          ),
        }
      );
      setPhase("sources");
    } else if (phase === "sources") {
      if (files && files.length > 0) {
        setSourceFiles(files);
        addFiles(files);
        push({ role: "user", content: `${files.length} source(s) uploadée(s)` });
        files.forEach((f) => push({ role: "agent", content: <UploadCard file={f} status="ready" /> }));
        push({
          role: "agent",
          content: (
            <span>
              {files.length} source(s) reçue(s) ✅<br />
              Tu veux uploader des figures ou graphiques à intégrer dans le texte ? (ou "non")
            </span>
          ),
        });
      } else {
        push(
          { role: "user", content: "Non, continuer sans sources" },
          { role: "agent", content: "Tu veux uploader des figures ou graphiques ? (ou 'non')" }
        );
      }
      setPhase("figures");
    } else if (phase === "figures") {
      if (files && files.length > 0) {
        setFigureFiles(files);
        addFiles(files);
        push({ role: "user", content: `${files.length} figure(s) uploadée(s)` });
        files.forEach((f) => push({ role: "agent", content: <UploadCard file={f} status="ready" /> }));
      } else {
        push({ role: "user", content: skip ? "Non" : t });
      }
      push({ role: "agent", content: "Parfait, je génère la Partie I..." });
      setPhase("generating");
      const allFiles = [...sourceFiles, ...figureFiles, ...(files || [])];
      const figuresForI = getApprovedFigures()
        .filter((f) => f.placement === "Partie I")
        .map((f) => ({ figureNumber: f.figureNumber, title: f.title, source: f.source ?? "", author: f.author ?? "", caption: f.caption, placement: f.placement }));
      const partieI = await generate("partie-i", report, undefined, allFiles.length > 0 ? allFiles : undefined, figuresForI.length > 0 ? figuresForI : undefined);
      if (!partieI) {
        push({ role: "agent", content: "❌ Génération échouée. Vérifie ta connexion et réessaie." });
        setPhase("figures");
        return;
      }
      updateReport({ partieI });
      const wc = partieI.split(/\s+/).filter(Boolean).length;
      push({
        role: "agent",
        content: (
          <div>
            <p>Partie I complète ✅</p>
            <div className="mt-2 p-3 rounded-lg bg-muted text-sm">
              <span className="font-semibold">{wc.toLocaleString("fr-FR")} mots</span>
              {" · "}
              <span>{chaptersFromStore} chapitres</span>
              {sourceFiles.length > 0 && <span>{" · "}{sourceFiles.length} source(s)</span>}
              {figureFiles.length > 0 && <span>{" · "}{figureFiles.length} figure(s)</span>}
            </div>
          </div>
        ),
      });
      setPhase("done");
    } else if (phase === "done") {
      push({ role: "user", content: t });
      push({ role: "agent", content: "Je révise la Partie I..." });
      const partieI = await generate("partie-i", report, t);
      if (partieI) {
        updateReport({ partieI });
        push({ role: "agent", content: "Partie I mise à jour ✅" });
      } else {
        push({ role: "agent", content: "❌ Révision échouée. Réessaie." });
      }
    }
  };

  return (
    <Layout
      stepName="Partie I"
      stepNumber={7}
      previewPanel={<PreviewPanel activeSection="partie-i" content={report.partieI || streamedContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc, i) => <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />)}
        {isGenerating && <ChatMessage role="agent" content="Recherche et rédaction en cours..." isTyping />}
        {error && <ChatMessage role="agent" content={`❌ Erreur : ${error}. Réessaie.`} />}
        {phase === "done" && !isGenerating && (
          <StepTransitionCard
            title="Partie I complétée"
            subtitle="On passe au cœur de ta contribution — la Partie II."
            onNext={() => { updateReport({ currentStep: 8 }); setLocation("/rapport/partie-ii"); }}
            nextLabel="Partie II"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border">
        <ChatInput isGenerating={isGenerating} onAbort={abort}
          onSend={handleSend}
          disabled={isGenerating || phase === "generating"}
          placeholder={
            phase === "confirm" ? "Oui / modifier le titre..." :
            phase === "sources" ? "Uploader les sources PDF ou 'non'..." :
            phase === "figures" ? "Uploader figures ou 'non'..." :
            phase === "done" ? "Demander une modification..." : ""
          }
        />
      </div>
    </Layout>
  );
}
