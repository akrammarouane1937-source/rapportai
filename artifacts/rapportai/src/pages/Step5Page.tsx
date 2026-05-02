import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { GripVertical, ArrowRight, Info, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { getReport, saveReport } from "@/lib/reportStore";

type SommaireItem = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  page: number;
};

// ── Parse markdown headers from a section blob ─────────────────────────────
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
    // Roughly estimate: every ~30 lines = 1 page
    if (linesSinceLastPage >= 30) {
      estimatedPage++;
      linesSinceLastPage = 0;
    }

    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      results.push({ level: 2, title: h2[1].trim(), page: estimatedPage });
      continue;
    }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      results.push({ level: 3, title: h3[1].trim(), page: estimatedPage });
    }
  }
  return results;
}

// ── Build sommaire from real report data ───────────────────────────────────
function buildSommaire(report: ReturnType<typeof getReport>): SommaireItem[] {
  const items: SommaireItem[] = [];
  let pageCounter = 3;

  const add = (id: string, level: 1 | 2 | 3, title: string, page: number) => {
    items.push({ id, level, title, page });
  };

  // Résumé / Abstract page
  if (report.resume || report.abstract) {
    add("resumé", 1, "Résumé et Abstract", pageCounter);
    pageCounter += 1;
  }

  // Abréviations
  if (report.abreviations && report.abreviations.length > 0) {
    add("abrevs", 1, "Liste des abréviations", pageCounter);
    pageCounter += 1;
  }

  // Introduction
  if (report.introduction) {
    add("intro", 1, "Introduction Générale", pageCounter);
    pageCounter += Math.max(1, Math.ceil(report.introduction.split(/\s+/).length / 350));
  }

  // Partie I
  if (report.partieI) {
    const partieITitle =
      report.partieI.match(/^#\s+(.+)/m)?.[1]?.trim() ??
      report.partieI.match(/^##\s+(.+)/m)?.[1]?.trim() ??
      "Partie I";
    add("p1", 1, partieITitle, pageCounter);
    pageCounter++;

    const subheads = parseHeaders(report.partieI, pageCounter);
    subheads.forEach((h, i) => {
      add(`p1-h${i}`, h.level, h.title, h.page);
    });

    const totalWords = report.partieI.split(/\s+/).length;
    pageCounter += Math.max(2, Math.ceil(totalWords / 350));
  }

  // Partie II
  if (report.partieII) {
    const partieIITitle =
      report.partieII.match(/^#\s+(.+)/m)?.[1]?.trim() ??
      report.partieII.match(/^##\s+(.+)/m)?.[1]?.trim() ??
      "Partie II";
    add("p2", 1, partieIITitle, pageCounter);
    pageCounter++;

    const subheads = parseHeaders(report.partieII, pageCounter);
    subheads.forEach((h, i) => {
      add(`p2-h${i}`, h.level, h.title, h.page);
    });

    const totalWords = report.partieII.split(/\s+/).length;
    pageCounter += Math.max(2, Math.ceil(totalWords / 350));
  }

  // Conclusion
  if (report.conclusion || report.apports || report.perspectives) {
    add("concl", 1, "Conclusion Générale", pageCounter);
    pageCounter += 2;
  }

  // Bibliographie
  add("biblio", 1, "Bibliographie", pageCounter);
  pageCounter += 2;

  // Annexes
  if (report.annexes && report.annexes.length > 0) {
    add("annexes", 1, "Annexes", pageCounter);
  }

  return items;
}

const LEVEL_STYLES: Record<number, string> = {
  1: "font-bold text-gray-900 text-sm",
  2: "font-medium text-gray-700 text-sm",
  3: "text-gray-500 text-xs",
};
const LEVEL_INDENT: Record<number, string> = {
  1: "pl-0",
  2: "pl-5",
  3: "pl-10",
};

export default function Step5Page() {
  const [, setLocation] = useLocation();

  const report = useMemo(() => getReport(), []);

  // Build sommaire from real data, fall back to saved ordering if present
  const [items, setItems] = useState<SommaireItem[]>(() => {
    const built = buildSommaire(report);
    return built;
  });

  const hasContent = items.length > 0;

  // Save ordering whenever it changes
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

  return (
    <StepLayout stepId={5}>
      <div className="max-w-3xl mx-auto px-8 py-8 pb-32">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Info banner */}
          <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-8">
            <Info className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-purple-700">
              Le sommaire est construit automatiquement depuis la structure réelle de votre
              rapport. Les numéros de page sont estimés — ils seront recalculés lors de
              l'export Word final. Réorganisez les sections avec les flèches si besoin.
            </p>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h1
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Sommaire
            </h1>
            <span className="text-xs text-gray-400">
              {items.length} section{items.length !== 1 ? "s" : ""}
            </span>
          </div>

          {!hasContent ? (
            /* Empty state */
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <p className="text-sm text-gray-400 mb-2">
                Aucune section rédigée pour le moment.
              </p>
              <p className="text-xs text-gray-300">
                Complétez d'abord l'introduction, la Partie I et la Partie II — le sommaire
                se construira automatiquement.
              </p>
            </div>
          ) : (
            /* Sommaire items */
            <div
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 group hover:bg-gray-50 transition-colors last:border-b-0`}
                >
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />

                  <div
                    className={`flex-1 flex items-center min-w-0 ${LEVEL_INDENT[item.level]}`}
                  >
                    <span
                      className={`truncate flex-1 ${LEVEL_STYLES[item.level]}`}
                    >
                      {item.title}
                    </span>
                    <div className="flex-1 mx-3 border-b border-dotted border-gray-300 min-w-8" />
                    <span className="text-xs text-gray-400 flex-shrink-0 font-medium w-6 text-right">
                      {item.page}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => move(item.id, -1)}
                      disabled={idx === 0}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30"
                    >
                      <ChevronUp className="w-3 h-3 text-gray-500" />
                    </button>
                    <button
                      onClick={() => move(item.id, 1)}
                      disabled={idx === items.length - 1}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30"
                    >
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
      <div
        className="fixed bottom-0 right-0 bg-white border-t border-gray-100 px-8 py-4 z-30"
        style={{ left: 60 }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-end">
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
