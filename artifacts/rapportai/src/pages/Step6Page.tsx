import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Sparkles, Loader2, ArrowRight, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { WordPreview } from "@/components/report/WordPreview";

const STRUCTURE_AUTO = `Ce rapport s'articule autour de neuf parties principales : une introduction générale qui pose le cadre et la problématique, deux parties principales développant le cadre théorique et les résultats empiriques, suivies d'une conclusion générale, d'une bibliographie, et des annexes.`;

const AI_CONTEXTE = "Dans un contexte de mondialisation accélérée des marchés financiers et d'intégration progressive des économies émergentes dans les circuits financiers internationaux, la gestion optimale des actifs financiers s'impose comme un enjeu stratégique majeur pour les investisseurs institutionnels et individuels opérant sur la Bourse de Casablanca.";

const AI_OBJECTIFS = "Cette étude vise à construire un portefeuille optimal sur le marché boursier marocain en appliquant le modèle de Markowitz à un échantillon représentatif de titres cotés au MASI. Plus spécifiquement, nous cherchons à (1) estimer la frontière efficiente, (2) analyser la diversification sectorielle, et (3) comparer les performances ajustées au risque.";

const PREVIEW_HTML = `
<h2>Introduction Générale</h2>

<h3>Contexte général</h3>
<p>${AI_CONTEXTE}</p>

<h3>Problématique</h3>
<p>Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée aux spécificités du marché boursier marocain pour construire un portefeuille optimal sur la Bourse de Casablanca ?</p>

<h3>Objectifs de recherche</h3>
<p>${AI_OBJECTIFS}</p>

<h3>Structure du rapport</h3>
<p>${STRUCTURE_AUTO}</p>
`;

export default function Step6Page() {
  const [, setLocation] = useLocation();
  const [contexte, setContexte] = useState("");
  const [problematique, setProblematique] = useState("Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée aux spécificités du marché boursier marocain pour construire un portefeuille optimal sur la Bourse de Casablanca ?");
  const [editingProb, setEditingProb] = useState(false);
  const [objectifs, setObjectifs] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); }, 2000);
  };

  return (
    <StepLayout stepId={6} fullHeight>
      <div className="flex h-full overflow-hidden">
        {/* LEFT — Form 38% */}
        <div className="overflow-y-auto flex-shrink-0 flex flex-col" style={{ width: "38%", borderRight: "1px solid #e5e7eb" }}>
          <div className="p-6 space-y-5 pb-32">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Introduction Générale</h1>
              <p className="text-xs text-gray-400">L'IA utilise ton thème, ta problématique et tes mots-clés pour générer cette section.</p>
            </motion.div>

            {/* AI context card */}
            <div className="rounded-2xl p-4" style={{ background: "#f5f0ff" }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-bold text-purple-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Contexte IA</span>
              </div>
              <div className="space-y-1.5">
                {[
                  ["Thème", "Optimisation de portefeuille — EMSI Finance"],
                  ["École", "EMSI · Finance"],
                  ["Problématique", "Modèle de Markowitz & BVC"],
                  ["Mots-clés", "MPT, CAPM, VaR, MASI, BVC"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-purple-400 w-24 flex-shrink-0">{k}</span>
                    <span className="text-xs text-purple-700 truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contexte général */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contexte général</label>
              <textarea value={contexte} onChange={e => setContexte(e.target.value)} rows={3}
                placeholder="Ex: Dans un contexte de mondialisation des marchés financiers, la gestion du risque de portefeuille..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              <button onClick={() => setContexte(AI_CONTEXTE)} className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Laisser l'IA décider
              </button>
            </div>

            {/* Problématique — pre-filled, editable */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Problématique</label>
                <button onClick={() => setEditingProb(!editingProb)} className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> {editingProb ? "Fermer" : "Modifier"}
                </button>
              </div>
              {editingProb ? (
                <textarea value={problematique} onChange={e => setProblematique(e.target.value)} rows={3}
                  className="w-full text-sm border border-purple-300 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300" />
              ) : (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <p className="text-sm text-purple-800 italic leading-relaxed">"{problematique}"</p>
                </div>
              )}
            </div>

            {/* Objectifs */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Objectifs de recherche</label>
              <textarea value={objectifs} onChange={e => setObjectifs(e.target.value)} rows={3}
                placeholder="Ex: Cette étude vise à construire un portefeuille optimal sur le marché boursier marocain..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              <button onClick={() => setObjectifs(AI_OBJECTIFS)} className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Laisser l'IA décider
              </button>
            </div>

            {/* Structure — auto */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Structure du rapport <span className="text-xs font-normal text-gray-400">(auto-générée)</span></label>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-xs text-gray-500 leading-relaxed italic">{STRUCTURE_AUTO}</p>
              </div>
            </div>
          </div>

          {/* Sticky generate button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0 space-y-2">
            <Button onClick={handleGenerate} disabled={generating}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</> : <><Sparkles className="w-4 h-4" /> Générer l'Introduction Générale</>}
            </Button>
            <Button onClick={() => setLocation("/rapport/partie-i")} variant="ghost"
              className="w-full h-9 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
              Suivant — Partie I <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* RIGHT — Word preview */}
        <div className="flex-1 overflow-hidden">
          <WordPreview content={PREVIEW_HTML} wordCount={298} />
        </div>
      </div>
    </StepLayout>
  );
}
