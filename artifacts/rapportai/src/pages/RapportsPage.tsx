import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, FileText, Clock, ChevronRight,
  Trash2, MoreVertical, Edit3, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { Link } from "wouter";
import { getReport, saveReport } from "@/lib/reportStore";

interface Report {
  id: string;
  title: string;
  type: "PFE" | "Rapport de Stage" | "Mémoire";
  school: string;
  field: string;
  status: "draft" | "in_progress" | "completed";
  currentStep: number;
  completedSteps: number[];
  updatedAt: string;
  wordCount: number;
}

function loadRealReports(): Report[] {
  const d = getReport();
  if (!d.theme && !d.school) return [];

  const sections = [d.introduction, d.resume, d.dedicaces, d.remerciements, d.partieI, d.partieII, d.conclusion] as (string | undefined)[];
  const completedSteps = sections
    .map((s, i) => (s && s.trim().length > 50 ? i + 1 : null))
    .filter((v): v is number => v !== null);

  const wordCount = sections
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const status: Report["status"] =
    completedSteps.length === 0 ? "draft"
    : completedSteps.length >= 6 ? "completed"
    : "in_progress";

  const currentStep = completedSteps.length > 0 ? Math.max(...completedSteps) + 1 : 1;

  const type = (d.reportType as Report["type"]) ?? "PFE";

  return [
    {
      id: "current",
      title: d.theme ?? "Rapport sans titre",
      type,
      school:        d.school   ?? "",
      field:         d.filiere  ?? "",
      status,
      currentStep,
      completedSteps,
      updatedAt:     "Maintenant",
      wordCount,
    },
  ];
}

const STEP_LABELS = ["Infos", "Garde", "Dédicaces", "Remerciements", "Sommaire", "Partie I", "Partie II"];

const STATUS_CONFIG = {
  draft: { label: "Brouillon", bg: "bg-gray-100", text: "text-gray-600" },
  in_progress: { label: "En cours", bg: "bg-blue-50", text: "text-blue-600" },
  completed: { label: "Terminé", bg: "bg-green-50", text: "text-green-600" },
};

const TYPE_COLORS: Record<string, string> = {
  "PFE": "bg-purple-50 text-purple-700",
  "Rapport de Stage": "bg-orange-50 text-orange-700",
  "Mémoire": "bg-indigo-50 text-indigo-700",
};

function ReportCard({ report, onDelete }: { report: Report; onDelete: (id: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = STATUS_CONFIG[report.status];
  const progress = Math.round((report.completedSteps.length / 7) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-purple-200 transition-all group"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      data-testid={`report-card-${report.id}`}
    >
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[report.type]}`}>
                  {report.type}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                  {status.label}
                </span>
              </div>
              <h3
                className="font-semibold text-gray-900 text-sm leading-snug truncate"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                title={report.title}
              >
                {report.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">{report.school}</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400">{report.field}</span>
              </div>
            </div>
          </div>
          <div className="relative flex-shrink-0 ml-2">
            <button
              data-testid={`button-menu-report-${report.id}`}
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 w-44 bg-white rounded-xl border border-gray-100 overflow-hidden z-20"
                style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
              >
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Edit3 className="w-4 h-4 text-gray-400" />
                  Renommer
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Download className="w-4 h-4 text-gray-400" />
                  Exporter .docx
                </button>
                <div className="border-t border-gray-100" />
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => { onDelete(report.id); setMenuOpen(false); }}
                  data-testid={`button-delete-report-${report.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">
              {report.completedSteps.length}/{7} sections · {report.wordCount.toLocaleString("fr-FR")} mots
            </span>
            <span className="text-xs font-semibold text-purple-600">{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? "linear-gradient(90deg, #10b981, #34d399)"
                  : "linear-gradient(90deg, #7c3aed, #a855f7)",
              }}
            />
          </div>
        </div>

        {/* Step pills */}
        <div className="flex flex-wrap gap-1 mb-4">
          {STEP_LABELS.map((label, i) => {
            const stepId = i + 1;
            const done = report.completedSteps.includes(stepId);
            const current = report.currentStep === stepId;
            return (
              <span
                key={stepId}
                title={label}
                className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors
                  ${done
                    ? "bg-green-50 text-green-700 border-green-200"
                    : current
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-gray-50 text-gray-400 border-gray-200"
                  }
                `}
              >
                {label}
              </span>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {report.updatedAt}
          </span>
          <button
            data-testid={`button-open-report-${report.id}`}
            className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            {report.status === "completed" ? "Voir" : "Continuer"}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center mb-5">
        <FileText className="w-9 h-9 text-purple-300" />
      </div>
      <h2
        className="text-xl font-bold text-gray-900 mb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Aucun rapport
      </h2>
      <p className="text-gray-500 text-sm max-w-xs mb-6">
        Tu n'as pas encore créé de rapport. Génère ton premier PFE, mémoire ou rapport de stage en 30 minutes.
      </p>
      <Button
        data-testid="button-create-first-report"
        className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
        style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.25)" }}
      >
        <Plus className="w-4 h-4" />
        Créer mon premier rapport
      </Button>
    </motion.div>
  );
}

export default function RapportsPage() {
  const [reports, setReports] = useState<Report[]>(() => loadRealReports());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "in_progress" | "completed">("all");

  useEffect(() => {
    setReports(loadRealReports());
  }, []);

  const filtered = reports
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) =>
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.school.toLowerCase().includes(search.toLowerCase()) ||
      r.field.toLowerCase().includes(search.toLowerCase())
    );

  const deleteReport = (id: string) => {
    if (id === "current") {
      saveReport({ theme: undefined, school: undefined, filiere: undefined, reportType: undefined, partieI: undefined, partieII: undefined, introduction: undefined, conclusion: undefined, resume: undefined, dedicaces: undefined, remerciements: undefined });
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const filterOptions: { value: typeof filter; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "in_progress", label: "En cours" },
    { value: "completed", label: "Terminés" },
    { value: "draft", label: "Brouillons" },
  ];

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
              <div>
                <h1
                  className="text-2xl font-bold text-gray-900"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Mes rapports
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {reports.length} rapport{reports.length !== 1 ? "s" : ""} au total
                </p>
              </div>
              <Button
                data-testid="button-new-report"
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.25)" }}
              >
                <Plus className="w-4 h-4" />
                Nouveau rapport
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  data-testid="input-search-reports"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white border-gray-200 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    data-testid={`filter-${opt.value}`}
                    onClick={() => setFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map((report) => (
                  <ReportCard key={report.id} report={report} onDelete={deleteReport} />
                ))
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <FloatingChat />
    </div>
  );
}
