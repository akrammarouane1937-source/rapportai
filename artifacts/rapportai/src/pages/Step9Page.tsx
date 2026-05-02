import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, Loader2, X, Upload, Download,
  CheckCircle2, Circle, FileText, BookOpen,
  BarChart2, Hash, ChevronRight, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { WordPreview } from "@/components/report/WordPreview";
import { UpsellModal } from "@/components/report/UpsellModal";
import { useGenerate } from "@/lib/useGenerate";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { saveReport, getReport } from "@/lib/reportStore";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { getApprovedFigures } from "@/lib/figureStore";
import { getBibSources } from "@/lib/bibliothequeStore";
import { getMyPlan, PLAN_LIMITS } from "@/lib/userPlan";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text?: string): number {
  return text?.trim() ? text.trim().split(/\s+/).length : 0;
}

function sectionWords(texts: (string | undefined)[]): number {
  return texts.reduce((acc, t) => acc + wordCount(t), 0);
}

// ─── Section checklist item ───────────────────────────────────────────────────

function SectionRow({
  label, done, words,
}: { label: string; done: boolean; words?: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {done
        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        : <Circle className="w-4 h-4 text-gray-200 flex-shrink-0" />
      }
      <span className={`text-sm flex-1 ${done ? "text-gray-700" : "text-gray-300"}`}>{label}</span>
      {done && words !== undefined && words > 0 && (
        <span className="text-xs text-gray-400 tabular-nums">{words.toLocaleString("fr-FR")} mots</span>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode; value: string | number; label: string; color: string;
}) {
  return (
    <div className="flex-1 rounded-2xl p-4" style={{ background: "#f9f8ff", border: "1px solid #ede9fe" }}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2`} style={{ background: color + "20" }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-xl font-black text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Step9Page() {
  const [, setLocation] = useLocation();

  // ── Load live data from all stores ──────────────────────────────────────────
  const report   = useMemo(() => getReport(), []);
  const figures  = useMemo(() => getApprovedFigures(), []);
  const bibSrcs  = useMemo(() => getBibSources(), []);
  const plan     = useMemo(() => getMyPlan(), []);

  // ── Local state ──────────────────────────────────────────────────────────────
  const [apports, setApports]           = useState(report.apports ?? "");
  const [perspectives, setPerspectives] = useState(report.perspectives ?? "");
  const [annexes, setAnnexes]           = useState<string[]>(report.annexes ?? []);
  const [streamedContent, setStreamedContent]   = useState(
    report.conclusion ? markdownToHtml(report.conclusion) : ""
  );
  const [streamedWordCount, setStreamedWordCount] = useState(wordCount(report.conclusion));
  const [exportingFull, setExportingFull] = useState(false);
  const [showUpsell, setShowUpsell]       = useState(false);
  const [exported, setExported]           = useState(false);
  const rawTextRef = useRef(report.conclusion ?? "");

  // ── Streaming generation ──────────────────────────────────────────────────
  const onChunk = useCallback((chunk: string) => {
    rawTextRef.current += chunk;
    setStreamedContent(markdownToHtml(rawTextRef.current));
    setStreamedWordCount(rawTextRef.current.split(/\s+/).filter(Boolean).length);
  }, []);

  const onDone = useCallback(() => {
    // Parse the generated text to split conclusion / apports / perspectives
    const text = rawTextRef.current;
    saveReport({
      conclusion:   text,
      apports:      apports || undefined,
      perspectives: perspectives || undefined,
      annexes:      annexes.length > 0 ? annexes : undefined,
    });
  }, [apports, perspectives, annexes]);

  const { generate, isStreaming: generating } = useGenerate({ onChunk, onDone });

  const handleGenerate = () => {
    rawTextRef.current = "";
    setStreamedContent("");
    setStreamedWordCount(0);
    generate({ section: "conclusion" });  // useGenerate reads store automatically
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalWords = sectionWords([
    report.dedicaces, report.remerciements,
    report.resume, report.abstract,
    report.introduction,
    report.partieI, report.partieII,
    rawTextRef.current || report.conclusion,
  ]);
  const estimatedPages = Math.max(1, Math.round(totalWords / 250));
  const withinLimit    = estimatedPages <= PLAN_LIMITS[plan.planId].pages;

  // ── Section checklist ────────────────────────────────────────────────────
  const sections = [
    { label: "Informations générales",       done: !!(report.theme && report.school),   words: 0 },
    { label: "Page de garde",               done: !!(report.studentName),               words: 0 },
    { label: "Dédicaces & Remerciements",   done: !!(report.dedicaces),                 words: wordCount(report.dedicaces) + wordCount(report.remerciements) },
    { label: "Résumé & Abstract",           done: !!(report.resume),                   words: wordCount(report.resume) + wordCount(report.abstract) },
    { label: "Introduction Générale",       done: !!(report.introduction),             words: wordCount(report.introduction) },
    { label: "Partie I",                    done: !!(report.partieI),                  words: wordCount(report.partieI) },
    { label: "Partie II",                   done: !!(report.partieII),                 words: wordCount(report.partieII) },
    { label: "Conclusion & Perspectives",   done: !!(rawTextRef.current || report.conclusion), words: wordCount(rawTextRef.current || report.conclusion) },
  ];

  const completedCount = sections.filter((s) => s.done).length;
  const allDone        = completedCount === sections.length;

  // ── Export ───────────────────────────────────────────────────────────────
  const handleFullExport = async () => {
    if (exportingFull) return;

    if (!withinLimit) { setShowUpsell(true); return; }

    setExportingFull(true);
    try {
      saveReport({
        conclusion:   rawTextRef.current || report.conclusion || undefined,
        apports:      apports || undefined,
        perspectives: perspectives || undefined,
        annexes:      annexes.length > 0 ? annexes : undefined,
      });
      const data = getReport();
      const blob = await generateDocx(data);
      const theme = data.theme?.slice(0, 40).replace(/\s+/g, "-").replace(/[^a-z0-9\-]/gi, "") || "rapport";
      downloadBlob(blob, `RapportAI-${theme}.docx`);
      setExported(true);
      setTimeout(() => setExported(false), 4000);
    } catch (err) {
      console.error("export error", err);
    } finally {
      setExportingFull(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <StepLayout stepId={9} fullHeight>
      <div className="flex h-full overflow-hidden">

        {/* ── LEFT PANEL (38%) ──────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-shrink-0 flex flex-col" style={{ width: "38%", borderRight: "1px solid #e5e7eb" }}>
          <div className="p-6 space-y-5 pb-4">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Finalisation du rapport
              </h1>
              <p className="text-xs text-gray-400">
                {completedCount}/{sections.length} sections complètes · Génère la conclusion et télécharge ton .docx
              </p>
            </motion.div>

            {/* ── Stats bar ── */}
            <div className="flex gap-3">
              <StatCard icon={<Hash className="w-4 h-4" />}    value={totalWords > 0 ? totalWords.toLocaleString("fr-FR") : "—"} label="Mots"     color="#7c3aed" />
              <StatCard icon={<FileText className="w-4 h-4" />} value={totalWords > 0 ? `~${estimatedPages} p.` : "—"}             label="Pages"    color="#0ea5e9" />
              <StatCard icon={<BookOpen className="w-4 h-4" />} value={bibSrcs.length || "—"}                                       label="Sources"  color="#10b981" />
              <StatCard icon={<BarChart2 className="w-4 h-4" />} value={figures.length || "—"}                                      label="Figures"  color="#f59e0b" />
            </div>

            {/* ── Section checklist ── */}
            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sections</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  allDone ? "bg-green-50 text-green-600" : "bg-purple-50 text-purple-600"
                }`}>
                  {completedCount}/{sections.length}
                </span>
              </div>
              <div className="px-4 pb-3 divide-y divide-gray-50">
                {sections.map((s) => (
                  <SectionRow key={s.label} label={s.label} done={s.done} words={s.words} />
                ))}
              </div>
            </div>

            {/* ── Page limit warning ── */}
            {!withinLimit && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-xl p-4" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                <p className="text-xs font-bold text-orange-700 mb-1">⚠ Limite de pages atteinte</p>
                <p className="text-xs text-orange-600">
                  Ton rapport fait ~{estimatedPages} pages. Le plan {plan.planId === "free" ? "Gratuit" : "Essentiel"} est limité à {PLAN_LIMITS[plan.planId].pages} pages.
                </p>
                <button onClick={() => setShowUpsell(true)}
                  className="mt-2 text-xs font-bold text-orange-700 underline underline-offset-2">
                  Passer au plan supérieur →
                </button>
              </motion.div>
            )}

            {/* ── Synthesis IA card ── */}
            <div className="rounded-2xl p-4" style={{ background: "#f5f0ff" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-bold text-purple-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Synthèse IA
                </span>
              </div>
              <p className="text-xs text-purple-600 leading-relaxed">
                Claude va lire tes Parties I et II pour générer une conclusion cohérente, synthétiser tes apports, tes limites et tes perspectives.
                {report.partieI && report.partieII
                  ? " Les deux parties sont prêtes — la qualité sera maximale."
                  : " Génère tes parties avant la conclusion pour un meilleur résultat."}
              </p>
            </div>

            {/* ── Apports et limites ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Apports et limites <span className="text-xs font-normal text-gray-400">(optionnel — l'IA peut générer)</span>
              </label>
              <textarea
                value={apports}
                onChange={(e) => setApports(e.target.value)}
                rows={3}
                placeholder="Ex : Cette étude contribue à la littérature sur les marchés émergents, cependant elle se limite à..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
              />
            </div>

            {/* ── Perspectives ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Perspectives futures <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <textarea
                value={perspectives}
                onChange={(e) => setPerspectives(e.target.value)}
                rows={3}
                placeholder="Ex : Des recherches futures pourraient intégrer des données ESG..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
              />
            </div>

            {/* ── Bibliography sources ── */}
            {bibSrcs.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bibliographie
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {report.citationStyle ?? "APA 7th ed."} · {bibSrcs.length} source{bibSrcs.length > 1 ? "s" : ""}
                  </span>
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {bibSrcs.map((s) => (
                    <div key={s.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {s.authors} ({s.year}).{" "}
                        <em>{s.title}</em>
                        {s.journal ? `. ${s.journal}` : ""}
                        {s.doi ? (
                          <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noopener noreferrer"
                            className="ml-1 text-purple-500 hover:underline text-[10px]">
                            DOI ↗
                          </a>
                        ) : null}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Figures summary ── */}
            {figures.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Figures approuvées <span className="text-xs font-normal text-gray-400">(auto-insérées dans le .docx)</span>
                </label>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {figures.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                      <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center bg-amber-50">
                        <BarChart2 className="w-3 h-3 text-amber-500" />
                      </div>
                      <span className="text-xs text-gray-500 w-16 flex-shrink-0">Figure {f.figureNumber}</span>
                      <span className="flex-1 text-xs text-gray-700 truncate">{f.title}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{f.placement}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Annexes ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Annexes</label>
              <AnimatePresence>
                {annexes.map((a, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 mb-2 bg-gray-50 rounded-xl px-3 py-2.5 group">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">Annexe {i + 1}</span>
                    <span className="flex-1 text-xs text-gray-700 truncate">{a}</span>
                    <button onClick={() => setAnnexes((prev) => prev.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <label className="flex flex-col items-center border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-purple-300 hover:bg-purple-50/20 transition-colors">
                <Upload className="w-5 h-5 text-gray-300 mb-1" />
                <span className="text-xs text-gray-400 font-medium">PDF / Images / Excel</span>
                <input type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAnnexes((prev) => [...prev, ...files.map((f) => f.name)]);
                  }} />
              </label>
            </div>
          </div>

          {/* ── Sticky action buttons ─────────────────────────────────────── */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0 space-y-2.5">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours…</>
                : <><Sparkles className="w-4 h-4" /> Générer la Conclusion</>}
            </Button>

            {/* Export CTA */}
            <button
              onClick={handleFullExport}
              disabled={exportingFull}
              className="w-full h-14 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-70 relative overflow-hidden"
              style={{
                background: exported
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : "linear-gradient(135deg, #16a34a, #15803d)",
                boxShadow: "0 6px 24px rgba(22,163,74,0.4)",
                color: "white",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {exportingFull ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Génération du .docx…</>
              ) : exported ? (
                <><CheckCircle2 className="w-5 h-5" /> Rapport téléchargé !</>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Télécharger mon rapport .docx</span>
                  <ArrowRight className="w-4 h-4 opacity-70" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              {totalWords > 0
                ? `~${estimatedPages} pages · ${totalWords.toLocaleString("fr-FR")} mots · ${figures.length} figure${figures.length !== 1 ? "s" : ""}`
                : "Génère tes sections pour voir les statistiques"}
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          {streamedContent ? (
            <WordPreview
              content={streamedContent}
              rawContent={rawTextRef.current}
              sectionTitle="Conclusion Générale"
              wordCount={streamedWordCount}
            />
          ) : (
            /* Empty state — show a summary of what's ready */
            <div className="h-full flex flex-col items-center justify-center px-12 bg-white">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                   style={{ background: "#f5f0ff" }}>
                <Sparkles className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Dernière étape !
              </h2>
              <p className="text-sm text-gray-400 text-center max-w-xs leading-relaxed mb-8">
                Clique sur <strong className="text-gray-600">Générer la Conclusion</strong> — Claude va synthétiser tout ton travail en une conclusion académique complète.
              </p>

              {/* Mini report stats */}
              <div className="w-full max-w-sm space-y-2 mb-8">
                {sections.filter((s) => s.done).map((s) => (
                  <div key={s.label}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{ background: "#f9fafb" }}>
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">{s.label}</span>
                    {s.words > 0 && (
                      <span className="text-xs text-gray-400 tabular-nums">{s.words.toLocaleString("fr-FR")} mots</span>
                    )}
                  </div>
                ))}
                {sections.filter((s) => !s.done).map((s) => (
                  <div key={s.label}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl opacity-40"
                    style={{ background: "#f9fafb" }}>
                    <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-400">{s.label}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="h-12 px-8 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl gap-2"
                style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
              >
                {generating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération…</>
                  : <><Sparkles className="w-4 h-4" /> Générer la Conclusion</>}
              </Button>
            </div>
          )}
        </div>
      </div>

      <UpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
        variant={plan.planId === "free" ? "page-essentiel" : "page-pro"}
        currentPlan={plan.planId}
      />
    </StepLayout>
  );
}
