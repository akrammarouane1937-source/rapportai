import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Sparkles, ArrowRight, Loader2, Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { WordPreview } from "@/components/report/WordPreview";
import { useGenerate } from "@/lib/useGenerate";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { saveReport, getReport } from "@/lib/reportStore";

const DEFAULT_DEDICACES = `À mes chers parents, pour leur amour inconditionnel, leurs sacrifices et leur soutien indéfectible tout au long de mon parcours.

À mes frères et sœurs, pour leur présence et leurs encouragements constants.

À mes ami(e)s et camarades de promotion, pour les moments de solidarité et de partage.

À tous ceux qui ont cru en moi.`;

const DEFAULT_REMERCIEMENTS = `Je tiens à exprimer ma profonde gratitude à mon encadrant pédagogique pour ses précieux conseils, sa disponibilité et sa rigueur scientifique qui ont été des atouts essentiels dans la réalisation de ce travail.

Mes remerciements vont également à l'équipe pédagogique pour la qualité de la formation dispensée tout au long de mon cursus universitaire.

Je remercie sincèrement l'ensemble du corps professoral et administratif pour leur engagement et leur soutien constant.

Enfin, je souhaite remercier ma famille et mes proches pour leur soutien moral inestimable.`;

function buildPreviewHtml(dedicaces: string, remerciements: string): string {
  const fmt = (text: string) =>
    text.trim()
      ? text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("")
      : "<p><em>(Non renseigné)</em></p>";
  return `<h2>Dédicaces</h2>${fmt(dedicaces)}<h2>Remerciements</h2>${fmt(remerciements)}`;
}

export default function Step3Page() {
  const [, setLocation] = useLocation();
  const stored = getReport();

  const [dedicaces,      setDedicaces]      = useState(stored.dedicaces      || "");
  const [remerciements,  setRemerciements]  = useState(stored.remerciements  || "");
  const [genDed,  setGenDed]  = useState(false);
  const [genRem,  setGenRem]  = useState(false);

  const rawDedRef = useRef("");
  const rawRemRef = useRef("");

  const previewHtml = buildPreviewHtml(
    dedicaces || DEFAULT_DEDICACES,
    remerciements || DEFAULT_REMERCIEMENTS,
  );

  const wordCount = (dedicaces + " " + remerciements)
    .split(/\s+/).filter(Boolean).length || 230;

  /* ── Dédicaces stream ── */
  const onChunkDed = useCallback((chunk: string) => {
    rawDedRef.current += chunk;
    setDedicaces(rawDedRef.current);
  }, []);
  const onDoneDed = useCallback(() => {
    setGenDed(false);
    saveReport({ dedicaces: rawDedRef.current });
  }, []);
  const { generate: genDedFn } = useGenerate({ onChunk: onChunkDed, onDone: onDoneDed });

  const handleGenDedicaces = () => {
    rawDedRef.current = "";
    setDedicaces("");
    setGenDed(true);
    genDedFn({
      section: "dedicaces",
      theme: stored.theme || "Rapport académique",
      school: stored.school || "École",
      filiere: stored.filiere || "",
    });
  };

  /* ── Remerciements stream ── */
  const onChunkRem = useCallback((chunk: string) => {
    rawRemRef.current += chunk;
    setRemerciements(rawRemRef.current);
  }, []);
  const onDoneRem = useCallback(() => {
    setGenRem(false);
    saveReport({ remerciements: rawRemRef.current });
  }, []);
  const { generate: genRemFn } = useGenerate({ onChunk: onChunkRem, onDone: onDoneRem });

  const handleGenRemerciements = () => {
    rawRemRef.current = "";
    setRemerciements("");
    setGenRem(true);
    genRemFn({
      section: "remerciements",
      theme: stored.theme || "Rapport académique",
      school: stored.school || "École",
      filiere: stored.filiere || "",
      encadrantPeda: stored.encadrantPeda,
    } as Parameters<typeof genRemFn>[0]);
  };

  const handleContinue = () => {
    saveReport({
      dedicaces: dedicaces || undefined,
      remerciements: remerciements || undefined,
    });
    setLocation("/rapport/step-4");
  };

  return (
    <StepLayout stepId={3} fullHeight>
      <div className="flex h-full overflow-hidden">

        {/* LEFT — Form 38% */}
        <div className="overflow-y-auto flex-shrink-0 flex flex-col" style={{ width: "38%", borderRight: "1px solid #e5e7eb" }}>
          <div className="flex-1 p-6 space-y-6 pb-32">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Dédicaces & Remerciements
              </h1>
              <p className="text-xs text-gray-400">Deux sections courtes et personnelles. L'IA peut les rédiger pour toi.</p>
            </motion.div>

            {/* Dédicaces */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-pink-400" /> Dédicaces
                </label>
                <span className="text-xs text-gray-400">{dedicaces.split(/\s+/).filter(Boolean).length} mots</span>
              </div>

              {/* AI hint card */}
              <div className="rounded-xl bg-pink-50 border border-pink-100 p-3 mb-3">
                <p className="text-xs text-pink-600">Dédie ton travail à ta famille, tes amis ou toute personne qui t'a soutenu.</p>
              </div>

              <textarea
                value={dedicaces}
                onChange={e => setDedicaces(e.target.value)}
                rows={8}
                placeholder={DEFAULT_DEDICACES}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-200"
              />
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={handleGenDedicaces}
                  disabled={genDed}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  {genDed
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Génération...</>
                    : <><Sparkles className="w-3 h-3" /> Laisser l'IA rédiger</>
                  }
                </button>
                {dedicaces && (
                  <button onClick={() => setDedicaces("")} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {/* Remerciements */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400" /> Remerciements
                </label>
                <span className="text-xs text-gray-400">{remerciements.split(/\s+/).filter(Boolean).length} mots</span>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 mb-3">
                <p className="text-xs text-amber-600">Remercie ton encadrant, tes professeurs, et ton entreprise d'accueil.</p>
              </div>

              <textarea
                value={remerciements}
                onChange={e => setRemerciements(e.target.value)}
                rows={8}
                placeholder={DEFAULT_REMERCIEMENTS}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-200"
              />
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={handleGenRemerciements}
                  disabled={genRem}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  {genRem
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Génération...</>
                    : <><Sparkles className="w-3 h-3" /> Laisser l'IA rédiger</>
                  }
                </button>
                {remerciements && (
                  <button onClick={() => setRemerciements("")} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
                    Effacer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sticky button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0">
            <Button
              onClick={handleContinue}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
            >
              Suivant — Résumé & Abstract <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* RIGHT — Word preview 62% */}
        <div className="flex-1 overflow-hidden">
          <WordPreview
            content={previewHtml}
            rawContent={(dedicaces || DEFAULT_DEDICACES) + "\n\n" + (remerciements || DEFAULT_REMERCIEMENTS)}
            sectionTitle="Dédicaces et Remerciements"
            wordCount={wordCount}
          />
        </div>
      </div>
    </StepLayout>
  );
}
