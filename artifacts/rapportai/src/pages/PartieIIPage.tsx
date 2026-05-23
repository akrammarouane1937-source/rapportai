import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, RefreshCw, Plus, X,
  Loader2, GripVertical, Wand2, ArrowRight,
  Layers, FileText, Upload, MessageSquare, RotateCcw,
} from "lucide-react";
import { AgentActivityFeed } from "@/components/report/AgentActivityFeed";
import { ChatRevision } from "@/components/report/ChatRevision";
import { useCheckpoint } from "@/lib/useCheckpoint";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { WordPreview } from "@/components/report/WordPreview";
import { PageCard } from "@/components/report/PageCard";
import { useGenerate, ensureSession } from "@/lib/useGenerate";
import { usePageMode } from "@/lib/usePageMode";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { saveReport, getReport } from "@/lib/reportStore";
import { ScholarChips } from "@/components/figures/ScholarChips";
import { FigurePanel } from "@/components/figures/FigurePanel";
import { API_BASE as BASE_PATH } from "@/lib/apiBase";

function KeywordChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(label)}`;
  return (
    <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 text-xs font-medium px-3 py-1.5 rounded-full">
      <a href={scholarUrl} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-purple-400">{label}</a>
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

type GenerationMode = "full" | "page";

export default function PartieIIPage() {
  const [, setLocation] = useLocation();
  const report = getReport();
  const [generationMode, setGenerationMode] = useState<GenerationMode>("full");
  const [keywords, setKeywords] = useState<string[]>(report.motsCles ?? []);

  const {
    pages,
    isGenerating: isPageGenerating,
    isRevising: isPageRevising,
    generateNextPage,
    confirmPage,
    revisePage,
    getAssembledContent,
    resetPages,
    canGenerateNext,
    totalPageCount,
  } = usePageMode("partie-ii");
  const [resultats, setResultats] = useState("");
  const [methodo, setMethodo] = useState("");
  const [chapitres, setChapitres] = useState([
    "Analyse empirique et présentation des résultats",
    "Discussion, limites et recommandations",
  ]);
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [wordCount, setWordCount] = useState(() =>
    report.partieII ? report.partieII.split(/\s+/).filter(Boolean).length : 0
  );
  const [previewContent, setPreviewContent] = useState(() =>
    report.partieII ? markdownToHtml(report.partieII) : ""
  );
  const [humanizing, setHumanizing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "ready" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawTextRef = useRef(report.partieII ?? "");

  const onChunk = useCallback((chunk: string) => {
    rawTextRef.current += chunk;
    const html = markdownToHtml(rawTextRef.current);
    const wc = rawTextRef.current.split(/\s+/).filter(Boolean).length;
    setWordCount(wc);
    setPreviewContent(html);
  }, []);

  const onDone = useCallback(() => {
    saveReport({ partieII: rawTextRef.current });
  }, []);

  const { generate, isStreaming: generating, streamingStatus, activityLog, clearActivity } = useGenerate({
    onChunk,
    onDone,
  });

  const [showChat, setShowChat] = useState(false);
  const [feedDismissed, setFeedDismissed] = useState(false);
  const checkpoint = useCheckpoint("partie-ii");

  const handleGenerate = () => {
    if (rawTextRef.current.trim()) checkpoint.save(rawTextRef.current);
    rawTextRef.current = "";
    setPreviewContent("");
    setWordCount(0);
    setFeedDismissed(false);
    clearActivity();
    setShowChat(false);
    generate({
      section: "partie-ii",
      problematique: resultats || undefined,
      motsCles: keywords,
      extraContext: methodo || undefined,
    });
  };

  const handleHumanize = async () => {
    const original = rawTextRef.current.trim();
    if (!original || humanizing || generating) return;
    setHumanizing(true);
    rawTextRef.current = "";
    setPreviewContent("");
    setWordCount(0);
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
              setPreviewContent(markdownToHtml(rawTextRef.current));
              setWordCount(rawTextRef.current.split(/\s+/).filter(Boolean).length);
            }
            if (j.done) saveReport({ partieII: rawTextRef.current });
          } catch { /* ignore */ }
        }
      }
    } finally {
      setHumanizing(false);
    }
  };

  const [generatingField, setGeneratingField] = useState<string | null>(null);

  const handleRegenerateKeywords = useCallback(async () => {
    if (generatingField) return;
    setGeneratingField("keywords");
    const r = getReport();
    try {
      const resp = await fetch(`${BASE_PATH}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "keywords", theme: r.theme, reportType: r.reportType, school: r.school, filiere: r.filiere }),
      });
      if (!resp.ok || !resp.body) return;
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = ""; let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try { const j = JSON.parse(line.slice(6)) as { content?: string }; if (j.content) raw += j.content; } catch { /* skip */ }
        }
      }
      const parsed = raw.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 8);
      if (parsed.length > 0) { setKeywords(parsed); saveReport({ motsCles: parsed }); }
    } finally { setGeneratingField(null); }
  }, [generatingField]);

  const streamField = useCallback(async (section: string, setter: (v: string) => void) => {
    if (generatingField) return;
    setGeneratingField(section);
    const r = getReport();
    try {
      const resp = await fetch(`${BASE_PATH}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, theme: r.theme, reportType: r.reportType, school: r.school, filiere: r.filiere }),
      });
      if (!resp.ok || !resp.body) return;
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = ""; let result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try { const j = JSON.parse(line.slice(6)) as { content?: string }; if (j.content) { result += j.content; setter(result); } } catch { /* skip */ }
        }
      }
    } finally { setGeneratingField(null); }
  }, [generatingField]);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadedFile(file);
    setUploadStatus("uploading");
    setUploadError(null);
    try {
      const sessionId = await ensureSession();
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${BASE_PATH}/api/session/${sessionId}/upload-document`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      setUploadStatus("ready");
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Erreur d'upload");
    }
  }, []);

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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">Étape 8 sur 9</span>
              <span className="text-xs text-gray-400">Partie II : Analyse empirique & résultats</span>
            </div>
            <div className="flex items-center gap-2">
              {previewContent && !generating && (
                <button onClick={() => setShowChat((v) => !v)} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${showChat ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600"}`}>
                  <MessageSquare className="w-3 h-3" /> Réviser
                </button>
              )}
              {checkpoint.hasCheckpoints() && !generating && (
                <button onClick={() => { const cp = checkpoint.restore(); if (cp) { rawTextRef.current = cp.content; setPreviewContent(markdownToHtml(cp.content)); setWordCount(cp.wordCount); saveReport({ partieII: cp.content }); } }} title={`Restaurer (${checkpoint.latest()?.wordCount.toLocaleString()} mots)`} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-all">
                  <RotateCcw className="w-3 h-3" /> Restaurer
                </button>
              )}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button onClick={() => { setGenerationMode("full"); resetPages(); }} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${generationMode === "full" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  <FileText className="w-3 h-3" /> Tout générer
                </button>
                <button onClick={() => setGenerationMode("page")} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${generationMode === "page" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  <Layers className="w-3 h-3" /> Page par page
                </button>
              </div>
            </div>
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
                      Cadrage IA : Partie II
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRegenerateKeywords}
                      disabled={!!generatingField}
                      className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1 font-medium disabled:opacity-50">
                      {generatingField === "keywords"
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />
                      } Regénérer
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
                <ScholarChips keywords={keywords} section="partie-ii" theme={report.theme} filiere={report.filiere} />
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
                  onClick={() => streamField("contexte", setResultats)}
                  disabled={!!generatingField}
                  className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 disabled:opacity-50">
                  {generatingField === "contexte"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />
                  } Laisser l'IA décider
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
                  onClick={() => streamField("problematique", setMethodo)}
                  disabled={!!generatingField}
                  className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 disabled:opacity-50">
                  {generatingField === "problematique"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />
                  } Laisser l'IA décider
                </button>
              </div>

              {/* Document upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Documents de référence <span className="text-xs font-normal text-gray-400">(résultats, données, rapport de stage…)</span>
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${dragOver ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/30"}`}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
                  {uploadedFile ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {uploadStatus === "uploading" ? <Loader2 className="w-4 h-4 text-purple-500 animate-spin" /> : <span className="text-xs font-bold text-purple-600">DOC</span>}
                        </div>
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[160px]">{uploadedFile.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setUploadStatus("idle"); setUploadError(null); }} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-4 h-4" /></button>
                      </div>
                      {uploadStatus === "uploading" && <p className="text-xs text-purple-500">Extraction du texte…</p>}
                      {uploadStatus === "ready" && <p className="text-xs text-green-600 font-medium">✓ Document prêt. L'IA va le lire.</p>}
                      {uploadStatus === "error" && <p className="text-xs text-red-500">{uploadError}</p>}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 font-medium">Glisse ton document ici</p>
                      <p className="text-xs text-gray-300 mt-1">PDF, Word, TXT · max 20 Mo</p>
                    </>
                  )}
                </div>
              </div>

              <FigurePanel defaultPlacement="Partie II" />

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


            </div>

            {/* Sticky bottom button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0 space-y-2">
              {generationMode === "full" ? (
                <>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || humanizing}
                    className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                    style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {streamingStatus}</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Générer la Partie II</>
                    )}
                  </Button>
                  {previewContent && (
                    <button
                      onClick={handleHumanize}
                      disabled={humanizing || generating}
                      className="w-full h-10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border"
                      style={{ borderColor: "#10b981", color: humanizing ? "#6b7280" : "#059669", background: humanizing ? "#f3f4f6" : "#f0fdf4" }}
                    >
                      {humanizing ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Humanisation en cours...</>
                      ) : (
                        <><Wand2 className="w-3.5 h-3.5" /> Humaniser (Anti-plagiat IA)</>
                      )}
                    </button>
                  )}
                  {previewContent && !generating && !humanizing && (
                    <button
                      onClick={() => setLocation("/rapport/step-9")}
                      className="w-full h-10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white transition-all"
                    >
                      Continuer : Conclusion &amp; Export <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={generateNextPage}
                    disabled={!canGenerateNext}
                    className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ boxShadow: canGenerateNext ? "0 4px 20px rgba(124,58,237,0.35)" : "none" }}
                  >
                    {isPageGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Génération de la page {pages.length + 1}…</>
                    ) : (
                      <><Layers className="w-4 h-4" /> Générer la page suivante</>
                    )}
                  </Button>
                  {pages.length > 0 && pages.every(p => p.status === "confirmed") && (
                    <button
                      onClick={() => {
                        saveReport({ partieII: getAssembledContent() });
                        setLocation("/rapport/step-9");
                      }}
                      className="w-full h-10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white transition-all"
                    >
                      Finaliser et continuer : Conclusion <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT — Word preview (full mode) or Page cards (page mode) */}
          <div className="flex-1 relative overflow-hidden">
            {generationMode === "full" && (generating || (activityLog.length > 0 && !feedDismissed)) && (
              <AgentActivityFeed items={activityLog} isActive={generating} wordCount={wordCount} sectionLabel="la Partie II" onDismiss={() => setFeedDismissed(true)} />
            )}
            {showChat && !generating && (
              <ChatRevision sectionId="partie-ii" sectionLabel="Partie II" onContentUpdated={(c) => { rawTextRef.current = c; setPreviewContent(markdownToHtml(c)); setWordCount(c.split(/\s+/).filter(Boolean).length); saveReport({ partieII: c }); }} onClose={() => setShowChat(false)} />
            )}
            {generationMode === "full" ? (
              <WordPreview
                content={previewContent || undefined}
                rawContent={rawTextRef.current || undefined}
                sectionTitle="Partie II"
                wordCount={wordCount}
                sectionId="partie-ii"
              />
            ) : (
              <div className="h-full overflow-y-auto bg-[#f9f8ff] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Pages générées</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {totalPageCount === 0
                        ? "Clique sur « Générer la page suivante » pour commencer"
                        : `${totalPageCount} page${totalPageCount > 1 ? "s" : ""} · ${pages.filter(p => p.status === "confirmed").length} confirmée${pages.filter(p => p.status === "confirmed").length > 1 ? "s" : ""}`
                      }
                    </p>
                  </div>
                  {totalPageCount > 0 && (
                    <button onClick={resetPages} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                      Recommencer
                    </button>
                  )}
                </div>
                <div className="space-y-0">
                  {pages.map((page) => (
                    <PageCard
                      key={page.pageNum}
                      page={page}
                      onConfirm={() => confirmPage(page.pageNum)}
                      onRevise={(instruction) => revisePage(page.pageNum, instruction)}
                      isRevising={isPageRevising}
                    />
                  ))}
                </div>
                {pages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                    <Layers className="w-10 h-10 mb-3 text-gray-300" />
                    <p className="text-sm font-medium">Mode page par page</p>
                    <p className="text-xs mt-1 text-center max-w-xs">
                      L'IA génère ~350 mots à la fois. Confirme chaque page avant de passer à la suivante.
                    </p>
                  </div>
                )}
                {pages.length > 0 && pages.every(p => p.status === "confirmed") && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-2xl">
                    <p className="text-xs font-semibold text-green-700 mb-1">
                      Section assemblée : {getAssembledContent().split(/\s+/).filter(Boolean).length} mots
                    </p>
                    <p className="text-xs text-green-600">
                      Toutes les pages sont confirmées. Clique sur "Finaliser" pour passer à la Conclusion.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
