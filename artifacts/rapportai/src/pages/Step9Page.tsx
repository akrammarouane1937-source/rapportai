import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, Loader2, X, Upload, Download, Plus,
  CheckCircle2, Circle, FileText, BookOpen,
  BarChart2, Hash, ArrowRight, Share2, Link2, Check, Lock, Wand2, Table2,
  MessageSquare, RotateCcw,
} from "lucide-react";
import { ChatRevision } from "@/components/report/ChatRevision";
import { useCheckpoint } from "@/lib/useCheckpoint";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { WordPreview } from "@/components/report/WordPreview";
import { UpsellModal } from "@/components/report/UpsellModal";
import { useGenerate } from "@/lib/useGenerate";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { saveReport, getReport } from "@/lib/reportStore";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { generatePdf } from "@/lib/generatePdf";
import { getApprovedFigures } from "@/lib/figureStore";
import { getBibSources } from "@/lib/bibliothequeStore";
import { getMyPlan, canUseFeature } from "@/lib/userPlan";

// ─── Constants ────────────────────────────────────────────────────────────────

import { API_BASE as BASE_PATH } from "@/lib/apiBase";

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
  const [tableaux, setTableaux]         = useState<Array<{ n: number; title: string; page: number }>>(report.tableaux ?? []);
  const [newTableTitle, setNewTableTitle] = useState("");
  const [newTablePage, setNewTablePage]   = useState("");
  const [streamedContent, setStreamedContent]   = useState(
    report.conclusion ? markdownToHtml(report.conclusion) : ""
  );
  const [streamedWordCount, setStreamedWordCount] = useState(wordCount(report.conclusion));
  const [exportingFull, setExportingFull] = useState(false);
  const [exported, setExported]           = useState(false);
  const [humanizing, setHumanizing]       = useState(false);
  const [sharing, setSharing]             = useState(false);
  const [shareUrl, setShareUrl]           = useState<string | null>(null);
  const [linkCopied, setLinkCopied]       = useState(false);
  const rawTextRef = useRef(report.conclusion ?? "");

  // ── Streaming generation ──────────────────────────────────────────────────
  const onChunk = useCallback((chunk: string) => {
    rawTextRef.current += chunk;
    setStreamedContent(markdownToHtml(rawTextRef.current));
    setStreamedWordCount(rawTextRef.current.split(/\s+/).filter(Boolean).length);
  }, []);

  const onDone = useCallback(() => {
    const text = rawTextRef.current;
    saveReport({
      conclusion:   text,
      apports:      apports || undefined,
      perspectives: perspectives || undefined,
      annexes:      annexes.length > 0 ? annexes : undefined,
      tableaux:     tableaux.length > 0 ? tableaux : undefined,
    });
  }, [apports, perspectives, annexes, tableaux]);

  const { generate, isStreaming: generating, streamingStatus, activityLog, clearActivity } = useGenerate({ onChunk, onDone });
  const [showChat, setShowChat] = useState(false);
  const [feedDismissed, setFeedDismissed] = useState(false);
  const checkpoint = useCheckpoint("conclusion");

  const handleGenerate = () => {
    if (rawTextRef.current.trim()) checkpoint.save(rawTextRef.current);
    rawTextRef.current = "";
    setStreamedContent("");
    setStreamedWordCount(0);
    setFeedDismissed(false);
    clearActivity();
    setShowChat(false);
    generate({ section: "conclusion" });
  };

  const handleHumanize = async () => {
    const original = rawTextRef.current.trim();
    if (!original || humanizing || generating) return;
    setHumanizing(true);
    rawTextRef.current = "";
    setStreamedContent("");
    setStreamedWordCount(0);
    try {
      const r = getReport();
      const resp = await fetch(`${BASE_PATH}/api/humanize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: original, theme: r.theme, reportType: r.reportType, school: r.school, filiere: r.filiere }),
      });
      const reader = resp.body?.getReader();
      if (!reader) return;
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const j = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
            if (j.content) {
              rawTextRef.current += j.content;
              setStreamedContent(markdownToHtml(rawTextRef.current));
              setStreamedWordCount(rawTextRef.current.split(/\s+/).filter(Boolean).length);
            }
            if (j.done) saveReport({ conclusion: rawTextRef.current });
          } catch { /* ignore */ }
        }
      }
    } finally {
      setHumanizing(false);
    }
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
  const canPdf         = canUseFeature("pdf", plan.planId);

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      saveReport({
        conclusion:   rawTextRef.current || report.conclusion || undefined,
        apports:      apports || undefined,
        perspectives: perspectives || undefined,
        annexes:      annexes.length > 0 ? annexes : undefined,
        tableaux:     tableaux.length > 0 ? tableaux : undefined,
      });
      const data = getReport();
      const resp = await fetch(`${BASE_PATH}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error("Erreur serveur");
      const { id } = await resp.json() as { id: string };
      const url = `${window.location.origin}${BASE_PATH}/share/${id}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url).catch(() => {});
    } catch (e) {
      console.error("share error", e);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const handleFullExport = async () => {
    if (exportingFull) return;

    setExportingFull(true);
    try {
      saveReport({
        conclusion:   rawTextRef.current || report.conclusion || undefined,
        apports:      apports || undefined,
        perspectives: perspectives || undefined,
        annexes:      annexes.length > 0 ? annexes : undefined,
        tableaux:     tableaux.length > 0 ? tableaux : undefined,
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
              <div className="flex items-start justify-between mb-1">
                <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Finalisation du rapport
                </h1>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {checkpoint.hasCheckpoints() && (
                    <button onClick={() => { const prev = checkpoint.latest(); if (prev) { rawTextRef.current = prev.content; setStreamedContent(markdownToHtml(prev.content)); setStreamedWordCount(prev.wordCount); } }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Restaurer
                    </button>
                  )}
                  {streamedContent && (
                    <button onClick={() => setShowChat(!showChat)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${showChat ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}>
                      <MessageSquare className="w-3 h-3" /> Réviser
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {completedCount}/{sections.length} sections complètes · Génère la conclusion et télécharge ton .docx
              </p>
            </motion.div>

            {/* ── Stats bar ── */}
            <div className="flex gap-3">
              <StatCard icon={<Hash className="w-4 h-4" />}    value={totalWords > 0 ? totalWords.toLocaleString("fr-FR") : "-"} label="Mots"     color="#7c3aed" />
              <StatCard icon={<FileText className="w-4 h-4" />} value={totalWords > 0 ? `~${estimatedPages} p.` : "-"}             label="Pages"    color="#0ea5e9" />
              <StatCard icon={<BookOpen className="w-4 h-4" />} value={bibSrcs.length || "-"}                                       label="Sources"  color="#10b981" />
              <StatCard icon={<BarChart2 className="w-4 h-4" />} value={figures.length || "-"}                                      label="Figures"  color="#f59e0b" />
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
                  ? " Les deux parties sont prêtes, la qualité sera maximale."
                  : " Génère tes parties avant la conclusion pour un meilleur résultat."}
              </p>
            </div>

            {/* ── Apports et limites ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Apports et limites <span className="text-xs font-normal text-gray-400">(optionnel, l'IA peut générer)</span>
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

            {/* ── Liste des tableaux ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Liste des tableaux
                <span className="ml-2 text-xs font-normal text-gray-400">
                  (auto-incluse dans le .docx)
                </span>
              </label>
              <AnimatePresence>
                {tableaux.map((t, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 mb-2 bg-blue-50 rounded-xl px-3 py-2.5 group">
                    <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center bg-blue-100">
                      <Table2 className="w-3 h-3 text-blue-500" />
                    </div>
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">Tableau {t.n}</span>
                    <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">p. {t.page}</span>
                    <button
                      onClick={() => setTableaux((prev) => prev.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* Add row */}
              <div className="flex items-center gap-2">
                <input
                  value={newTableTitle}
                  onChange={(e) => setNewTableTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTableTitle.trim()) {
                      setTableaux((prev) => [
                        ...prev,
                        { n: prev.length + 1, title: newTableTitle.trim(), page: parseInt(newTablePage) || 0 },
                      ]);
                      setNewTableTitle("");
                      setNewTablePage("");
                    }
                  }}
                  placeholder="Titre du tableau…"
                  className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <input
                  value={newTablePage}
                  onChange={(e) => setNewTablePage(e.target.value)}
                  placeholder="Page"
                  type="number"
                  min={1}
                  className="w-16 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  onClick={() => {
                    if (!newTableTitle.trim()) return;
                    setTableaux((prev) => [
                      ...prev,
                      { n: prev.length + 1, title: newTableTitle.trim(), page: parseInt(newTablePage) || 0 },
                    ]);
                    setNewTableTitle("");
                    setNewTablePage("");
                  }}
                  disabled={!newTableTitle.trim()}
                  className="w-8 h-8 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>

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
              disabled={generating || humanizing}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {streamingStatus}</>
                : <><Sparkles className="w-4 h-4" /> Générer la Conclusion</>}
            </Button>

            {streamedContent && (
              <button
                onClick={handleHumanize}
                disabled={humanizing || generating}
                className="w-full h-9 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border"
                style={{ borderColor: "#10b981", color: humanizing ? "#6b7280" : "#059669", background: humanizing ? "#f3f4f6" : "#f0fdf4" }}
              >
                {humanizing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Humanisation en cours…</>
                  : <><Wand2 className="w-3.5 h-3.5" /> Humaniser (Anti-plagiat IA)</>}
              </button>
            )}

            {/* Export row: .docx + PDF side by side */}
            <div className="flex gap-2">
              {/* .docx CTA */}
              <button
                onClick={handleFullExport}
                disabled={exportingFull}
                className="flex-1 h-14 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70 relative overflow-hidden"
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
                  <><Loader2 className="w-4 h-4 animate-spin" /> .docx…</>
                ) : exported ? (
                  <><CheckCircle2 className="w-4 h-4" /> Téléchargé !</>
                ) : (
                  <><Download className="w-4 h-4" /> Word .docx</>
                )}
              </button>

              {/* PDF button */}
              <button
                onClick={() => {
                  saveReport({
                    conclusion:   rawTextRef.current || report.conclusion || undefined,
                    apports:      apports || undefined,
                    perspectives: perspectives || undefined,
                  });
                  void generatePdf(getReport());
                }}
                className="flex-1 h-14 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                  boxShadow: "0 6px 24px rgba(220,38,38,0.35)",
                  color: "white",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                <Download className="w-4 h-4" /> PDF
              </button>
            </div>

            {/* ── Share link ── */}
            <AnimatePresence>
              {shareUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-blue-100 bg-blue-50 p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Link2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <p className="text-xs font-bold text-blue-700">Lien partageable créé !</p>
                    <span className="ml-auto text-[10px] text-blue-400">expire dans 7 j</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-blue-600 truncate flex-1 min-w-0 font-mono">{shareUrl}</p>
                    <button
                      onClick={handleCopyLink}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: linkCopied ? "#10b981" : "#3b82f6",
                        color: "white",
                      }}
                    >
                      {linkCopied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      {linkCopied ? "Copié !" : "Copier"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Share button */}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border disabled:opacity-60"
              style={{ background: "white", borderColor: "#e5e7eb", color: "#4b5563" }}
            >
              {sharing
                ? <><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Création du lien…</>
                : <><Share2 className="w-4 h-4 text-blue-500" /> Partager mon rapport</>}
            </button>

            <p className="text-center text-xs text-gray-400">
              {totalWords > 0
                ? `~${estimatedPages} pages · ${totalWords.toLocaleString("fr-FR")} mots · ${figures.length} figure${figures.length !== 1 ? "s" : ""}`
                : "Génère tes sections pour voir les statistiques"}
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          {showChat && !generating && (
            <ChatRevision sectionId="conclusion" sectionLabel="Conclusion" onContentUpdated={(c) => { rawTextRef.current = c; setStreamedContent(markdownToHtml(c)); setStreamedWordCount(c.split(/\s+/).filter(Boolean).length); saveReport({ conclusion: c }); }} onClose={() => setShowChat(false)} />
          )}
          {streamedContent ? (
            <WordPreview
              content={streamedContent}
              rawContent={rawTextRef.current}
              sectionTitle="Conclusion Générale"
              wordCount={streamedWordCount}
              sectionId="conclusion"
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
                Clique sur <strong className="text-gray-600">Générer la Conclusion</strong> : Claude va synthétiser tout ton travail en une conclusion académique complète.
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

    </StepLayout>
  );
}
