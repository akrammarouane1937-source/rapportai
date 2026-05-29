import { useState } from "react";
import { Check, Pen, Loader2, RefreshCw, X } from "lucide-react";
import { markdownToHtml } from "@/lib/markdownToHtml";
import type { GeneratedPage } from "@/lib/usePageMode";

interface PageCardProps {
  page: GeneratedPage;
  onConfirm: () => void;
  onRevise: (instruction: string) => void;
  isRevising: boolean;
}

export function PageCard({ page, onConfirm, onRevise, isRevising }: PageCardProps) {
  const [revisionMode, setRevisionMode] = useState(false);
  const [instruction, setInstruction] = useState("");

  const wordCount = page.content.split(/\s+/).filter(Boolean).length;

  const handleReviseSubmit = () => {
    if (!instruction.trim() || isRevising) return;
    onRevise(instruction.trim());
    setInstruction("");
    setRevisionMode(false);
  };

  const statusColor: Record<string, string> = {
    confirmed: "border-green-200",
    revising:  "border-amber-300",
    pending:   "border-gray-200",
    generating:"border-purple-200",
  };

  return (
    <div
      className={`border rounded-2xl overflow-hidden shadow-sm mb-4 transition-colors ${statusColor[page.status] ?? "border-gray-200"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-600">Page {page.pageNum}</span>
          {page.status === "confirmed" && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Confirmée
            </span>
          )}
          {page.status === "revising" && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Révision…
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {page.status === "generating" ? "…" : `~${wordCount} mots`}
        </span>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {page.status === "generating" ? (
          <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
            <span className="text-sm">Génération de la page {page.pageNum}…</span>
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(page.content) }}
          />
        )}
      </div>

      {/* Action bar — only when not generating and not already confirmed */}
      {page.status === "pending" && !revisionMode && (
        <div className="flex gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-xl bg-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-purple-700 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Confirmer
          </button>
          <button
            onClick={() => setRevisionMode(true)}
            disabled={isRevising}
            className="flex-1 h-9 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50"
          >
            <Pen className="w-3.5 h-3.5" /> Réviser
          </button>
        </div>
      )}

      {/* Revision panel */}
      {revisionMode && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-amber-800">Quelle modification ?</label>
            <button
              onClick={() => { setRevisionMode(false); setInstruction(""); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            autoFocus
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReviseSubmit();
            }}
            rows={3}
            placeholder="Ex : Raccourcis ce passage, ajoute une citation de Markowitz, reformule le dernier paragraphe…"
            className="w-full text-sm border border-amber-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReviseSubmit}
              disabled={!instruction.trim() || isRevising}
              className="flex-1 h-9 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isRevising
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Révision…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Appliquer</>
              }
            </button>
            <button
              onClick={() => { setRevisionMode(false); setInstruction(""); }}
              className="h-9 px-4 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
          </div>
          <p className="text-xs text-amber-600">⌘ + Entrée pour appliquer</p>
        </div>
      )}
    </div>
  );
}
