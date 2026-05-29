import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, Sparkles, Check, X,
  Loader2, BarChart3, TrendingUp, PieChart, Donut,
  ChevronDown, ChevronUp, Image as ImageIcon, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseDataFile, extractLabels, extractSeries, type ParsedDataFile } from "@/lib/parseDataFile";
import { renderChartToPng, renderFallbackChart } from "@/lib/renderChart";
import {
  addApprovedFigure, removeApprovedFigure, getApprovedFigures,
  type ApprovedFigure,
} from "@/lib/figureStore";
import { getReport } from "@/lib/reportStore";

export interface FigureSuggestion {
  id: string;
  figureNumber: number;
  title: string;
  type: "bar" | "line" | "pie" | "doughnut";
  placement: "Partie I" | "Partie II";
  x_column: string | null;
  y_columns: string[];
  description: string;
  caption: string;
  suggested_data?: string;
}

const CHART_ICON: Record<string, React.ReactNode> = {
  bar:      <BarChart3 className="w-4 h-4" />,
  line:     <TrendingUp className="w-4 h-4" />,
  pie:      <PieChart className="w-4 h-4" />,
  doughnut: <Donut className="w-4 h-4" />,
};

const CHART_LABEL: Record<string, string> = {
  bar: "Diagramme en barres", line: "Courbe", pie: "Camembert", doughnut: "Anneau",
};

async function analyzeFigures(
  parsed: ParsedDataFile | null,
  ctx: { theme?: string; school?: string; filiere?: string; reportType?: string },
): Promise<FigureSuggestion[]> {
  const body = {
    columns:       parsed?.columns ?? [],
    preview:       parsed?.preview ?? "",
    rowCount:      parsed?.rowCount,
    filename:      parsed?.filename,
    reportContext: ctx,
  };
  const res = await fetch("/api/figures/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { figures: FigureSuggestion[]; error?: string };
  return data.figures ?? [];
}

async function buildApprovedFigure(
  sug: FigureSuggestion,
  parsed: ParsedDataFile | null,
  existingCount: number,
): Promise<ApprovedFigure> {
  let labels: string[] = [];
  let data: number[] = [];

  if (parsed && sug.x_column && sug.y_columns[0]) {
    labels = extractLabels(parsed.rows, sug.x_column);
    data   = extractSeries(parsed.rows, sug.y_columns[0]);
    // Trim to same length
    const len = Math.min(labels.length, data.length, 12);
    labels = labels.slice(0, len);
    data   = data.slice(0, len);
  }

  const hasRealData = labels.length > 0 && data.length > 0;
  const pngBase64 = hasRealData
    ? await renderChartToPng(sug.type, labels, [{ label: sug.y_columns[0] ?? "Valeur", data }], sug.title)
    : await renderFallbackChart(sug.type, sug.title);

  return {
    id:          sug.id,
    figureNumber: existingCount + 1,
    title:       sug.title,
    caption:     sug.caption,
    type:        sug.type,
    placement:   sug.placement,
    description: sug.description,
    sourceType:  "self" as const,
    source:      "Élaboré par l'auteur",
    author:      "Auteur propre",
    formattedSource: `Source : Élaboré par l'auteur, ${new Date().getFullYear()}`,
    pngBase64,
    labels:      hasRealData ? labels : ["2020","2021","2022","2023","2024"],
    series:      hasRealData ? data   : [42,58,63,71,85],
    width: 500,
    height: 280,
  };
}

interface SuggestionCardProps {
  sug: FigureSuggestion;
  parsed: ParsedDataFile | null;
  onApprove: (sug: FigureSuggestion) => void;
  onReject: (id: string) => void;
  approving: boolean;
}

function SuggestionCard({ sug, onApprove, onReject, approving }: SuggestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
          {CHART_ICON[sug.type] ?? <BarChart3 className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              {CHART_LABEL[sug.type]}
            </span>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
              {sug.placement}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-snug">{sug.caption}</p>
        </div>
      </div>

      {/* Description + data info */}
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-500 italic leading-relaxed mb-2">
          « {sug.description} »
        </p>
        {sug.x_column && (
          <p className="text-xs text-gray-400">
            Axes : <span className="font-medium text-gray-600">{sug.x_column}</span>
            {sug.y_columns[0] && <> → <span className="font-medium text-gray-600">{sug.y_columns[0]}</span></>}
          </p>
        )}
        {sug.suggested_data && (
          <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
            <p className="text-xs text-amber-700 font-medium">Données à collecter :</p>
            <p className="text-xs text-amber-600 mt-0.5">{sug.suggested_data}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <Button
          onClick={() => onApprove(sug)}
          disabled={approving}
          size="sm"
          className="flex-1 h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg gap-1.5 disabled:opacity-60"
        >
          {approving
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Génération…</>
            : <><Check className="w-3 h-3" /> Approuver</>
          }
        </Button>
        <Button
          onClick={() => onReject(sug.id)}
          disabled={approving}
          size="sm"
          variant="ghost"
          className="h-8 px-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

interface ApprovedCardProps {
  fig: ApprovedFigure;
  onRemove: (id: string) => void;
}

function ApprovedCard({ fig, onRemove }: ApprovedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-white border border-green-200 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="flex items-start gap-3 p-3">
        <img
          src={fig.pngBase64}
          alt={fig.caption}
          className="w-20 h-12 object-cover rounded-lg border border-gray-100 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-semibold text-gray-800 leading-snug">{fig.caption}</p>
            <button
              onClick={() => onRemove(fig.id)}
              className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
              <Check className="w-2.5 h-2.5" /> Approuvée
            </span>
            <span className="text-xs text-gray-400">{fig.placement}</span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <p className="text-xs text-gray-400 italic leading-relaxed">
          « {fig.description.slice(0, 90)}{fig.description.length > 90 ? "…" : ""} »
        </p>
      </div>
    </motion.div>
  );
}

interface FigurePanelProps {
  /** Which partie these figures will belong to (for the docx placement). Not used for filtering. */
  defaultPlacement?: "Partie I" | "Partie II";
}

export function FigurePanel({ defaultPlacement = "Partie II" }: FigurePanelProps) {
  const report = getReport();
  const [open, setOpen] = useState(false);
  const [parsedFile, setParsedFile] = useState<ParsedDataFile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<FigureSuggestion[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approved, setApproved] = useState<ApprovedFigure[]>(getApprovedFigures);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    setParsing(true);
    try {
      const parsed = await parseDataFile(file);
      setParsedFile(parsed);
      setSuggestions([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Erreur de lecture");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setSuggestions([]);
    try {
      const figs = await analyzeFigures(parsedFile, {
        theme:      report.theme,
        school:     report.school,
        filiere:    report.filiere,
        reportType: report.reportType,
      });
      setSuggestions(figs);
    } catch {
      setSuggestions([]);
    } finally {
      setAnalyzing(false);
    }
  }, [parsedFile, report.theme, report.school, report.filiere, report.reportType]);

  const handleApprove = useCallback(async (sug: FigureSuggestion) => {
    setApprovingId(sug.id);
    try {
      const currentApproved = getApprovedFigures();
      const fig = await buildApprovedFigure(sug, parsedFile, currentApproved.length);
      addApprovedFigure(fig);
      setApproved(getApprovedFigures());
      setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
    } finally {
      setApprovingId(null);
    }
  }, [parsedFile]);

  const handleReject = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleRemoveApproved = useCallback((id: string) => {
    removeApprovedFigure(id);
    setApproved(getApprovedFigures());
  }, []);

  const approvedForSection = approved; // show all, docx placement handles filtering

  return (
    <div className="mt-4 border border-purple-100 rounded-2xl overflow-hidden bg-purple-50/40">
      {/* Header — always visible, toggles body */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-900">Figures & Données</span>
            {approvedForSection.length > 0 && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                {approvedForSection.length} figure{approvedForSection.length > 1 ? "s" : ""} approuvée{approvedForSection.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">

              {/* File upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
                  ${dragOver ? "border-purple-400 bg-purple-50" : parsedFile ? "border-green-300 bg-green-50/60" : "border-purple-200 hover:border-purple-300 hover:bg-white/60"}
                `}
              >
                {parsing ? (
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                ) : parsedFile ? (
                  <>
                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                    <div className="text-center">
                      <p className="text-xs font-semibold text-green-700">{parsedFile.filename}</p>
                      <p className="text-xs text-green-600">{parsedFile.rowCount} lignes · {parsedFile.columns.length} colonnes</p>
                      <p className="text-xs text-gray-400 mt-0.5">Colonnes : {parsedFile.columns.slice(0, 4).join(", ")}{parsedFile.columns.length > 4 ? "…" : ""}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-purple-400" />
                    <div className="text-center">
                      <p className="text-xs font-semibold text-gray-700">Glissez un fichier CSV ou Excel</p>
                      <p className="text-xs text-gray-400">ou cliquez pour sélectionner</p>
                    </div>
                  </>
                )}
                {parseError && <p className="text-xs text-red-500 text-center">{parseError}</p>}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {/* Analyze button */}
              <Button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl gap-2 disabled:opacity-60"
              >
                {analyzing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</>
                  : parsedFile
                  ? <><Sparkles className="w-4 h-4" /> Analyser les données avec l'IA</>
                  : <><Sparkles className="w-4 h-4" /> Suggérer des figures (sans données)</>
                }
              </Button>

              {/* Suggestions */}
              <AnimatePresence mode="popLayout">
                {suggestions.length > 0 && (
                  <motion.div key="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Suggestions ({suggestions.length})
                    </p>
                    <div className="space-y-3">
                      {suggestions.map((sug) => (
                        <SuggestionCard
                          key={sug.id}
                          sug={sug}
                          parsed={parsedFile}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          approving={approvingId === sug.id}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Approved figures */}
              <AnimatePresence mode="popLayout">
                {approvedForSection.length > 0 && (
                  <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Figures approuvées, seront insérées dans le .docx
                    </p>
                    <div className="space-y-2.5">
                      {approvedForSection.map((fig) => (
                        <ApprovedCard key={fig.id} fig={fig} onRemove={handleRemoveApproved} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {!analyzing && suggestions.length === 0 && approvedForSection.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  Cliquez sur "Suggérer des figures" pour commencer,<br />même sans données importées.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
