import { useLocation } from "wouter";
import { useReportStore } from "@/lib/store";
import { motion } from "framer-motion";
import { FileText, AlertTriangle, ChevronRight, BookOpen } from "lucide-react";

interface SectionDef {
  key: string;
  label: string;
  path: string;
  step: number;
}

const SECTIONS: SectionDef[] = [
  { key: "pageDeGarde",   label: "Page de garde",    path: "/rapport/step-2",    step: 2 },
  { key: "dedicaces",     label: "Dédicaces",         path: "/rapport/step-3",    step: 3 },
  { key: "remerciements", label: "Remerciements",     path: "/rapport/step-3",    step: 3 },
  { key: "resumeFr",      label: "Résumé & Abstract", path: "/rapport/step-4",    step: 4 },
  { key: "sommaire",      label: "Sommaire",           path: "/rapport/step-5",    step: 5 },
  { key: "introduction",  label: "Introduction",       path: "/rapport/step-6",    step: 6 },
  { key: "partieI",       label: "Partie I",           path: "/rapport/partie-i",  step: 7 },
  { key: "partieII",      label: "Partie II",          path: "/rapport/partie-ii", step: 8 },
  { key: "conclusion",    label: "Conclusion",         path: "/rapport/step-9",    step: 9 },
];

function wordCount(text: string | undefined): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function pageEstimate(words: number): number {
  return Math.max(1, Math.round(words / 250));
}

function barWidth(words: number, maxWords: number): string {
  if (maxWords === 0) return "0%";
  return `${Math.min(100, Math.round((words / maxWords) * 100))}%`;
}

export default function ReportProgressCard() {
  const [, setLocation] = useLocation();
  const { report } = useReportStore();

  const sectionData = SECTIONS.map((s) => ({
    ...s,
    words: wordCount((report as unknown as Record<string, string>)[s.key]),
    generated: !!((report as unknown as Record<string, string>)[s.key]?.trim()),
  }));

  const totalWords = sectionData.reduce((acc, s) => acc + s.words, 0);
  const pages = pageEstimate(totalWords);
  const generatedCount = sectionData.filter((s) => s.generated).length;

  const maxSectionWords = Math.max(...sectionData.map((s) => s.words), 1);

  const partieIWords = wordCount(report.partieI);
  const partieIIWords = wordCount(report.partieII);
  const bothPartiesGenerated = partieIWords > 0 && partieIIWords > 0;
  const ratio = bothPartiesGenerated
    ? Math.max(partieIWords, partieIIWords) / Math.min(partieIWords, partieIIWords)
    : 0;
  const imbalanced = bothPartiesGenerated && ratio > 1.6;
  const heavierPart = partieIWords >= partieIIWords ? "Partie I" : "Partie II";

  if (generatedCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#ede9fe,#ddd6fe)" }}>
          <BookOpen className="w-4 h-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Progression du rapport
          </p>
          <p className="text-[11px] text-gray-400">{generatedCount}/9 sections · {totalWords.toLocaleString("fr-FR")} mots · ~{pages} page{pages > 1 ? "s" : ""}</p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
          {Math.round((generatedCount / 9) * 100)}%
        </span>
      </div>

      {/* Imbalance warning */}
      {imbalanced && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 leading-snug">
            <span className="font-semibold">{heavierPart}</span> est {ratio.toFixed(1)}× plus longue que l'autre — déséquilibre détecté.
          </p>
        </div>
      )}

      {/* Section list */}
      <div className="px-5 py-3 space-y-1">
        {sectionData.map((s) => (
          <button
            key={s.key}
            onClick={() => setLocation(s.path)}
            className="w-full flex items-center gap-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors group px-2 -mx-2"
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.generated ? "bg-purple-500" : "bg-gray-200"}`} />
            <span className={`text-xs w-28 text-left truncate flex-shrink-0 ${s.generated ? "text-gray-700 font-medium" : "text-gray-400"}`}>
              {s.label}
            </span>
            {/* Progress bar */}
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              {s.generated && (
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: barWidth(s.words, maxSectionWords),
                    background: s.key === "partieI" || s.key === "partieII"
                      ? "linear-gradient(90deg,#7c3aed,#a855f7)"
                      : "linear-gradient(90deg,#a78bfa,#c4b5fd)",
                  }}
                />
              )}
            </div>
            {s.generated ? (
              <span className="text-[10px] text-gray-400 w-16 text-right flex-shrink-0">
                {s.words.toLocaleString("fr-FR")} mots
              </span>
            ) : (
              <span className="text-[10px] text-gray-300 w-16 text-right flex-shrink-0">—</span>
            )}
            <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-purple-400 transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Partie I vs II balance bar (when both exist) */}
      {bothPartiesGenerated && (
        <div className="px-5 pb-4 pt-1">
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500">Équilibre Partie I / II</span>
              {imbalanced
                ? <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Déséquilibre</span>
                : <span className="text-[10px] text-green-500 font-semibold">✓ Équilibré</span>
              }
            </div>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
              <div
                className="h-full rounded-l-full transition-all duration-700"
                style={{
                  width: `${Math.round((partieIWords / (partieIWords + partieIIWords)) * 100)}%`,
                  background: "linear-gradient(90deg,#7c3aed,#a855f7)",
                }}
                title={`Partie I : ${partieIWords.toLocaleString("fr-FR")} mots`}
              />
              <div
                className="h-full rounded-r-full transition-all duration-700"
                style={{
                  width: `${Math.round((partieIIWords / (partieIWords + partieIIWords)) * 100)}%`,
                  background: "linear-gradient(90deg,#f59e0b,#fbbf24)",
                }}
                title={`Partie II : ${partieIIWords.toLocaleString("fr-FR")} mots`}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-purple-600 font-medium">Partie I · {partieIWords.toLocaleString("fr-FR")} mots</span>
              <span className="text-[10px] text-amber-500 font-medium">Partie II · {partieIIWords.toLocaleString("fr-FR")} mots</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer total */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] text-gray-500">{totalWords.toLocaleString("fr-FR")} mots au total</span>
        </div>
        <span className="text-[11px] font-semibold text-gray-700">~{pages} page{pages > 1 ? "s" : ""} estimée{pages > 1 ? "s" : ""}</span>
      </div>
    </motion.div>
  );
}
