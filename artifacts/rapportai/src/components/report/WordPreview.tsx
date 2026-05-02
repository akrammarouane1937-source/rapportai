import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, PenLine, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatePartialDocx, downloadBlob } from "@/lib/generateDocx";
import { UpsellModal } from "@/components/report/UpsellModal";
import { getMyPlan, incrementRevision, PLAN_LIMITS } from "@/lib/userPlan";
import { getReport } from "@/lib/reportStore";

const BASE_PATH = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

interface WordPreviewProps {
  content?: string;
  rawContent?: string;
  sectionTitle?: string;
  wordCount?: number;
  blurred?: boolean;
  onContentChange?: (newContent: string) => void;
}

const MOCK_CONTENT = `
<h2>Chapitre I — Cadre théorique et revue de littérature</h2>

<h3>1.1 Introduction au cadre théorique</h3>

<p>La théorie moderne du portefeuille, telle qu'elle a été formulée par Harry Markowitz en 1952, constitue le fondement conceptuel de la présente analyse. Cette théorie révolutionnaire a profondément transformé la manière dont les investisseurs appréhendent la relation entre rendement et risque dans la construction d'un portefeuille d'actifs financiers.</p>

<p>Dans le contexte marocain, l'optimisation des portefeuilles revêt une importance particulière compte tenu des spécificités du marché financier national. La Bourse de Casablanca, principal marché organisé du Royaume, présente des caractéristiques structurelles qui nécessitent une adaptation des modèles théoriques développés dans des contextes occidentaux.</p>

<h3>1.2 La théorie de Markowitz et l'efficience des marchés</h3>

<p>Markowitz (1952) a démontré que pour un niveau de risque donné, il existe un portefeuille qui maximise le rendement espéré — et réciproquement, pour un niveau de rendement donné, il existe un portefeuille qui minimise le risque. L'ensemble de ces portefeuilles constitue ce que l'on appelle la frontière efficiente.</p>

<p>Cette approche quantitative repose sur trois hypothèses fondamentales : les investisseurs sont rationnels et averses au risque, les marchés sont efficients au sens semi-fort, et les distributions de rendements peuvent être caractérisées par leur espérance et leur variance. Ces hypothèses, bien que simplificatrices, permettent de développer un cadre analytique rigoureux et opérationnel.</p>

<h3>1.3 Évolution des modèles d'optimisation</h3>

<p>À la suite des travaux de Markowitz, Sharpe (1964) a proposé le modèle d'évaluation des actifs financiers (MEDAF), qui lie le rendement d'un actif à sa sensibilité aux fluctuations du marché. Ce coefficient de sensibilité, communément appelé bêta, est devenu l'un des outils les plus utilisés dans la gestion de portefeuille contemporaine.</p>

<p>Plus récemment, les modèles factoriels ont enrichi cette approche en introduisant des facteurs supplémentaires tels que la taille des entreprises, le ratio valeur comptable sur valeur de marché, et la momentum. Ces développements théoriques ont permis d'améliorer significativement le pouvoir explicatif des modèles d'évaluation.</p>
`;

function RevisionPanel({
  open,
  onClose,
  onRevisionLimitHit,
  content,
  onContentChange,
}: {
  open: boolean;
  onClose: () => void;
  onRevisionLimitHit: () => void;
  content: string;
  onContentChange?: (newContent: string) => void;
}) {
  const [text, setText] = useState("");
  const [isRevising, setIsRevising] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleApply = async () => {
    if (!text.trim() || isRevising) return;

    const next = incrementRevision();
    const limit = PLAN_LIMITS[next.planId].revisions;

    if (next.revisionCount > limit) {
      onRevisionLimitHit();
      return;
    }

    setIsRevising(true);
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const report = getReport();

    try {
      const resp = await fetch(`${BASE_PATH}/api/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          instruction: text,
          theme:      report.theme,
          reportType: report.reportType,
          school:     report.school,
          filiere:    report.filiere,
        }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let revised = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
            if (msg.error) throw new Error(msg.error);
            if (msg.done) break;
            if (msg.content) revised += msg.content;
          } catch (e) {
            if (e instanceof Error && e.message !== "JSON") throw e;
          }
        }
      }

      if (revised.trim()) {
        onContentChange?.(revised);
      }

      setDone(true);
      setTimeout(() => {
        setDone(false);
        setText("");
        onClose();
        if (next.revisionCount >= limit) {
          onRevisionLimitHit();
        }
      }, 1500);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsRevising(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsRevising(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="absolute top-0 right-0 h-full w-80 bg-white border-l border-gray-200 flex flex-col z-20"
          style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.08)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Révision du document
            </h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Que souhaitez-vous modifier ?
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isRevising}
                placeholder="Ex: Rends la section 1.2 plus concise et ajoute une transition vers la section suivante..."
                rows={6}
                className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300 disabled:opacity-50"
              />
            </div>

            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-purple-600 font-medium mb-1">Exemples de révisions :</p>
              {["Raccourcir ce paragraphe", "Ajouter une citation académique", "Reformuler en style académique"].map((s) => (
                <button
                  key={s}
                  onClick={() => setText(s)}
                  disabled={isRevising}
                  className="block text-xs text-purple-500 hover:text-purple-700 mt-1 disabled:opacity-50 text-left"
                >
                  {s}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {isRevising && (
              <div className="bg-purple-50 rounded-xl p-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin flex-shrink-0" />
                <p className="text-xs text-purple-600">L'IA révise le texte…</p>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-gray-100 flex flex-col gap-2">
            <Button
              onClick={handleApply}
              disabled={!text.trim() || isRevising || done}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold h-10 rounded-xl text-sm"
            >
              {done ? (
                <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Révision appliquée</span>
              ) : isRevising ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Révision en cours…</span>
              ) : "Appliquer la révision"}
            </Button>
            {isRevising && (
              <button
                onClick={handleCancel}
                className="text-xs text-gray-400 hover:text-gray-600 text-center"
              >
                Annuler
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function WordPreview({
  content,
  rawContent,
  sectionTitle = "Section",
  wordCount = 1247,
  blurred = false,
  onContentChange,
}: WordPreviewProps) {
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionUpsell, setRevisionUpsell] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const html = content || MOCK_CONTENT;

  const handleCopy = () => {
    navigator.clipboard.writeText(html.replace(/<[^>]+>/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const text = rawContent || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const blob = await generatePartialDocx(sectionTitle, text);
      const slug = sectionTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      downloadBlob(blob, `rapportai-${slug}.docx`);
    } catch (err) {
      console.error("docx export error", err);
    } finally {
      setDownloading(false);
    }
  }, [downloading, rawContent, html, sectionTitle]);

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Aperçu du document
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 gap-1.5 disabled:opacity-60"
          >
            {downloading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Export...</>
              : <><Download className="w-3.5 h-3.5" /> .docx</>
            }
          </Button>
          <Button
            onClick={() => setRevisionOpen(true)}
            size="sm"
            className="h-8 px-3 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold gap-1.5 rounded-lg"
            variant="ghost"
          >
            <PenLine className="w-3.5 h-3.5" /> Révision
          </Button>
        </div>
      </div>

      {/* A4 preview area */}
      <div className="flex-1 overflow-y-auto relative" style={{ background: "#e5e7eb" }}>
        <div className="flex justify-center py-8 px-6 min-h-full">
          <div
            className="relative w-full max-w-[680px] bg-white"
            style={{
              padding: "64px 72px",
              boxShadow: "0 4px 32px rgba(0,0,0,0.12)",
              minHeight: "calc(297mm * 0.75)",
              filter: blurred ? "blur(4px)" : "none",
              transition: "filter 0.3s ease",
            }}
          >
            {/* Page header */}
            <div className="text-center mb-8 pb-4 border-b border-gray-200">
              <p className="text-xs text-gray-400" style={{ fontFamily: "Times New Roman, serif" }}>
                {getReport().theme ?? "RapportAI"} · {getReport().annee ?? "2024–2025"}
              </p>
            </div>

            {/* Content */}
            <div
              className="word-preview-content"
              style={{
                fontFamily: "Times New Roman, serif",
                fontSize: "11pt",
                color: "#1a1a1a",
                textAlign: "justify",
                lineHeight: "1.75",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* Page number */}
            <div className="text-center mt-12 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400" style={{ fontFamily: "Times New Roman, serif" }}>— 12 —</p>
            </div>
          </div>
        </div>

        {/* Word count badge */}
        <div className="absolute bottom-4 right-4 z-10">
          <div className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm">
            {wordCount.toLocaleString("fr-FR")} mots
          </div>
        </div>
      </div>

      {/* Revision panel */}
      <RevisionPanel
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        onRevisionLimitHit={() => setRevisionUpsell(true)}
        content={html}
        onContentChange={(newContent) => {
          onContentChange?.(newContent);
          setRevisionOpen(false);
        }}
      />
      <UpsellModal
        open={revisionUpsell}
        onClose={() => setRevisionUpsell(false)}
        variant="revision-essentiel"
        currentPlan={getMyPlan().planId}
      />
    </div>
  );
}
