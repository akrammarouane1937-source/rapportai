import { TrendingUp, CheckSquare, FileText, PenLine } from "lucide-react";

interface StatsRowProps {
  progressionGlobale?: number;
  sectionsCompletes?: number;
  totalSections?: number;
  motsGeneres?: number;
  revisionCount?: number;
  revisionLimit?: number;
}

export function StatsRow({
  progressionGlobale = 0,
  sectionsCompletes = 0,
  totalSections = 7,
  motsGeneres = 0,
  revisionCount = 0,
  revisionLimit = 10,
}: StatsRowProps) {
  const revLimit = revisionLimit === Infinity ? "∞" : revisionLimit;
  const stats = [
    {
      label: "Progression globale",
      value: `${progressionGlobale}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
      sub: progressionGlobale > 0 ? "En cours" : "Pas encore commencé",
    },
    {
      label: "Sections complètes",
      value: `${sectionsCompletes}/${totalSections}`,
      icon: CheckSquare,
      color: "text-green-600",
      bg: "bg-green-50",
      sub: sectionsCompletes === totalSections ? "Terminé ✓" : `${totalSections - sectionsCompletes} restantes`,
    },
    {
      label: "Mots générés",
      value: motsGeneres > 0 ? motsGeneres.toLocaleString("fr-FR") : "0",
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      sub: motsGeneres > 0 ? `~${Math.round(motsGeneres / 250)} pages` : "Aucun contenu",
    },
    {
      label: "Révisions utilisées",
      value: `${revisionCount} / ${revLimit}`,
      icon: PenLine,
      color: revisionCount >= (revisionLimit === Infinity ? Infinity : revisionLimit) ? "text-red-500" : "text-amber-600",
      bg: revisionCount >= (revisionLimit === Infinity ? Infinity : revisionLimit) ? "bg-red-50" : "bg-amber-50",
      sub: revisionCount === 0 ? "Aucune révision" : `${revisionLimit === Infinity || revisionCount < revisionLimit ? "Disponibles" : "Limite atteinte"}`,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-2xl p-5 border border-gray-100"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </div>
          <div
            className="text-2xl font-bold text-gray-900 mb-0.5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {stat.value}
          </div>
          <div className="text-xs font-medium text-gray-700 mb-0.5">{stat.label}</div>
          <div className="text-xs text-gray-400">{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}
