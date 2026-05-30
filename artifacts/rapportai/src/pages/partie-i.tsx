import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, AgentSteps, StepTransitionCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { UploadCard } from "@/components/upload-card";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";
import { useFileStore } from "@/lib/fileStore";
import { getApprovedFigures } from "@/lib/figureStore";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft } from "lucide-react";

type Phase = "blocked" | "confirm" | "sources" | "figures" | "generating" | "retry" | "done";

// Stable message IDs — never use array index as React key
let msgCounter = 0;
function nextId() { return `msg-${++msgCounter}`; }

type Msg = { id: string; role: "agent" | "user"; content: React.ReactNode };

type ApprovedFigure = ReturnType<typeof getApprovedFigures>[number];

export default function PartieI() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, abort, isGenerating, toolCalls, streamedContent, thinkingText, error } = useGenerate();
  const addFiles = useFileStore((s) => s.addFiles);

  const titleFromStore = report.partieITitle || "Partie I : Cadre théorique";
  const chaptersFromStore = report.partieIChapters || 2;
  const injectedContext = report.pendingContextInjection || "";
  const hasSommaire = Boolean(report.sommaire?.trim());

  // Persist uploaded files and approved figures in refs so revision calls
  // always have the same context as the original generation call
  const sourceFilesRef = useRef<File[]>([]);
  const figureFilesRef = useRef<File[]>([]);
  const approvedFiguresRef = useRef<ApprovedFigure[]>([]);

  // Mirror state for UI display (sourceFiles count badge etc.)
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [figureFiles, setFigureFiles] = useState<File[]>([]);

  const initialPhase: Phase = hasSommaire ? "confirm" : "blocked";

  const makeInitialMsg = (): Msg => {
    if (!hasSommaire) {
      return {
        id: nextId(),
        role: "agent",
        content: (
          <div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Sommaire manquant</p>
                <p className="text-xs text-amber-700 mt-1">
                  La Partie I nécessite un sommaire pour suivre la structure de ton rapport.
                  Génère d'abord ton sommaire à l'étape 5.
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
        ),
      };
    }

    return {
      id: nextId(),
      role: "agent",
      content: (
        <div>
          <p>On attaque la Partie I. D'après ton sommaire :</p>
          <p className="mt-2 font-semibold">"{titleFromStore}"</p>
          <p className="mt-1 text-muted-foreground text-sm">{chaptersFromStore} chapitre(s) prévu(s). C'est toujours bon ?</p>
          {injectedContext && (
            <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
              Contexte chargé. La génération tiendra compte des instructions de ton assistant principal.
            </p>
          )}
        </div>
      ),
    };
  };

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [msgs, setMsgs] = useState<Msg[]>([makeInitialMsg()]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const handleSend = async (text: string, files?: File[]) => {
    if (phase === "blocked") return;

    const t = text.trim();
    const skip = /^(non|passer|\/|-)$/i.test(t) || (!t && (!files || files.length === 0));
    const ok = /^(oui|ok|yes|ouais|yep|c'est bon|ça marche|d'acc)/i.test(t);

    if (phase === "confirm") {
      if (!ok && t && !skip) {
        const newTitle = t;
        updateReport({ partieITitle: newTitle });
        push(
          { id: nextId(), role: "user", content: t },
          { id: nextId(), role: "agent", content: `Titre mis à jour : "${newTitle}". C'est bon maintenant ?` }
        );
        return;
      }
      push(
        { id: nextId(), role: "user", content: t || "Oui" },
        {
          id: nextId(),
          role: "agent",
          content: (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Sources académiques recommandées</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Ton encadrant va vérifier tes citations. Avec tes PDFs Google Scholar j'intègre les auteurs exacts, années et DOI, impossible à contester. Sans sources les références seront génériques.
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
        sourceFilesRef.current = files;
        setSourceFiles(files);
        addFiles(files);
        push({ id: nextId(), role: "user", content: `${files.length} source(s) uploadée(s)` });
        files.forEach((f) => push({ id: nextId(), role: "agent", content: <UploadCard file={f} status="ready" /> }));
        push({
          id: nextId(),
          role: "agent",
          content: (
            <span>
              {files.length} source(s) reçue(s)<br />
              Tu veux uploader des figures ou graphiques à intégrer dans le texte ? (ou "non")
            </span>
          ),
        });
      } else {
        push(
          { id: nextId(), role: "user", content: "Non, continuer sans sources" },
          { id: nextId(), role: "agent", content: "Tu veux uploader des figures ou graphiques ? (ou 'non')" }
        );
      }
      setPhase("figures");

    } else if (phase === "figures") {
      if (files && files.length > 0) {
        figureFilesRef.current = files;
        setFigureFiles(files);
        addFiles(files);
        push({ id: nextId(), role: "user", content: `${files.length} figure(s) uploadée(s)` });
        files.forEach((f) => push({ id: nextId(), role: "agent", content: <UploadCard file={f} status="ready" /> }));
      } else {
        push({ id: nextId(), role: "user", content: skip ? "Non" : t });
      }

      // Snapshot approved figures at generation time — persisted in ref for revisions
      approvedFiguresRef.current = getApprovedFigures().filter((f) => f.placement === "Partie I");

      push({ id: nextId(), role: "agent", content: "Parfait, je génère la Partie I..." });
      setPhase("generating");
      if (injectedContext) updateReport({ pendingContextInjection: "" });

      const allFiles = [...sourceFilesRef.current, ...figureFilesRef.current, ...(files || [])];
      const figuresForI = approvedFiguresRef.current.map((f) => ({
        figureNumber: f.figureNumber,
        title: f.title,
        source: f.source ?? "",
        author: f.author ?? "",
        caption: f.caption,
        placement: f.placement,
      }));

      const partieI = await generate(
        "partie-i",
        report,
        injectedContext || undefined,
        allFiles.length > 0 ? allFiles : undefined,
        figuresForI.length > 0 ? figuresForI : undefined
      );

      if (!partieI) {
        push({ id: nextId(), role: "agent", content: "Génération échouée. Appuie sur Envoyer pour réessayer sans tout re-uploader." });
        // retry phase: files are already staged in refs — user just presses send again
        const hadFiles = allFiles.length > 0 || figuresForI.length > 0;
        setPhase(hadFiles ? "retry" : "figures");
        return;
      }

      updateReport({ partieI });
      const wc = partieI.split(/\s+/).filter(Boolean).length;
      push({
        id: nextId(),
        role: "agent",
        content: (
          <div>
            <p>Partie I complète</p>
            <div className="mt-2 p-3 rounded-lg bg-muted text-sm">
              <span className="font-semibold">{wc.toLocaleString("fr-FR")} mots</span>
              {" · "}
              <span>{chaptersFromStore} chapitres</span>
              {sourceFilesRef.current.length > 0 && <span>{" · "}{sourceFilesRef.current.length} source(s)</span>}
              {figureFilesRef.current.length > 0 && <span>{" · "}{figureFilesRef.current.length} figure(s)</span>}
            </div>
          </div>
        ),
      });
      setPhase("done");

    } else if (phase === "retry") {
      // Re-run generation with the same files and figures already stored in refs
      push({ id: nextId(), role: "agent", content: "Je relance la génération..." });
      setPhase("generating");

      const allFiles = [...sourceFilesRef.current, ...figureFilesRef.current];
      const figuresForI = approvedFiguresRef.current.map((f) => ({
        figureNumber: f.figureNumber,
        title: f.title,
        source: f.source ?? "",
        author: f.author ?? "",
        caption: f.caption,
        placement: f.placement,
      }));

      const partieI = await generate(
        "partie-i",
        report,
        injectedContext || undefined,
        allFiles.length > 0 ? allFiles : undefined,
        figuresForI.length > 0 ? figuresForI : undefined
      );

      if (!partieI) {
        push({ id: nextId(), role: "agent", content: "Génération échouée à nouveau. Appuie sur Envoyer pour réessayer." });
        setPhase("retry");
        return;
      }

      updateReport({ partieI });
      const wc = partieI.split(/\s+/).filter(Boolean).length;
      push({
        id: nextId(),
        role: "agent",
        content: (
          <div>
            <p>Partie I complète</p>
            <div className="mt-2 p-3 rounded-lg bg-muted text-sm">
              <span className="font-semibold">{wc.toLocaleString("fr-FR")} mots</span>
              {" · "}
              <span>{chaptersFromStore} chapitres</span>
              {sourceFilesRef.current.length > 0 && <span>{" · "}{sourceFilesRef.current.length} source(s)</span>}
              {figureFilesRef.current.length > 0 && <span>{" · "}{figureFilesRef.current.length} figure(s)</span>}
            </div>
          </div>
        ),
      });
      setPhase("done");

    } else if (phase === "done") {
      push({ id: nextId(), role: "user", content: t });
      push({ id: nextId(), role: "agent", content: "Je révise la Partie I..." });

      // Re-send the same files and figures used during initial generation
      const allFiles = [...sourceFilesRef.current, ...figureFilesRef.current];
      const figuresForI = approvedFiguresRef.current.map((f) => ({
        figureNumber: f.figureNumber,
        title: f.title,
        source: f.source ?? "",
        author: f.author ?? "",
        caption: f.caption,
        placement: f.placement,
      }));

      const partieI = await generate(
        "partie-i",
        report,
        t,
        allFiles.length > 0 ? allFiles : undefined,
        figuresForI.length > 0 ? figuresForI : undefined
      );

      if (partieI) {
        updateReport({ partieI });
        push({ id: nextId(), role: "agent", content: "Partie I mise à jour." });
      } else {
        push({ id: nextId(), role: "agent", content: "Révision échouée. Réessaie." });
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
        {msgs.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {isGenerating && <ChatMessage role="agent" content="Recherche et rédaction en cours..." isTyping />}
        {error && <ChatMessage role="agent" content={`Erreur : ${error}. Réessaie.`} />}
        {phase === "done" && !isGenerating && (
          <StepTransitionCard
            title="Partie I complétée"
            subtitle="On passe au cœur de ta contribution : la Partie II."
            onNext={() => { updateReport({ currentStep: 8 }); setLocation("/rapport/partie-ii"); }}
            nextLabel="Partie II"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border">
        <ChatInput
          isGenerating={isGenerating}
          onAbort={abort}
          onSend={handleSend}
          disabled={isGenerating || phase === "generating" || phase === "blocked"}
          placeholder={
            phase === "blocked"   ? "Génère d'abord le sommaire à l'étape 5..." :
            phase === "confirm"   ? "Oui / modifier le titre..." :
            phase === "sources"   ? "Uploader les sources PDF ou 'non'..." :
            phase === "figures"   ? "Uploader figures ou 'non'..." :
            phase === "retry"     ? "Appuie sur Envoyer pour relancer..." :
            phase === "done"      ? "Demander une modification..." : ""
          }
        />
      </div>
    </Layout>
  );
}
