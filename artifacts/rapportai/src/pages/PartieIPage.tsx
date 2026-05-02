import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, RefreshCw, Upload, Plus, X, ExternalLink,
  Loader2, ChevronRight, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { WordPreview } from "@/components/report/WordPreview";
import { PaywallModal } from "@/components/report/PaywallModal";

const INITIAL_KEYWORDS = ["portefeuille", "MEDAF", "Markowitz", "risque financier", "Bourse de Casablanca"];
const INITIAL_SOURCES = ["Markowitz (1952)", "Fama (1970)", "Sharpe (1964)"];

const MOCK_STREAM_TEXT = `
<h2>Chapitre I — Cadre théorique et revue de littérature</h2>

<h3>1.1 Introduction au cadre théorique</h3>

<p>La théorie moderne du portefeuille, telle qu'elle a été formulée par Harry Markowitz en 1952, constitue le fondement conceptuel de la présente analyse. Cette théorie révolutionnaire a profondément transformé la manière dont les investisseurs appréhendent la relation entre rendement et risque dans la construction d'un portefeuille d'actifs financiers.</p>

<p>Dans le contexte marocain, l'optimisation des portefeuilles revêt une importance particulière compte tenu des spécificités du marché financier national. La Bourse de Casablanca, principal marché organisé du Royaume, présente des caractéristiques structurelles qui nécessitent une adaptation des modèles théoriques développés dans des contextes occidentaux.</p>

<h3>1.2 La théorie de Markowitz et l'efficience des marchés</h3>

<p>Markowitz (1952) a démontré que pour un niveau de risque donné, il existe un portefeuille qui maximise le rendement espéré — et réciproquement, pour un niveau de rendement donné, il existe un portefeuille qui minimise le risque. L'ensemble de ces portefeuilles constitue ce que l'on appelle la frontière efficiente.</p>

<p>Cette approche quantitative repose sur trois hypothèses fondamentales : les investisseurs sont rationnels et averses au risque, les marchés sont efficients au sens semi-fort, et les distributions de rendements peuvent être caractérisées par leur espérance et leur variance. Ces hypothèses, bien que simplificatrices, permettent de développer un cadre analytique rigoureux et opérationnel.</p>

<h3>1.3 Évolution des modèles d'optimisation</h3>

<p>À la suite des travaux de Markowitz, Sharpe (1964) a proposé le modèle d'évaluation des actifs financiers (MEDAF), qui lie le rendement d'un actif à sa sensibilité aux fluctuations du marché. Ce coefficient de sensibilité, communément appelé bêta, est devenu l'un des outils les plus utilisés dans la gestion de portefeuille contemporaine.</p>

<p>Plus récemment, les modèles factoriels ont enrichi cette approche en introduisant des facteurs supplémentaires tels que la taille des entreprises, le ratio valeur comptable sur valeur de marché, et le momentum. Ces développements théoriques ont permis d'améliorer significativement le pouvoir explicatif des modèles d'évaluation des actifs.</p>

<h3>1.4 Application au marché boursier marocain</h3>

<p>Le marché boursier marocain, bien qu'il ait connu un développement significatif au cours des dernières décennies, présente des caractéristiques qui le distinguent des marchés développés. Sa liquidité limitée, la concentration sectorielle de sa capitalisation boursière et la prédominance de certains acteurs institutionnels constituent autant de facteurs à prendre en compte dans l'application des modèles d'optimisation classiques.</p>

<p>Plusieurs études empiriques ont tenté d'adapter les modèles d'efficience au contexte marocain, avec des résultats nuancés. Si l'hypothèse d'efficience faible semble vérifiée dans l'ensemble, l'efficience semi-forte reste sujette à débat, notamment en raison de l'asymétrie informationnelle et des pratiques de gouvernance d'entreprise propres au marché local.</p>
`;

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

export default function PartieIPage() {
  const [, setLocation] = useLocation();
  const [keywords, setKeywords] = useState(INITIAL_KEYWORDS);
  const [problematique, setProblematique] = useState("");
  const [contexte, setContexte] = useState("");
  const [chapitres, setChapitres] = useState([
    "Cadre théorique et revue de littérature",
    "Méthodologie et collecte de données",
  ]);
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [newSource, setNewSource] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGenerate = () => {
    setGenerating(true);
    setPreviewContent("");
    setWordCount(0);

    // Simulate streaming — split content into chunks
    const words = MOCK_STREAM_TEXT.split(" ");
    let i = 0;
    let accumulated = "";

    const stream = setInterval(() => {
      if (i >= words.length) {
        clearInterval(stream);
        setGenerating(false);
        return;
      }
      const chunk = words.slice(i, i + 8).join(" ") + " ";
      accumulated += chunk;
      i += 8;
      const currentWordCount = accumulated.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
      setWordCount(currentWordCount);
      setPreviewContent(accumulated);
      if (currentWordCount >= 600) {
        clearInterval(stream);
        setGenerating(false);
        setShowPaywall(true);
      }
    }, 80);

    streamRef.current = stream;
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
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">Étape 6 sur 7</span>
            <span className="text-xs text-gray-400">Partie I — Contenu principal</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: "85.7%" }} />
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
                      Cadrage IA
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
                </div>
              </div>

              {/* Problématique */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Problématique</label>
                <textarea
                  value={problematique}
                  onChange={(e) => setProblematique(e.target.value)}
                  rows={4}
                  placeholder="Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée au marché boursier marocain ?"
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
                />
                <button
                  onClick={() => setProblematique("Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée aux spécificités du marché boursier marocain ?")}
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
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
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
                      <p className="text-sm text-gray-400 font-medium">Glisse ton PDF ici</p>
                      <p className="text-xs text-gray-300 mt-1">PDF, Word · max 20 Mo</p>
                    </>
                  )}
                </div>
              </div>

              {/* Résumé contexte */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Résumé du contexte</label>
                <textarea
                  value={contexte}
                  onChange={(e) => setContexte(e.target.value)}
                  rows={3}
                  placeholder="Décris brièvement le contexte de ton rapport, ton secteur, tes objectifs..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
                />
                <button
                  onClick={() => setContexte("Ce travail s'inscrit dans le cadre de l'optimisation financière appliquée au marché boursier marocain, avec pour objectif de tester l'applicabilité du modèle de Markowitz sur les titres cotés à la BVC.")}
                  className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Laisser l'IA décider
                </button>
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
                  {addingSource ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newSource.trim()) {
                            setSources((prev) => [...prev, newSource.trim()]);
                            setNewSource("");
                            setAddingSource(false);
                          }
                          if (e.key === "Escape") { setAddingSource(false); setNewSource(""); }
                        }}
                        placeholder="Auteur (année)"
                        className="text-xs border border-purple-300 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300 w-36"
                      />
                    </div>
                  ) : (
                    <button onClick={() => setAddingSource(true)}
                      className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 border-dashed text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full hover:border-purple-300 hover:text-purple-600 transition-colors">
                      <Plus className="w-3 h-3" /> Ajouter
                    </button>
                  )}
                </div>
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
                  <><Sparkles className="w-4 h-4" /> Générer la Partie I</>
                )}
              </Button>
            </div>
          </div>

          {/* RIGHT — Word preview 62% */}
          <div className="flex-1 relative overflow-hidden">
            <WordPreview
              content={previewContent || undefined}
              wordCount={wordCount || 1247}
              blurred={showPaywall}
            />
            <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}
