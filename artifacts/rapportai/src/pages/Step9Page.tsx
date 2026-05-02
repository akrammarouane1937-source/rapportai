import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Sparkles, Loader2, Plus, X, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { WordPreview } from "@/components/report/WordPreview";
import { useGenerate } from "@/lib/useGenerate";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { saveReport, getReport } from "@/lib/reportStore";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";

const AI_CONCLUSION = "Ce travail nous a permis de démontrer que l'application de la théorie moderne du portefeuille au marché boursier marocain est non seulement possible mais pertinente. La construction d'une frontière efficiente à partir des titres du MASI révèle que la diversification sectorielle permet de réduire significativement le risque sans sacrifice notable sur le rendement espéré. Ces résultats confirment, dans une large mesure, la validité du modèle de Markowitz dans un contexte de marché émergent.";
const AI_APPORTS = "Cette étude contribue à la littérature sur les marchés financiers émergents en adaptant un cadre théorique classique au contexte marocain. Elle fournit aux gestionnaires de fonds locaux un outil opérationnel pour la construction de portefeuilles optimaux. Cependant, elle se limite à un horizon d'analyse de 5 ans et ne prend pas en compte les coûts de transaction ni la liquidité des titres.";
const AI_PERSPECTIVES = "Des recherches futures pourraient intégrer des données ESG pour construire des portefeuilles socialement responsables adaptés au marché marocain. L'extension du modèle aux marchés de la région MENA offrirait également des perspectives comparatives enrichissantes.";

const BIBLIO_ENTRIES = [
  { author: "Markowitz, H.", year: "1952", title: "Portfolio Selection", journal: "Journal of Finance, 7(1), 77–91." },
  { author: "Fama, E. F.", year: "1970", title: "Efficient Capital Markets: A Review of Theory and Empirical Work", journal: "Journal of Finance, 25(2), 383–417." },
  { author: "Sharpe, W. F.", year: "1964", title: "Capital Asset Prices: A Theory of Market Equilibrium", journal: "Journal of Finance, 19(3), 425–442." },
];

const FIGURES = [
  { n: 1, title: "Frontière efficiente du portefeuille", page: 21 },
  { n: 2, title: "Matrice de corrélation des rendements", page: 22 },
  { n: 3, title: "Distribution des rendements — MASI", page: 24 },
];

const TABLEAUX = [
  { n: 1, title: "Statistiques descriptives des titres sélectionnés", page: 14 },
  { n: 2, title: "Composition du portefeuille optimal", page: 23 },
  { n: 3, title: "Performance ajustée au risque — ratio de Sharpe", page: 26 },
];

const PREVIEW_HTML = `
<h2>Conclusion Générale</h2>
<p>${AI_CONCLUSION}</p>

<h3>Apports et limites</h3>
<p>${AI_APPORTS}</p>

<h3>Perspectives futures</h3>
<p>${AI_PERSPECTIVES}</p>

<h2>Bibliographie</h2>
<p>Fama, E. F. (1970). Efficient Capital Markets: A Review of Theory and Empirical Work. <em>Journal of Finance</em>, 25(2), 383–417.</p>
<p>Markowitz, H. (1952). Portfolio Selection. <em>Journal of Finance</em>, 7(1), 77–91.</p>
<p>Sharpe, W. F. (1964). Capital Asset Prices: A Theory of Market Equilibrium. <em>Journal of Finance</em>, 19(3), 425–442.</p>

<h2>Table des figures</h2>
<p>Figure 1 — Frontière efficiente du portefeuille ................ 21</p>
<p>Figure 2 — Matrice de corrélation des rendements .............. 22</p>

<h2>Liste des tableaux</h2>
<p>Tableau 1 — Statistiques descriptives des titres .............. 14</p>
<p>Tableau 2 — Composition du portefeuille optimal ............... 23</p>
`;

export default function Step9Page() {
  const [, setLocation] = useLocation();
  const [conclusion, setConclusion] = useState("");
  const [apports, setApports] = useState("");
  const [perspectives, setPerspectives] = useState("");
  const [biblio, setBiblio] = useState(BIBLIO_ENTRIES);
  const [figures] = useState(FIGURES);
  const [tableaux] = useState(TABLEAUX);
  const [annexes, setAnnexes] = useState<string[]>([]);
  const [streamedContent, setStreamedContent] = useState(PREVIEW_HTML);
  const [streamedWordCount, setStreamedWordCount] = useState(487);
  const [exportingFull, setExportingFull] = useState(false);
  const rawTextRef = useRef("");

  const onChunk = useCallback((chunk: string) => {
    rawTextRef.current += chunk;
    setStreamedContent(markdownToHtml(rawTextRef.current));
    setStreamedWordCount(rawTextRef.current.split(/\s+/).filter(Boolean).length);
  }, []);

  const onDone = useCallback(() => {
    saveReport({ conclusion: rawTextRef.current });
  }, []);

  const { generate, isStreaming: generating } = useGenerate({ onChunk, onDone });

  const handleGenerate = () => {
    rawTextRef.current = "";
    setStreamedContent("");
    setStreamedWordCount(0);
    generate({
      section: "conclusion",
      theme: "Optimisation de portefeuille d'actifs financiers à la Bourse de Casablanca",
      school: "EMSI",
      filiere: "Finance",
      problematique: "Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée au marché boursier marocain ?",
      citationStyle: "APA 7th ed.",
    });
  };

  const handleFullExport = async () => {
    if (exportingFull) return;
    setExportingFull(true);
    try {
      // Save current page state to store before export
      saveReport({
        conclusion: rawTextRef.current || conclusion || undefined,
        apports: apports || undefined,
        perspectives: perspectives || undefined,
        bibliographie: biblio,
        figures,
        tableaux,
        annexes,
      });
      const data = getReport();
      const blob = await generateDocx(data);
      const theme = data.theme?.slice(0, 40).replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "") || "rapport";
      downloadBlob(blob, `RapportAI-${theme}.docx`);
    } catch (err) {
      console.error("full export error", err);
    } finally {
      setExportingFull(false);
    }
  };

  return (
    <StepLayout stepId={9} fullHeight>
      <div className="flex h-full overflow-hidden">
        {/* LEFT */}
        <div className="overflow-y-auto flex-shrink-0 flex flex-col" style={{ width: "38%", borderRight: "1px solid #e5e7eb" }}>
          <div className="p-6 space-y-5 pb-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Conclusion + Back matter</h1>
              <p className="text-xs text-gray-400">Les dernières pages de ton rapport. L'IA synthétise tes parties I et II.</p>
            </motion.div>

            {/* AI context */}
            <div className="rounded-2xl p-4" style={{ background: "#f5f0ff" }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-bold text-purple-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Synthèse IA</span>
              </div>
              <p className="text-xs text-purple-600">L'IA lira le contenu de ta Partie I et Partie II pour générer une conclusion cohérente et des perspectives alignées.</p>
            </div>

            {/* Conclusion */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Conclusion Générale</label>
              <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} rows={4}
                placeholder="Ex: Ce travail nous a permis de démontrer que l'optimisation de portefeuille sur le marché marocain..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              <button onClick={() => setConclusion(AI_CONCLUSION)} className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Laisser l'IA décider
              </button>
            </div>

            {/* Apports */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Apports et limites</label>
              <textarea value={apports} onChange={e => setApports(e.target.value)} rows={3}
                placeholder="Ex: Cette étude contribue à la littérature sur les marchés émergents, cependant elle se limite à..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              <button onClick={() => setApports(AI_APPORTS)} className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Laisser l'IA décider
              </button>
            </div>

            {/* Perspectives */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Perspectives futures</label>
              <textarea value={perspectives} onChange={e => setPerspectives(e.target.value)} rows={3}
                placeholder="Ex: Des recherches futures pourraient intégrer des données ESG..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              <button onClick={() => setPerspectives(AI_PERSPECTIVES)} className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Laisser l'IA décider
              </button>
            </div>

            {/* Bibliographie */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bibliographie <span className="text-xs font-normal text-gray-400">(APA 7th — auto-générée)</span></label>
              <div className="space-y-2">
                {biblio.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 group bg-gray-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {entry.author} ({entry.year}). <em>{entry.title}</em>. {entry.journal}
                      </p>
                    </div>
                    <button onClick={() => setBiblio(biblio.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 flex-shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Table des figures */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Table des figures <span className="text-xs font-normal text-gray-400">(auto-générée)</span></label>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {figures.map(f => (
                  <div key={f.n} className="flex items-center px-3 py-2 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 w-16 flex-shrink-0">Figure {f.n}</span>
                    <span className="flex-1 text-gray-700">{f.title}</span>
                    <span className="text-gray-400 w-8 text-right">{f.page}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liste des tableaux */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Liste des tableaux <span className="text-xs font-normal text-gray-400">(auto-générée)</span></label>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {tableaux.map(t => (
                  <div key={t.n} className="flex items-center px-3 py-2 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 w-20 flex-shrink-0">Tableau {t.n}</span>
                    <span className="flex-1 text-gray-700">{t.title}</span>
                    <span className="text-gray-400 w-8 text-right">{t.page}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Annexes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Annexes</label>
              {annexes.map((a, i) => (
                <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 rounded-xl px-3 py-2.5 group">
                  <span className="text-xs text-gray-500 w-16 flex-shrink-0">Annexe {i + 1}</span>
                  <span className="flex-1 text-xs text-gray-700 truncate">{a}</span>
                  <button onClick={() => setAnnexes(annexes.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <label className="flex flex-col items-center border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-purple-300 hover:bg-purple-50/20 transition-colors">
                <Upload className="w-5 h-5 text-gray-300 mb-1" />
                <span className="text-xs text-gray-400 font-medium">PDF / Images / Excel</span>
                <input type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.xlsx,.xls"
                  onChange={e => { const files = Array.from(e.target.files || []); setAnnexes(prev => [...prev, ...files.map(f => f.name)]); }} />
              </label>
            </div>
          </div>

          {/* Sticky buttons */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0 space-y-2">
            <Button onClick={handleGenerate} disabled={generating}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</> : <><Sparkles className="w-4 h-4" /> Générer la Conclusion</>}
            </Button>
            <Button
              onClick={handleFullExport}
              disabled={exportingFull}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ boxShadow: "0 4px 20px rgba(22,163,74,0.3)" }}>
              {exportingFull
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération du .docx...</>
                : <><Download className="w-4 h-4" /> 🎉 Télécharger mon rapport complet .docx</>
              }
            </Button>
          </div>
        </div>

        {/* RIGHT — Word preview */}
        <div className="flex-1 overflow-hidden">
          <WordPreview
            content={streamedContent || undefined}
            rawContent={rawTextRef.current || undefined}
            sectionTitle="Conclusion Générale"
            wordCount={streamedWordCount}
          />
        </div>
      </div>
    </StepLayout>
  );
}
