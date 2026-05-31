import { useMemo } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Circle, ChevronRight, FileText } from "lucide-react";
import { useReportStore } from "@/lib/store";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wc(text: string | undefined): number {
  return text?.trim() ? text.trim().split(/\s+/).length : 0;
}

function extractFirstHeading(md: string | undefined): string {
  if (!md?.trim()) return "";
  const m = md.match(/^#+\s+(.+)/m);
  return m?.[1]?.trim() ?? "";
}

function extractH2s(md: string | undefined): string[] {
  if (!md?.trim()) return [];
  const matches = [...md.matchAll(/^##\s+(.+)/gm)];
  return matches.slice(0, 6).map((m) => m[1].trim());
}

// ─── Section definition ───────────────────────────────────────────────────────

interface TocSection {
  id: string;
  label: string;
  path: string;
  content: string | undefined;
  sub: string[];
  level: 1;
}

// ─── Dot-leader row ───────────────────────────────────────────────────────────

function TocRow({
  label,
  generatedTitle,
  done,
  words,
  path,
  onClick,
}: {
  label: string;
  generatedTitle?: string;
  done: boolean;
  words: number;
  path: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-colors hover:bg-gray-50 group"
    >
      <div className="flex-shrink-0 mt-0.5">
        {done
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          : <Circle className="w-3.5 h-3.5 text-gray-200" />}
      </div>
      <div className="flex-1 min-w-0">
        {/* Primary: AI-extracted heading when available; fallback to static label */}
        <p className={`text-sm font-semibold leading-tight ${done ? "text-gray-800" : "text-gray-300"}`}>
          {done && generatedTitle && generatedTitle !== label ? generatedTitle : label}
        </p>
        {done && generatedTitle && generatedTitle !== label && (
          <p className="text-[10px] text-gray-300 leading-tight mt-0.5 truncate">{label}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {done && words > 0 && (
          <span className="text-[10px] text-gray-300 tabular-nums">{words.toLocaleString("fr-FR")} mots</span>
        )}
        <ChevronRight className="w-3 h-3 text-gray-200 group-hover:text-purple-400 transition-colors" />
      </div>
    </button>
  );
}

function SubRow({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 pl-9 pr-3 py-1 rounded-lg text-left transition-colors hover:bg-gray-50"
    >
      <span className="w-1 h-1 rounded-full bg-gray-200 flex-shrink-0" />
      <p className="text-xs text-gray-400 truncate leading-tight">{title}</p>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ReportTocProps {
  compact?: boolean;
}

export function ReportToc({ compact = false }: ReportTocProps) {
  const { report } = useReportStore();
  const [, navigate] = useLocation();

  const sections: TocSection[] = useMemo(() => [
    {
      id: "page-de-garde",
      label: "Page de garde",
      path: "/rapport/step-2",
      content: report.studentName ? `# Page de garde\n${report.studentName}` : undefined,
      sub: [],
      level: 1,
    },
    {
      id: "dedicaces",
      label: "Dédicaces & Remerciements",
      path: "/rapport/step-3",
      content: report.dedicaces || report.remerciements,
      sub: [],
      level: 1,
    },
    {
      id: "resume",
      label: "Résumé & Abstract",
      path: "/rapport/step-4",
      content: report.resumeFr || report.abstractEn,
      sub: [],
      level: 1,
    },
    {
      id: "sommaire",
      label: "Sommaire",
      path: "/rapport/step-5",
      content: report.sommaire,
      sub: [],
      level: 1,
    },
    {
      id: "introduction",
      label: "Introduction Générale",
      path: "/rapport/step-6",
      content: report.introduction,
      sub: extractH2s(report.introduction).slice(0, 3),
      level: 1,
    },
    {
      id: "partie-i",
      label: report.partieITitle ? `Partie I — ${report.partieITitle}` : "Partie I",
      path: "/rapport/partie-i",
      content: report.partieI,
      sub: extractH2s(report.partieI),
      level: 1,
    },
    {
      id: "partie-ii",
      label: report.partieIITitle ? `Partie II — ${report.partieIITitle}` : "Partie II",
      path: "/rapport/partie-ii",
      content: report.partieII,
      sub: extractH2s(report.partieII),
      level: 1,
    },
    {
      id: "conclusion",
      label: "Conclusion & Perspectives",
      path: "/rapport/step-9",
      content: report.conclusion,
      sub: [],
      level: 1,
    },
    {
      id: "bibliographie",
      label: "Références bibliographiques",
      path: "/rapport/step-9",
      content: report.bibliographieText,
      sub: [],
      level: 1,
    },
  ], [report]);

  const totalSections = sections.length;
  const doneSections = sections.filter((s) => !!s.content?.trim()).length;

  if (compact) {
    return (
      <div className="space-y-0.5">
        {sections.map((sec) => {
          const done = !!sec.content?.trim();
          const title = extractFirstHeading(sec.content);
          return (
            <TocRow
              key={sec.id}
              label={sec.label}
              generatedTitle={title || undefined}
              done={done}
              words={wc(sec.content)}
              path={sec.path}
              onClick={() => navigate(sec.path)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Progress bar */}
      <div className="flex items-center gap-3 px-3 pb-2 border-b border-gray-100 mb-1">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${(doneSections / totalSections) * 100}%` }}
          />
        </div>
        <span className="text-[11px] text-gray-400 flex-shrink-0 font-medium">
          {doneSections}/{totalSections} sections
        </span>
      </div>

      {sections.map((sec, idx) => {
        const done = !!sec.content?.trim();
        const title = extractFirstHeading(sec.content);
        const pageLabel = idx + 1;

        return (
          <div key={sec.id}>
            <div className="flex items-start">
              <span className="text-[10px] text-gray-200 w-6 flex-shrink-0 pt-2.5 text-right pr-1 tabular-nums font-mono">
                {pageLabel}
              </span>
              <div className="flex-1">
                <TocRow
                  label={sec.label}
                  generatedTitle={title || undefined}
                  done={done}
                  words={wc(sec.content)}
                  path={sec.path}
                  onClick={() => navigate(sec.path)}
                />
                {done && sec.sub.length > 0 && (
                  <div className="pb-1">
                    {sec.sub.map((sub, i) => (
                      <SubRow key={i} title={sub} onClick={() => navigate(sec.path)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {doneSections === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <FileText className="w-8 h-8 text-gray-100 mb-2" />
          <p className="text-xs text-gray-300">Génère des sections pour les voir ici</p>
        </div>
      )}
    </div>
  );
}
