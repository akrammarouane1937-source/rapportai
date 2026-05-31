import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, AgentSteps, StepTransitionCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { DynamicUploadCard } from "@/components/upload-card";
import { setFileCardState } from "@/lib/fileCardState";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";
import { useFileStore } from "@/lib/fileStore";
import { getApprovedFigures } from "@/lib/figureStore";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Phase = "confirm" | "sources" | "figures" | "generating" | "retry" | "done";

// Stable message IDs — never use array index as React key
let msgCounter = 0;
function nextId() { return `msg2-${++msgCounter}`; }

type Msg = { id: string; role: "agent" | "user"; content: React.ReactNode };

type FigureInput = { figureNumber: number; title: string; source: string; author: string; caption: string; placement: string };

export default function PartieII() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, abort, isGenerating, toolCalls, streamedContent, thinkingText, error } = useGenerate();
  const addFiles = useFileStore((s) => s.addFiles);

  const titleFromStore = report.partieIITitle || "Partie II : Étude empirique";
  const chaptersFromStore = report.partieIIChapters || 2;
  const injectedContext = report.pendingContextInjection || "";

  // Persist uploaded files and approved figures in refs so revision and retry
  // calls always carry the same context as the original generation
  const sourceFilesRef = useRef<File[]>([]);
  const figureFilesRef = useRef<File[]>([]);
  const approvedFiguresRef = useRef<FigureInput[]>([]);

  // Track upload-card IDs so generation callbacks can update their progress state
  const fileCardIdsRef = useRef<string[]>([]);

  // Retry function stored in ref so inline button never captures stale closure
  const retryFnRef = useRef<(() => Promise<void>) | null>(null);

  // Mirror refs in state only for UI badge counts
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [figureFiles, setFigureFiles] = useState<File[]>([]);

  const hasPartieII = Boolean(report.partieII?.trim());

  const [phase, setPhase] = useState<Phase>(() => hasPartieII ? "done" : "confirm");

  const [msgs, setMsgs] = useState<Msg[]>(() => {
    if (hasPartieII) {
      const wc = report.partieII.split(/\s+/).filter(Boolean).length;
      return [{
        id: nextId(),
        role: "agent",
        content: (
          <div>
            <p className="font-semibold">Partie II déjà générée</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {wc.toLocaleString("fr-FR")} mots · {chaptersFromStore} chapitres.
              Dis-moi ce que tu veux modifier, ou passe aux annexes.
            </p>
          </div>
        ),
      }];
    }
    return [{
      id: nextId(),
      role: "agent",
      content: (
        <div>
          <p>Excellente progression 💪 On attaque la Partie II. D'après ton sommaire :</p>
          <p className="mt-2 font-semibold">"{titleFromStore}"</p>
          <p className="mt-1 text-muted-foreground text-sm">{chaptersFromStore} chapitre(s) prévu(s). C'est toujours bon ?</p>
          {injectedContext && (
            <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
              Contexte Partie I chargé. La génération tiendra compte de ta partie théorique pour assurer la cohérence.
            </p>
          )}
        </div>
      ),
    }];
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  // ── Core generation runner — used by figures phase and retry ────────────────
  const runGeneration = async (extraContext?: string) => {
    const allFiles = [...sourceFilesRef.current, ...figureFilesRef.current];
    const figuresForII = approvedFiguresRef.current;
    const cardIds = [...fileCardIdsRef.current];

    let cardErrorHandled = false;
    const uploadCallbacks = cardIds.length > 0 ? {
      onUploadProgress: (pct: number) => {
        cardIds.forEach((id) => setFileCardState(id, { status: "uploading", progress: pct }));
      },
      onUploadDone: () => {
        cardIds.forEach((id) => setFileCardState(id, { status: "processing" }));
      },
      onError: (msg: string) => {
        cardErrorHandled = true;
        cardIds.forEach((id) => setFileCardState(id, { status: "error", errorMessage: msg }));
      },
    } : undefined;

    const partieII = await generate(
      "partie-ii",
      report,
      extraContext || undefined,
      allFiles.length > 0 ? allFiles : undefined,
      figuresForII.length > 0 ? figuresForII : undefined,
      uploadCallbacks
    );

    if (partieII) {
      cardIds.forEach((id) => setFileCardState(id, { status: "ready" }));
    } else if (!cardErrorHandled) {
      cardIds.forEach((id) => setFileCardState(id, { status: "error", errorMessage: "Génération échouée" }));
    }

    if (!partieII) {
      retryFnRef.current = async () => {
        push({ id: nextId(), role: "agent", content: "Je relance la génération..." });
        setPhase("generating");
        await runGeneration(extraContext);
      };

      push({
        id: nextId(),
        role: "agent",
        content: (
          <div>
            <p className="text-sm text-red-700 mb-2">Génération échouée.</p>
            <button
              onClick={() => retryFnRef.current?.()}
              className="flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 border border-violet-200 rounded-lg px-3 py-1.5 bg-violet-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réessayer
            </button>
          </div>
        ),
      });
      setPhase("retry");
      return;
    }

    updateReport({ partieII });
    const wc = partieII.split(/\s+/).filter(Boolean).length;
    push({
      id: nextId(),
      role: "agent",
      content: (
        <div>
          <p>Partie II complète</p>
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
  };

  const handleSend = async (text: string, files?: File[]) => {
    if (phase === "generating") return;

    const t = text.trim();
    const skip = /^(non|passer|\/|-)$/i.test(t) || (!t && (!files || files.length === 0));
    const ok = /^(oui|ok|yes|ouais|yep|c'est bon|ça marche|d'acc)/i.test(t);

    if (phase === "confirm") {
      if (!ok && t && !skip) {
        updateReport({ partieIITitle: t });
        push(
          { id: nextId(), role: "user", content: t },
          { id: nextId(), role: "agent", content: `Titre mis à jour : "${t}". C'est bon maintenant ?` }
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
                    Pour la partie pratique, les données, études de cas et articles de référence seront intégrés directement dans le texte avec citations exactes.
                  </p>
                </div>
              </div>
              <p className="text-sm">Uploade tes sources et données (PDF, Word, Excel, CSV, code, TXT…) ou tape "non".</p>
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
        push({ id: nextId(), role: "user", content: `${files.length} fichier(s) uploadé(s)` });
        files.forEach((f) => {
          const cardId = nextId();
          setFileCardState(cardId, { status: "uploading", progress: 0 });
          fileCardIdsRef.current = [...fileCardIdsRef.current, cardId];
          push({ id: cardId, role: "agent", content: <DynamicUploadCard file={f} cardId={cardId} /> });
        });
        const preApproved = getApprovedFigures().filter((f) => f.placement === "Partie II");
        push({
          id: nextId(),
          role: "agent",
          content: preApproved.length > 0
            ? `Fichiers reçus. ✓ ${preApproved.length} figure${preApproved.length > 1 ? "s" : ""} Partie II déjà dans ta bibliothèque. Tu veux ajouter d'autres fichiers graphiques ? (ou 'non')`
            : "Fichiers reçus. Tu veux uploader des figures ou graphiques ? (ou 'non')",
        });
      } else {
        const preApproved = getApprovedFigures().filter((f) => f.placement === "Partie II");
        push(
          { id: nextId(), role: "user", content: "Non, continuer" },
          { id: nextId(), role: "agent", content: preApproved.length > 0
              ? `✓ ${preApproved.length} figure${preApproved.length > 1 ? "s" : ""} Partie II trouvée${preApproved.length > 1 ? "s" : ""} dans ta bibliothèque. Tu veux ajouter d'autres fichiers graphiques ? (ou 'non')`
              : "Tu veux uploader des figures ou graphiques ? (ou 'non')" }
        );
      }
      setPhase("figures");

    } else if (phase === "figures") {
      if (files && files.length > 0) {
        figureFilesRef.current = files;
        setFigureFiles(files);
        addFiles(files);
        push({ id: nextId(), role: "user", content: `${files.length} figure(s) uploadée(s)` });
        files.forEach((f) => {
          const cardId = nextId();
          setFileCardState(cardId, { status: "uploading", progress: 0 });
          fileCardIdsRef.current = [...fileCardIdsRef.current, cardId];
          push({ id: cardId, role: "agent", content: <DynamicUploadCard file={f} cardId={cardId} /> });
        });
      } else {
        push({ id: nextId(), role: "user", content: skip ? "Non" : t });
      }

      // Snapshot approved figures once — persisted in ref for retry/revision
      approvedFiguresRef.current = getApprovedFigures()
        .filter((f) => f.placement === "Partie II")
        .map((f) => ({ figureNumber: f.figureNumber, title: f.title, source: f.source ?? "", author: f.author ?? "", caption: f.caption, placement: f.placement }));

      push({ id: nextId(), role: "agent", content: "Je génère la Partie II..." });
      setPhase("generating");
      if (injectedContext) updateReport({ pendingContextInjection: "" });

      await runGeneration(injectedContext || undefined);

    } else if (phase === "retry") {
      push({ id: nextId(), role: "user", content: t || "Réessayer" });
      push({ id: nextId(), role: "agent", content: "Je relance la génération..." });
      setPhase("generating");
      await runGeneration(injectedContext || undefined);

    } else if (phase === "done") {
      push({ id: nextId(), role: "user", content: t });
      push({ id: nextId(), role: "agent", content: "Je révise la Partie II..." });

      // Merge: original source/figure files + any newly attached revision files
      const allFiles = [...sourceFilesRef.current, ...figureFilesRef.current, ...(files ?? [])];
      const figuresForII = approvedFiguresRef.current;

      const partieII = await generate(
        "partie-ii",
        report,
        t,
        allFiles.length > 0 ? allFiles : undefined,
        figuresForII.length > 0 ? figuresForII : undefined
      );

      if (partieII) {
        updateReport({ partieII });
        push({ id: nextId(), role: "agent", content: "Partie II mise à jour." });
      } else {
        push({ id: nextId(), role: "agent", content: "Révision échouée. Réessaie." });
      }
    }
  };

  return (
    <Layout
      stepName="Partie II"
      stepNumber={8}
      previewPanel={<PreviewPanel activeSection="partie-ii" content={report.partieII || streamedContent} maxStep={8} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {isGenerating && <ChatMessage role="agent" content="Recherche et rédaction en cours..." isTyping />}
        {error && <ChatMessage role="agent" content={`Erreur : ${error}. Réessaie.`} />}
        {phase === "done" && !isGenerating && (
          <StepTransitionCard
            title="Partie II complétée"
            subtitle="On ajoute les annexes si tu en as, puis la conclusion."
            onNext={() => { updateReport({ currentStep: 8 }); setLocation("/rapport/annexes"); }}
            nextLabel="Annexes"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border">
        <ChatInput
          isGenerating={isGenerating}
          onAbort={abort}
          onSend={handleSend}
          disabled={isGenerating || phase === "generating"}
          placeholder={
            phase === "confirm" ? "Oui / modifier le titre..." :
            phase === "sources" ? "Uploader sources (PDF, Excel, CSV, code…) ou 'non'..." :
            phase === "figures" ? "Uploader figures ou 'non'..." :
            phase === "retry"   ? "Ou tape ici pour relancer avec contexte..." :
            phase === "done"    ? "Demander une modification..." : ""
          }
          accept={phase === "figures" ? "image/*,.pdf" : undefined}
        />
      </div>
    </Layout>
  );
}
