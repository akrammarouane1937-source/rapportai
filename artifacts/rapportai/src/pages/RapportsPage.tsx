import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Search, CheckCircle2, Clock, ChevronRight, LayoutGrid } from "lucide-react";
import { useLocation } from "wouter";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { useReportStore } from "@/lib/store";

interface StepConfig {
  id: number;
  label: string;
  field: string | null;
  path: string;
}

const STEPS: StepConfig[] = [
  { id: 1, label: "Informations générales", field: null,            path: "/rapport/step-1"  },
  { id: 2, label: "Page de garde",          field: "pageDeGarde",  path: "/rapport/step-2"  },
  { id: 3, label: "Dédicaces",              field: "dedicaces",    path: "/rapport/step-3"  },
  { id: 4, label: "Résumé & Abstract",      field: "resumeFr",     path: "/rapport/step-4"  },
  { id: 5, label: "Sommaire",               field: "sommaire",     path: "/rapport/step-5"  },
  { id: 6, label: "Introduction",           field: "introduction", path: "/rapport/step-6"  },
  { id: 7, label: "Partie I",               field: "partieI",      path: "/rapport/partie-i"},
  { id: 8, label: "Partie II",              field: "partieII",     path: "/rapport/partie-ii"},
  { id: 9, label: "Conclusion",             field: "conclusion",   path: "/rapport/step-9"  },
];

type FilterStatus = "all" | "completed" | "in_progress" | "not_started";

function getStatus(text: string | null | undefined): "completed" | "in_progress" | "not_started" {
  if (!text || text.trim().length === 0) return "not_started";
  if (text.trim().length >= 100) return "completed";
  return "in_progress";
}

const STATUS_CONFIG = {
  completed:   { label: "Complété",       bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  in_progress: { label: "En cours",       bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  not_started: { label: "Non commencé",   bg: "#f9fafb", text: "#9ca3af", dot: "#d1d5db" },
};

function SectionThumbnail({ text }: { text: string | undefined }) {
  if (!text?.trim()) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center"
        style={{ background: "#f8fafc" }}
      >
        <FileText className="w-8 h-8 mb-1.5" style={{ color: "#e2e8f0" }} />
        <span className="text-xs" style={{ color: "#cbd5e1" }}>Non commencé</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden relative" style={{ background: "#fff" }}>
      <div
        className="absolute top-0 left-0 pointer-events-none select-none"
        style={{
          transform: "scale(0.22)",
          transformOrigin: "top left",
          width: "455%",
          padding: "24px 28px",
          fontFamily: "Times New Roman, Times, serif",
          fontSize: "11pt",
          lineHeight: "1.65",
          color: "#1a1a1a",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text.slice(0, 1200)}
      </div>
      {/* fade at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 40, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))" }}
      />
    </div>
  );
}

function StepCard({ step, text, onOpen }: { step: StepConfig; text: string | undefined; onOpen: () => void }) {
  const status = step.field ? getStatus(text) : "not_started";
  const cfg    = STATUS_CONFIG[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      transition={{ duration: 0.15 }}
      onClick={onOpen}
      className="rounded-xl overflow-hidden cursor-pointer border"
      style={{
        background: "#fff",
        borderColor: "#e5e7eb",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="w-full overflow-hidden relative"
        style={{ height: 148, borderBottom: "1px solid #f3f4f6" }}
      >
        <SectionThumbnail text={text} />

        {/* Step number badge */}
        <div
          className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: "#fff", color: "#7c3aed", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
        >
          {step.id}
        </div>

        {/* Status dot */}
        {status === "completed" && (
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: "#22c55e" }} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {step.label}
          </h3>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>

          {text && text.trim().length > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 250)} min de lecture
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface RapportsPageProps {
  completedOnly?: boolean;
}

export default function RapportsPage({ completedOnly = false }: RapportsPageProps) {
  const { report } = useReportStore();
  const [, navigate]  = useLocation();
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<FilterStatus>(completedOnly ? "completed" : "all");

  const reportData = report as Record<string, string>;

  const filtered = STEPS.filter((step) => {
    const text   = step.field ? reportData[step.field] : undefined;
    const status = step.field ? getStatus(text) : "not_started";

    if (search && !step.label.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "all") return true;
    return status === filter;
  });

  const completedCount = STEPS.filter((s) => s.field && getStatus(reportData[s.field]) === "completed").length;

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: "all",          label: "Toutes" },
    { value: "completed",    label: "Complétées" },
    { value: "in_progress",  label: "En cours" },
    { value: "not_started",  label: "Non commencées" },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "#f9f8ff" }}>
      <Sidebar />
      <SidebarSpacer />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
                >
                  <LayoutGrid className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1
                    className="text-xl font-bold text-gray-900"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {completedOnly ? "Sections terminées" : "Mon Rapport"}
                  </h1>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {completedCount}/9 sections complétées
                  </p>
                </div>
              </div>
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  placeholder="Rechercher une section..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-purple-400 transition-colors"
                  style={{ width: 220 }}
                />
              </div>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      filter === opt.value
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Steps grid */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#f3f4f6" }}>
                  <FileText className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Aucune section trouvée</p>
                <p className="text-xs text-gray-400">
                  {filter !== "all" ? "Change le filtre pour voir d'autres sections." : "Commence ton rapport pour voir les sections ici."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filtered.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    text={step.field ? reportData[step.field] : undefined}
                    onOpen={() => navigate(step.path)}
                  />
                ))}
              </div>
            )}

          </motion.div>
        </div>
      </main>

      <FloatingChat />
    </div>
  );
}

