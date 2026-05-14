import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { GripVertical, ArrowRight, Info, ChevronUp, ChevronDown, Sparkles, Loader2, Upload, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { getReport, saveReport } from "@/lib/reportStore";
import { ensureSession } from "@/lib/useGenerate";
import { API_BASE } from "@/lib/apiBase";

type SommaireItem = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  page: number;
};

function parseHeaders(
  markdown: string,
  pageOffset: number
): Array<{ level: 2 | 3; title: string; page: number }> {
  const results: Array<{ level: 2 | 3; title: string; page: number }> = [];
  if (!markdown?.trim()) return results;
  const lines = markdown.split("\n");
  let estimatedPage = pageOffset;
  let linesSinceLastPage = 0;
  for (const line of lines) {
    linesSinceLastPage++;
    if (linesSinceLastPage >= 30) { estimatedPage++; linesSinceLastPage = 0; }
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { results.push({ level: 2, title: h2[1].trim(), page: estimatedPage }); continue; }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) { results.push({ level: 3, title: h3[1].trim(), page: estimatedPage }); }
  }
  return results;
}

function buildSommaireItems(report: ReturnType<typeof getReport>): SommaireItem[] {
  const items: SommaireItem[] = [];
  let pageCounter = 3;
  const add = (id: string, level: 1 | 2 | 3, title: string, page: number) => items.push({ id, level, title, page });

  if (report.resume || report.abstract) { add("resumé", 1, "Résumé et Abstract", pageCounter); pageCounter++; }
  if (report.abreviations?.length) { add("abrevs", 1, "Liste des abréviations", pageCounter); pageCounter++; }
  if (report.introduction) {
    add("intro", 1, "Introduction Générale", pageCounter);
    pageCounter += Math.max(1, Math.ceil(report.introduction.split(/\s+/).length / 350));
  }
  if (report.partieI) {
    const t = report.partieI.match(/^#\s+(.+)/m)?.[1]?.trim() ?? report.partieI.match(/^##\s+(.+)/m)?.[1]?.trim() ?? "Partie I";
    add("p1", 1, t, pageCounter); pageCounter++;
    parseHeaders(report.partieI, pageCounter).forEach((h, i) => add(`p1-h${i}`, h.level, h.title, h.page));
    pageCounter += Math.max(2, Math.ceil(report.partieI.split(/\s+/).length / 350));
  }
  if (report.partieII) {
    const t = report.partieII.match(/^#\s+(.+)/m)?.[1]?.trim() ?? report.partieII.match(/^##\s+(.+)/m)?.[1]?.trim() ?? "Partie II";
    add("p2", 1, t, pageCounter); pageCounter++;
    parseHeaders(report.partieII, pageCounter).forEach((h, i) => add(`p2-h${i}`, h.level, h.title, h.page));
    pageCounter += Math.max(2, Math.ceil(report.partieII.split(/\s+/).length / 350));
  }
  if (report.conclusion || report.apports) { add("concl", 1, "Conclusion Générale", pageCounter); pageCounter += 2; }
  add("biblio", 1, "Bibliographie", pageCounter); pageCounter += 2;
  if (report.annexes?.length) { add("annexes", 1, "Annexes", pageCounter); }
  return items;
}

// Parse AI-generated sommaire.md into display items
function parseSommaireText(text: string): SommaireItem[] {
  const items: SommaireItem[] = [];
  let page = 3;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === "# Sommaire") continue;
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { items.push({ id: `ai-${i}`, level: 1, title: h2[1].trim(), page: page++ }); continue; }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) { items.push({ id: `ai-${i}`, level: 2, title: h3[1].trim(), page: page }); continue; }
    const li = line.match(/^-\s+(.+)/);
    if (li) { items.push({ id: `ai-${i}`, level: 3, title: li[1].trim(), page: page }); }
  }
  return items;
}

const LEVEL_STYLES: Record<number, string> = {
  1: "font-bold text-gray-900 text-sm",
  2: "font-medium text-gray-700 text-sm",
  3: "text-gray-500 text-xs",
};
const LEVEL_INDENT: Record<number, string> = { 1: "pl-0", 2: "pl-5", 3: "pl-10" };

export default function Step5Page() {
  const [, setLocation] = useLocation();
  const report = useMemo(() => getReport(), []);

  // AI-generated sommaire text (markdown)
  const [sommaireText, setSommaireText] = useState(report.sommaireText ?? "");
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  // Items: prefer AI-generated if available, else build from existing sections
  const aiItems = useMemo(() => sommaireText ? parseSommaireText(sommaireText) : [], [sommaireText]);
  const autoItems = useMemo(() => buildSommaireItems(report), [report]);
  const [items, setItems] = useState<SommaireItem[]>(() => sommaireText ? parseSommaireText(sommaireText) : buildSommaireItems(report));

  useEffect(() => {
    if (aiItems.length > 0) setItems(aiItems);
    else setItems(autoItems);
  }, [aiItems, autoItems]);

  useEffect(() => {
    const t = setTimeout(() => {
      saveReport({ sommaire: items.map((i) => i.id) } as never);
    }, 600);
    return () => clearTimeout(t);
  }, [items]);

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx + dir < 0 || idx + dir >= items.length) return;
    const next = [...items];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setItems(next);
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenStatus("Démarrage de la session…");
    setSommaireText("");
    try {
      const sessionId = await ensureSession();
      setGenStatus("Génération du plan…");

      const resp = await fetch(`${API_BASE}/api/session/${sessionId}/sommaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as { phase?: string; tool_call?: string; content?: string; sommaire?: string; done?: boolean; error?: string };
            if (msg.error) throw new Error(msg.error);
            if (msg.tool_call) setGenStatus(msg.tool_call === "Write" ? "Enregistrement du plan…" : "Analyse en cours…");
            if (msg.sommaire) {
              setSommaireText(msg.sommaire);
              saveReport({ sommaireText: msg.sommaire });
            }
          } catch (e) { if (e instanceof Error) throw e; }
        }
      }
    } catch (e) {
      console.error("sommaire generation error", e);
    } finally {
      setGenerating(false);
      setGenStatus("");
    }
  };

  const handleUpload = async (file: File) => {
    setUploadStatus("uploading");
    try {
      const sessionId = await ensureSession();
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`${API_BASE}/api/session/${sessionId}/upload-document`, {
        method: "POST",
        body: fd,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setUploadStatus("done");
      // Trigger generation so the agent reads the uploaded plan
      await handleGenerate();
    } catch {
      setUploadStatus("error");
    }
  };

  const hasContent = items.length > 0;

  return (
    <StepLayout stepId={5}>
      <div className="max-w-3xl mx-auto px-8 py-8 pb-32">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Plan du rapport
              </h1>
              <p className="text-xs text-gray-400">
                L'IA génère la structure complète — chapitres, sections, numérotation. Les agents Partie I et II liront ce plan pour s'aligner.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {/* Upload plan button */}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={generating || uploadStatus === "uploading"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors disabled:opacity-50"
              >
                {uploadStatus === "uploading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadStatus === "uploading" ? "Upload…" : uploadStatus === "done" ? "Uploadé ✓" : "Uploader un plan"}
              </button>
              {/* AI generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60"
                style={{ boxShadow: generating ? "none" : "0 2px 8px rgba(124,58,237,0.3)" }}
              >
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {genStatus || "Génération…"}</>
                  : sommaireText
                    ? <><RefreshCw className="w-3.5 h-3.5" /> Regénérer</>
                    : <><Sparkles className="w-3.5 h-3.5" /> Générer avec l'IA</>
                }
              </button>
            </div>
          </div>

          {/* Info banner — show only when no AI plan yet */}
          {!sommaireText && (
            <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-6">
              <Info className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-700">
                Clique sur <strong>Générer avec l'IA</strong> pour créer le plan de ton rapport, ou uploade un plan existant (PDF/Word). Ce plan guidera la Partie I et la Partie II.
              </p>
            </div>
          )}

          {/* Sommaire markdown source — collapsible edit view */}
          {sommaireText && (
            <div className="mb-4">
              <details className="group">
                <summary className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-600 mb-2 list-none">
                  <FileText className="w-3.5 h-3.5" />
                  Voir / modifier le Markdown brut
                </summary>
                <textarea
                  value={sommaireText}
                  onChange={(e) => {
                    setSommaireText(e.target.value);
                    saveReport({ sommaireText: e.target.value });
                  }}
                  rows={12}
                  className="w-full text-xs font-mono border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </details>
            </div>
          )}

          {/* Plan items */}
          {!hasContent && !generating ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <Sparkles className="w-8 h-8 text-purple-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-1">Aucun plan généré</p>
              <p className="text-xs text-gray-300">Clique sur "Générer avec l'IA" pour créer le plan.</p>
            </div>
          ) : generating && items.length === 0 ? (
            <div className="flex items-center gap-3 justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              <span className="text-sm">{genStatus || "Génération en cours…"}</span>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 group hover:bg-gray-50 transition-colors last:border-b-0"
                >
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
                  <div className={`flex-1 flex items-center min-w-0 ${LEVEL_INDENT[item.level]}`}>
                    <span className={`truncate flex-1 ${LEVEL_STYLES[item.level]}`}>{item.title}</span>
                    <div className="flex-1 mx-3 border-b border-dotted border-gray-300 min-w-8" />
                    <span className="text-xs text-gray-400 flex-shrink-0 font-medium w-6 text-right">{item.page}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => move(item.id, -1)} disabled={idx === 0} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30">
                      <ChevronUp className="w-3 h-3 text-gray-500" />
                    </button>
                    <button onClick={() => move(item.id, 1)} disabled={idx === items.length - 1} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30">
                      <ChevronDown className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 right-0 bg-white border-t border-gray-100 px-8 py-4 z-30" style={{ left: 60 }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {sommaireText ? `Plan généré · ${items.length} entrées` : "Plan non généré — vous pouvez continuer sans"}
          </span>
          <Button
            onClick={() => setLocation("/rapport/step-6")}
            className="bg-purple-600 hover:bg-purple-700 text-white h-11 px-6 rounded-xl font-semibold text-sm flex items-center gap-2"
            style={{ boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
          >
            Suivant — Introduction Générale <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </StepLayout>
  );
}
