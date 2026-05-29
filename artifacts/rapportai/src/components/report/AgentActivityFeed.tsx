import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export type ActivityItem = {
  id: string;
  tool: string;
  label: string;
  icon: string;
  ts: number;
};

const TOOL_META: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  Read:      { label: "Lecture des fichiers du rapport",   icon: "📖", bg: "bg-blue-50",    text: "text-blue-700"   },
  Write:     { label: "Rédaction en cours",                icon: "✍️", bg: "bg-purple-50",  text: "text-purple-700" },
  Edit:      { label: "Révision chirurgicale",             icon: "✏️", bg: "bg-indigo-50",  text: "text-indigo-700" },
  Glob:      { label: "Exploration de la structure",       icon: "🔍", bg: "bg-gray-100",   text: "text-gray-600"   },
  WebFetch:  { label: "Recherche de sources académiques",  icon: "🌐", bg: "bg-emerald-50", text: "text-emerald-700"},
  WebSearch: { label: "Recherche bibliographique",         icon: "🔎", bg: "bg-teal-50",    text: "text-teal-700"   },
  Bash:      { label: "Traitement des données",            icon: "⚙️", bg: "bg-orange-50",  text: "text-orange-700" },
  Grep:      { label: "Analyse du contenu existant",       icon: "📊", bg: "bg-rose-50",    text: "text-rose-700"   },
};

export function getActivityMeta(tool: string) {
  return TOOL_META[tool] ?? { label: tool, icon: "⚡", bg: "bg-gray-100", text: "text-gray-600" };
}

function buildSummary(items: ActivityItem[], wordCount?: number): string {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.tool] = (counts[item.tool] ?? 0) + 1;
  const parts: string[] = [];
  if (wordCount) parts.push(`${wordCount.toLocaleString()} mots rédigés`);
  const reads = counts["Read"] ?? 0;
  if (reads > 0) parts.push(`${reads} fichier${reads > 1 ? "s" : ""} lu${reads > 1 ? "s" : ""}`);
  const web = (counts["WebFetch"] ?? 0) + (counts["WebSearch"] ?? 0);
  if (web > 0) parts.push(`${web} source${web > 1 ? "s" : ""} académique${web > 1 ? "s" : ""} consultée${web > 1 ? "s" : ""}`);
  const edits = (counts["Edit"] ?? 0) + (counts["Write"] ?? 0);
  if (edits > 0) parts.push(`${edits} écriture${edits > 1 ? "s" : ""}`);
  return parts.join(" · ") || "Section rédigée avec succès.";
}

export function AgentActivityFeed({
  items,
  isActive,
  wordCount,
  sectionLabel,
  onDismiss,
}: {
  items: ActivityItem[];
  isActive: boolean;
  wordCount?: number;
  sectionLabel?: string;
  onDismiss?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  if (!isActive && items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-white/97 backdrop-blur-sm z-10 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? "bg-purple-500 animate-pulse" : "bg-green-500"}`} />
        <span className="text-sm font-bold text-gray-800">
          {isActive
            ? `L'IA rédige ${sectionLabel ?? "la section"}…`
            : `${sectionLabel ?? "Section"} générée avec succès`}
        </span>
        {wordCount != null && wordCount > 0 && (
          <span className="ml-auto text-xs font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full flex-shrink-0">
            {wordCount.toLocaleString()} mots
          </span>
        )}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const meta = getActivityMeta(item.tool);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${meta.bg}`}>
                  {meta.icon}
                </div>
                <span className={`text-sm font-medium ${meta.text}`}>{meta.label}</span>
                <span className="ml-auto text-[10px] text-gray-300 flex-shrink-0 tabular-nums">
                  {new Date(item.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Thinking pulse */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <span className="text-base">🧠</span>
            </div>
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-purple-400"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Summary when done */}
      {!isActive && items.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 bg-green-50 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800 mb-0.5">Génération terminée</p>
              <p className="text-xs text-green-700">{buildSummary(items, wordCount)}</p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs text-green-700 font-semibold hover:text-green-900 flex-shrink-0 underline"
              >
                Voir le rapport
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
