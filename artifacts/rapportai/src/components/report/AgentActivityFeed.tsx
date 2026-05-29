export interface ActivityItem {
  id: string;
  tool: string;
  label: string;
  icon: string;
  ts: number;
}

const TOOL_META: Record<string, { label: string; icon: string }> = {
  WebFetch:  { label: "Recherche académique",        icon: "🔍" },
  Read:      { label: "Lecture des sections",          icon: "📖" },
  Write:     { label: "Rédaction en cours",            icon: "✍️" },
  Edit:      { label: "Révision en cours",             icon: "✏️" },
  Glob:      { label: "Exploration du rapport",        icon: "📂" },
  Bash:      { label: "Traitement des données",        icon: "⚙️" },
  TodoRead:  { label: "Vérification des tâches",       icon: "📋" },
  TodoWrite: { label: "Mise à jour des tâches",        icon: "📝" },
};

export function getActivityMeta(tool: string): { label: string; icon: string } {
  return TOOL_META[tool] ?? { label: tool, icon: "🔧" };
}

interface AgentActivityFeedProps {
  items: ActivityItem[];
  isActive: boolean;
  wordCount?: number;
  sectionLabel: string;
  onDismiss: () => void;
}

export function AgentActivityFeed({ items, isActive, wordCount, sectionLabel, onDismiss }: AgentActivityFeedProps) {
  if (items.length === 0 && !isActive) return null;

  return (
    <div className="mx-4 mb-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-violet-700">
          {isActive ? `Génération de ${sectionLabel} en cours…` : `${sectionLabel} généré`}
          {!!wordCount && wordCount > 0 && (
            <span className="ml-2 font-normal text-violet-500">
              {wordCount.toLocaleString("fr-FR")} mots
            </span>
          )}
        </span>
        {!isActive && (
          <button
            onClick={onDismiss}
            className="text-xs text-violet-400 hover:text-violet-600 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {items.slice(-6).map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs text-violet-600">
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
