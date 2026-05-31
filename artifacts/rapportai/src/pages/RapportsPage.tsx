import { useState } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { FileText, Search, CheckCircle2, Clock, ChevronRight, LayoutGrid, GripVertical, Lock, ArrowUpDown, ListOrdered, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { useReportStore } from "@/lib/store";
import { ReportToc } from "@/components/report/ReportToc";

// ─── Section definitions ──────────────────────────────────────────────────────

interface SectionConfig {
  id: string;
  label: string;
  field: string | null;
  path: string;
  fixed: boolean; // true = core content, cannot be reordered
}

const FIXED_SECTIONS: SectionConfig[] = [
  { id: "step-1",       label: "Informations générales", field: null,          path: "/rapport/step-1",   fixed: true },
  { id: "step-2",       label: "Page de garde",          field: "pageDeGarde", path: "/rapport/step-2",   fixed: true },
  { id: "step-3",       label: "Dédicaces",              field: "dedicaces",   path: "/rapport/step-3",   fixed: true },
  { id: "step-4",       label: "Résumé & Abstract",      field: "resumeFr",    path: "/rapport/step-4",   fixed: true },
  { id: "step-5",       label: "Sommaire",               field: "sommaire",    path: "/rapport/step-5",   fixed: true },
  { id: "step-6",       label: "Introduction",           field: "introduction",path: "/rapport/step-6",   fixed: true },
  { id: "partie-i",     label: "Partie I",               field: "partieI",     path: "/rapport/partie-i", fixed: true },
  { id: "partie-ii",    label: "Partie II",              field: "partieII",    path: "/rapport/partie-ii",fixed: true },
  { id: "step-9",       label: "Conclusion",             field: "conclusion",  path: "/rapport/step-9",   fixed: true },
];

const BACK_MATTER_META: Record<string, { label: string; field: string | null; path: string }> = {
  bibliographie:     { label: "Bibliographie",       field: "bibliographie",     path: "/rapport/step-9"  },
  abreviations:      { label: "Abréviations",        field: null,                path: "/rapport/step-9"  },
  tableDesFigures:   { label: "Liste des figures",   field: null,                path: "/figures"         },
  listeDesTableaux:  { label: "Liste des tableaux",  field: null,                path: "/figures"         },
  annexes:           { label: "Annexes",             field: null,                path: "/rapport/annexes" },
  tableDesMatieres:  { label: "Table des matières",  field: null,                path: "/rapport/step-9"  },
};

const DEFAULT_ORDER = ["bibliographie", "abreviations", "tableDesFigures", "listeDesTableaux", "annexes", "tableDesMatieres"];

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatus(text: string | null | undefined): "completed" | "in_progress" | "not_started" {
  if (!text || text.trim().length === 0) return "not_started";
  if (text.trim().length >= 100) return "completed";
  return "in_progress";
}

const STATUS_CONFIG = {
  completed:   { label: "Complété",     bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  in_progress: { label: "En cours",     bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  not_started: { label: "Non commencé", bg: "#f9fafb", text: "#9ca3af", dot: "#d1d5db" },
};

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function SectionThumbnail({ text }: { text: string | undefined }) {
  if (!text?.trim()) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: "#f8fafc" }}>
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
          transform: "scale(0.22)", transformOrigin: "top left",
          width: "455%", padding: "24px 28px",
          fontFamily: "Times New Roman, Times, serif",
          fontSize: "11pt", lineHeight: "1.65", color: "#1a1a1a",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}
      >
        {text.slice(0, 1200)}
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 40, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))" }} />
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function StepCard({ section, text, status: statusProp, index, onOpen }: {
  section: SectionConfig;
  text: string | undefined;
  status?: "completed" | "in_progress" | "not_started";
  index: number;
  onOpen: () => void;
}) {
  const status = statusProp ?? (section.field ? getStatus(text) : "not_started");
  const cfg = STATUS_CONFIG[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      transition={{ duration: 0.15 }}
      onClick={onOpen}
      className="rounded-xl overflow-hidden cursor-pointer border"
      style={{ background: "#fff", borderColor: "#e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
    >
      <div className="w-full overflow-hidden relative" style={{ height: 148, borderBottom: "1px solid #f3f4f6" }}>
        <SectionThumbnail text={text} />
        <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "#fff", color: "#7c3aed", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
          {index + 1}
        </div>
        {status === "completed" && (
          <div className="absolute top-2 right-2"><CheckCircle2 className="w-4 h-4" style={{ color: "#22c55e" }} /></div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{section.label}</h3>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>
          {text && text.trim().length > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 250)} min
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Drag row (reorder mode) ──────────────────────────────────────────────────

function DragRow({ id, label, fixed, onOpen }: { id: string; label: string; fixed: boolean; onOpen: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
      style={{
        background: fixed ? "#f9fafb" : "#fff",
        border: `1px solid ${fixed ? "#f3f4f6" : "#ede9fe"}`,
      }}
      onClick={!fixed ? onOpen : undefined}
    >
      <div className="flex-shrink-0" style={{ cursor: fixed ? "default" : "grab", color: fixed ? "#d1d5db" : "#a78bfa" }}>
        {fixed ? <Lock className="w-4 h-4" /> : <GripVertical className="w-4 h-4" />}
      </div>
      <span className="flex-1 text-sm font-medium" style={{ color: fixed ? "#9ca3af" : "#374151" }}>
        {label}
      </span>
      {!fixed && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#f5f0ff", color: "#7c3aed" }}>
          déplaçable
        </span>
      )}
      {fixed && (
        <span className="text-[10px] text-gray-300">position fixe</span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterTab = "all" | "completed" | "in_progress" | "not_started";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all",         label: "Toutes" },
  { id: "completed",   label: "Complétées" },
  { id: "in_progress", label: "En cours" },
  { id: "not_started", label: "Non commencées" },
];

interface RapportsPageProps {
  completedOnly?: boolean;
}

export default function RapportsPage({ completedOnly = false }: RapportsPageProps) {
  const { report, updateReport } = useReportStore();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>(completedOnly ? "completed" : "all");
  const [tocOpen, setTocOpen] = useState(false);

  const reportData = report as unknown as Record<string, string>;

  // Merge saved order with DEFAULT_ORDER so new items (abreviations, etc.)
  // appear for users whose persisted order predates this entry.
  const savedOrder: string[] = report.sectionOrder?.length ? report.sectionOrder : DEFAULT_ORDER;
  const sectionOrder: string[] = [
    ...savedOrder,
    ...DEFAULT_ORDER.filter((id) => !savedOrder.includes(id)),
  ];

  // Compute the display text for a section (handles non-string fields like abréviations).
  const getSectionText = (s: SectionConfig): string | undefined => {
    if (s.id === "abreviations") {
      return report.abreviations?.length > 0
        ? report.abreviations.map((a) => `${a.abbr} : ${a.sig}`).join("\n")
        : undefined;
    }
    return s.field ? reportData[s.field] : undefined;
  };

  // Status for a section — special-case array-typed sections.
  const getSectionStatus = (s: SectionConfig): "completed" | "in_progress" | "not_started" => {
    if (s.id === "abreviations") {
      return report.abreviations?.length > 0 ? "completed" : "not_started";
    }
    return s.field ? getStatus(reportData[s.field]) : "not_started";
  };

  // Build back-matter sections in current order
  const backMatterSections: SectionConfig[] = sectionOrder.map((id) => {
    const meta = BACK_MATTER_META[id];
    return meta ? { id, label: meta.label, field: meta.field, path: meta.path, fixed: false } : null;
  }).filter(Boolean) as SectionConfig[];

  const allSections = [...FIXED_SECTIONS, ...backMatterSections];

  const filteredSections = allSections.filter((s) => {
    const status = getSectionStatus(s);
    const matchesFilter = activeFilter === "all" || status === activeFilter;
    const matchesSearch = !search || s.label.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const completedCount = allSections.filter((s) => getSectionStatus(s) === "completed").length;

  const handleReorder = (newOrder: string[]) => {
    updateReport({ sectionOrder: newOrder });
  };

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
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                  <LayoutGrid className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {completedOnly ? "Sections terminées" : "Mon Rapport"}
                  </h1>
                  <p className="text-xs text-gray-400 mt-0.5">{completedCount}/{allSections.filter(s => s.field).length} sections complétées</p>
                </div>
              </div>

              {!completedOnly && (
                <button
                  onClick={() => setReorderMode((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: reorderMode ? "#7c3aed" : "#fff",
                    color: reorderMode ? "#fff" : "#7c3aed",
                    border: "1px solid #e9d5ff",
                    boxShadow: reorderMode ? "0 2px 8px rgba(124,58,237,0.3)" : "none",
                  }}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {reorderMode ? "Terminer" : "Réorganiser"}
                </button>
              )}
            </div>

            {/* Reorder mode */}
            {reorderMode ? (
              <div className="max-w-xl">
                <p className="text-sm text-gray-500 mb-4">
                  Glisse les sections <span className="text-purple-600 font-medium">déplaçables</span> pour changer leur ordre dans le document exporté. Les sections à position fixe ne peuvent pas être déplacées.
                </p>

                <div className="space-y-2 mb-4">
                  {/* Fixed sections — shown but not draggable */}
                  {FIXED_SECTIONS.map((s) => (
                    <DragRow key={s.id} id={s.id} label={s.label} fixed={true} onOpen={() => navigate(s.path)} />
                  ))}
                </div>

                {/* Draggable back-matter */}
                <Reorder.Group
                  axis="y"
                  values={sectionOrder}
                  onReorder={handleReorder}
                  className="space-y-2"
                  style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
                  {sectionOrder.map((id) => {
                    const meta = BACK_MATTER_META[id];
                    if (!meta) return null;
                    return (
                      <Reorder.Item
                        key={id}
                        value={id}
                        style={{ listStyle: "none" }}
                        whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(124,58,237,0.18)", zIndex: 50 }}
                      >
                        <DragRow id={id} label={meta.label} fixed={false} onOpen={() => navigate(meta.path)} />
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>

                <p className="text-xs text-gray-400 mt-4 text-center">L'ordre est sauvegardé automatiquement et appliqué au Word et PDF.</p>
              </div>
            ) : (
              <>
                {/* Search + Filters */}
                {!completedOnly && (
                  <div className="flex flex-col gap-3 mb-6">
                    <div className="flex items-center gap-3">
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
                    </div>
                    <div className="flex items-center gap-2">
                      {FILTER_TABS.map((tab) => {
                        const isActive = activeFilter === tab.id;
                        const count = tab.id === "all"
                          ? allSections.length
                          : allSections.filter((s) => getSectionStatus(s) === tab.id).length;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveFilter(tab.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: isActive ? (tab.id === "completed" ? "#f0fdf4" : tab.id === "in_progress" ? "#eff6ff" : tab.id === "not_started" ? "#f9fafb" : "#f5f0ff") : "#fff",
                              color: isActive ? (tab.id === "completed" ? "#15803d" : tab.id === "in_progress" ? "#1d4ed8" : tab.id === "not_started" ? "#6b7280" : "#7c3aed") : "#9ca3af",
                              border: `1px solid ${isActive ? (tab.id === "completed" ? "#bbf7d0" : tab.id === "in_progress" ? "#bfdbfe" : tab.id === "not_started" ? "#e5e7eb" : "#e9d5ff") : "#f3f4f6"}`,
                              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                            }}
                          >
                            {tab.id !== "all" && (
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tab.id === "completed" ? "#22c55e" : tab.id === "in_progress" ? "#3b82f6" : "#d1d5db" }} />
                            )}
                            {tab.label}
                            <span className="text-[10px] opacity-60 font-normal ml-0.5">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grid */}
                {filteredSections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#f3f4f6" }}>
                      <FileText className="w-7 h-7 text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">Aucune section trouvée</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredSections.map((section, i) => (
                      <StepCard
                        key={section.id}
                        section={section}
                        text={getSectionText(section)}
                        status={getSectionStatus(section)}
                        index={i}
                        onOpen={() => navigate(section.path)}
                      />
                    ))}
                  </div>
                )}

                {/* ── Table des matières collapsible ── */}
                {!completedOnly && (
                  <div className="mt-6 rounded-2xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setTocOpen((v) => !v)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                           style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                        <ListOrdered className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="flex-1 text-sm font-bold text-gray-800"
                            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Table des matières
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium mr-1">
                        Aperçu de la structure
                      </span>
                      {tocOpen
                        ? <ChevronUp className="w-4 h-4 text-gray-300" />
                        : <ChevronDown className="w-4 h-4 text-gray-300" />}
                    </button>
                    <AnimatePresence>
                      {tocOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-gray-100"
                        >
                          <div className="p-3">
                            <ReportToc />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}

          </motion.div>
        </div>
      </main>

      <FloatingChat />
    </div>
  );
}
