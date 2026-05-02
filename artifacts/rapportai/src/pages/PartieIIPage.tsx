import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, RefreshCw, Upload, Plus, X, ExternalLink,
  Loader2, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { WordPreview } from "@/components/report/WordPreview";
import { PaywallModal } from "@/components/report/PaywallModal";
import { UpsellModal } from "@/components/report/UpsellModal";
import { useGenerate } from "@/lib/useGenerate";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { saveReport, getReport } from "@/lib/reportStore";
import { getMyPlan, PLAN_LIMITS } from "@/lib/userPlan";

const INITIAL_KEYWORDS = ["analyse empirique", "frontière efficiente", "rendement ajusté", "ratio de Sharpe", "BVC"];
const INITIAL_SOURCES = ["Fama & French (1993)", "Elton et al. (1976)", "AMMC (2023)"];

function KeywordChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 text-xs font-medium px-3 py-1.5 rounded-full">
      {label}
      <button onClick={onRemove} className="text-purple-400 hover:text-purple-700"><X className="w-3 h-3" /></button>
    </span>
  );
}

function SourceChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full">
      {label}
      <button onClick={onRemove} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
    </span>
  );
}

export default function PartieIIPage() {
  const [, setLocation] = useLocation();
  const [keywords, setKeywords] = useState(INITIAL_KEYWORDS);
  const [resultats, setResultats] = useState("");
  const [methodo, setMethodo] = useState("");
  const [chapitres, setChapitres] = useState([
    "Analyse empirique et présentation des résultats",
    "Discussion, limites et recommandations",
  ]);
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [newSource, setNewSource] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawTextRef = useRef("");

  const onChunk = useCallback((chunk: string) => {
    rawTextRef.current += chunk;
    const html = markdownToHtml(rawTextRef.current);
    const wc = rawTextRef.current.split(/\s+/).filter(Boolean).length;
    setWordCount(wc);
    setPreviewContent(html);
  }, []);

  const onDone = useCallback(() => {
    saveReport({ partieII: rawTextRef.current });
    // Check page limit after generation
    const plan = getMyPlan();
    const d = getReport();
    const totalWords = [d.introduction, d.partieI, rawTextRef.current, d.conclusion]
      .reduce((acc, s) => acc + (s ? s.split(/\s+/).filter(Boolean).length : 0), 0);
    const estimatedPages = Math.round(totalWords / 250);
    if (estimatedPages >= PLAN_LIMITS[plan.planId].pages) {
      setTimeout(() => setShowUpsell(true), 800);
    }
  }, []);
  const onPaywall = useCallback(() => { setShowPaywall(true); }, []);

  const { generate, isStreaming: generating } = useGenerate({
    onChunk,
    onDone,
    onPaywall,
    paywallWords: 600,
  });

  const handleGenerate = () => {
    rawTextRef.current = "";
    setPreviewContent("");
    setWordCount(0);
    setShowPaywall(false);
    generate({
      section: "partie-ii",
      problematique: resultats || undefined,
      motsCles: keywords,
      extraContext: methodo || undefined,
    });
  };

  const addChapitre = () => setChapitres((prev) => [...prev, ""]);
  const updateChapitre = (i: number, val: string) =>
    setChapitres((prev) => prev.map((c, idx) => (idx === i ? val : c)));
  const removeChapitre = (i: number) =>
    setChapitres((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]" style={{ height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <div className="flex-shrink-0" style={{ width: 60 }} />

      {/* Step progress header */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0 z-30">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">Étape 8 sur 9</span>
            <span className="text-xs text-gray-400">Partie II — Analyse empirique & résultats</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: "88.9%" }} />
          </div>
        </div>

        {/* Main split */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT — Form panel 38% */}
          <div className="overflow-y-auto flex-shrink-0 flex flex-col" style={{ width: "38%", borderRight: "1px solid #e5e7eb" }}>
            <div className="flex-1 p-6 space-y-5 pb-32">

              {/* AI Cadrage card */}
              <div className="rounded-2xl p-4" style={{ background: "#f5f0ff" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-bold text-purple-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Cadrage IA — Partie II
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href="https://scholar.google.com" target="_blank" rel="noopener noreferrer"
                      className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1 font-medium">
                      Google Scholar <ExternalLink className="w-3 h-3" />
                    </a>
                    <button className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1 font-medium ml-1">
                      <RefreshCw className="w-3 h-3" /> Regénérer
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw, i) => (
                    <KeywordChip key={i} label={kw} onRemove={() => setKeywords((prev) => prev.filter((_, idx) => idx !== i))} />
                  ))}
                  <button
                    onClick={() => setKeywords((prev) => [...prev, ""])}
                    className="inline-flex items-center gap-1 border border-dashed border-purple-300 text-purple-500 text-xs px-2.5 py-1.5 rounded-full hover:bg-purple-50 transition-colors">
                    <Plus className="w-3 h-3" /> Mot-clé
                  </button>
                </div>
              </div>

              {/* Résultats attendus */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Résultats obtenus / attendus
                  <span className="ml-1 text-xs font-normal text-gray-400">(guide l'IA)</span>
                </label>
                <textarea
                  value={resultats}
                  onChange={(e) => setResultats(e.target.value)}
                  rows={4}
                  placeholder="Ex : La frontière efficiente calculée montre qu'un portefeuille de 8 titres réduit le risque de 18 % à rendement égal. Le ratio de Sharpe optimal est de 1.23..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
                />
                <button
                  onClick={() => setResultats("La frontière efficiente calculée sur 30 titres du MASI confirme que la diversification sectorielle réduit le risque de 18 % pour un rendement équivalent. Le ratio de Sharpe du portefeuille optimal atteint 1.23, surpassant le benchmark MASI. Ces résultats valident partiellement l'hypothèse d'efficience faible du marché boursier marocain.")}
                  className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Laisser l'IA décider
                </button>
              </div>

              {/* Méthodologie */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Méthodologie utilisée</label>
                <textarea
                  value={methodo}
                  onChange={(e) => setMethodo(e.target.value)}
                  rows={3}
                  placeholder="Ex : Modèle moyenne-variance de Markowitz, données journalières 2018-2023, logiciel Python (scipy, pandas)..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
                />
                <button
                  onClick={() => setMethodo("Modèle moyenne-variance de Markowitz appliqué à 30 titres du MASI sur données journalières 2018-2023. Optimisation quadratique via Python (scipy.optimize), calcul du ratio de Sharpe, test de stationnarité ADF.")}
                  className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Laisser l'IA décider
                </button>
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Documents de référence <span className="text-xs font-normal text-gray-400">(optionnel)</span>
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) setUploadedFile(file.name);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    dragOver ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/30"
                  }`}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.csv" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) setUploadedFile(e.target.files[0].name); }} />
                  {uploadedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-600">PDF</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]">{uploadedFile}</span>
                      <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                        className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 font-medium">Données ou PDF</p>
                      <p className="text-xs text-gray-300 mt-1">PDF, Word, Excel, CSV · max 20 Mo</p>
                    </>
                  )}
                </div>
              </div>

              {/* Chapitres */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Structure des chapitres</label>
                <div className="space-y-2">
                  {chapitres.map((ch, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
                      <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{i + 1}.</span>
                      <input
                        value={ch}
                        onChange={(e) => updateChapitre(i, e.target.value)}
                        placeholder={`Chapitre ${i + 1}`}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                      {chapitres.length > 1 && (
                        <button onClick={() => removeChapitre(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addChapitre} className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Ajouter un chapitre
                </button>
              </div>

              {/* Sources */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sources principales</label>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s, i) => (
                    <SourceChip key={i} label={s} onRemove={() => setSources((prev) => prev.filter((_, idx) => idx !== i))} />
                  ))}
                  <AnimatePresence>
                    {addingSource ? (
                      <motion.div key="input" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={newSource}
                          onChange={(e) => setNewSource(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newSource.trim()) {
                              setSources((prev) => [...prev, newSource.trim()]);
                              setNewSource(""); setAddingSource(false);
                            }
                            if (e.key === "Escape") { setAddingSource(false); setNewSource(""); }
                          }}
                          placeholder="Auteur (année)"
                          className="text-xs border border-purple-300 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300 w-36"
                        />
                      </motion.div>
                    ) : (
                      <button onClick={() => setAddingSource(true)}
                        className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 border-dashed text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full hover:border-purple-300 hover:text-purple-600 transition-colors">
                        <Plus className="w-3 h-3" /> Ajouter
                      </button>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Figures notice */}
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs text-amber-700 font-medium">
                  💡 Astuce : insère tes graphiques (frontière efficiente, matrices) dans la section <strong>Figures & Graphiques</strong> du tableau de bord pour les inclure automatiquement.
                </p>
              </div>

            </div>

            {/* Sticky bottom button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Générer la Partie II</>
                )}
              </Button>
            </div>
          </div>

          {/* RIGHT — Word preview 62% */}
          <div className="flex-1 relative overflow-hidden">
            <WordPreview
              content={previewContent || undefined}
              rawContent={rawTextRef.current || undefined}
              sectionTitle="Partie II"
              wordCount={wordCount || 1189}
              blurred={showPaywall}
            />
            <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} />
          </div>
        </div>
      </div>
      <UpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
        variant={getMyPlan().planId === "pro" ? "page-pro" : "page-essentiel"}
        currentPlan={getMyPlan().planId}
      />
    </div>
  );
}
