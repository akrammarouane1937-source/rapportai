import { motion } from "framer-motion";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, FileText, BookOpen, MessageSquare,
  ImageIcon, Settings, LogOut, Plus, ChevronRight,
  TrendingUp, CheckSquare, Clock, Search, Filter,
  MoreVertical, Download, Edit3, Trash2, X, Send, Sparkles,
  Upload, ZoomIn, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { ActiveReportCard } from "@/components/dashboard/ActiveReportCard";
import { FiguresPanel } from "@/components/dashboard/FiguresPanel";
import { FloatingChat } from "@/components/dashboard/FloatingChat";

const NAV = [
  { icon: LayoutDashboard, label: "Tableau de bord", id: "dashboard" },
  { icon: FileText, label: "Mes rapports", id: "rapports" },
  { icon: BookOpen, label: "Bibliothèque", id: "bibliotheque", pro: true },
  { icon: MessageSquare, label: "JuryAI", id: "juryai", pro: true },
  { icon: ImageIcon, label: "Figures", id: "figures" },
  { icon: Settings, label: "Paramètres", id: "parametres" },
];

const MOCK_REPORTS = [
  {
    id: "1", title: "Optimisation de portefeuille — EMSI Finance",
    type: "PFE" as const, school: "EMSI", field: "Finance",
    status: "in_progress" as const, currentStep: 3, completedSteps: [1, 2],
    updatedAt: "Il y a 2 heures", wordCount: 3240,
  },
  {
    id: "2", title: "Transformation digitale des PME marocaines",
    type: "Mémoire" as const, school: "ENCG", field: "Management",
    status: "completed" as const, currentStep: 7, completedSteps: [1,2,3,4,5,6,7],
    updatedAt: "Hier", wordCount: 18650,
  },
  {
    id: "3", title: "Analyse des risques opérationnels — BCP",
    type: "Rapport de Stage" as const, school: "ISCAE", field: "Finance",
    status: "draft" as const, currentStep: 1, completedSteps: [] as number[],
    updatedAt: "Il y a 3 jours", wordCount: 0,
  },
];

const STATUS_CFG = {
  draft: { label: "Brouillon", bg: "bg-gray-100", text: "text-gray-600" },
  in_progress: { label: "En cours", bg: "bg-blue-50", text: "text-blue-600" },
  completed: { label: "Terminé", bg: "bg-green-50", text: "text-green-600" },
};

const TYPE_COLORS: Record<string, string> = {
  "PFE": "bg-purple-50 text-purple-700",
  "Rapport de Stage": "bg-orange-50 text-orange-700",
  "Mémoire": "bg-indigo-50 text-indigo-700",
};

const STEPS = ["Infos","Garde","Dédicaces","Remerciements","Sommaire","Partie I","Partie II"];

function DemoSidebar({ active, setActive, hovered, setHovered }: {
  active: string; setActive: (v: string) => void;
  hovered: boolean; setHovered: (v: boolean) => void;
}) {
  const w = hovered ? 220 : 60;
  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: w, minWidth: w, transition: "width 200ms ease, min-width 200ms ease" }}
      className="fixed inset-y-0 left-0 bg-white border-r border-gray-100 flex flex-col z-40 overflow-hidden"
    >
      <div className="flex items-center border-b border-gray-100 flex-shrink-0"
        style={{ height: 64, paddingLeft: hovered ? 20 : 0, justifyContent: hovered ? "flex-start" : "center", transition: "padding 200ms ease" }}>
        <img src="/logo.svg" alt="RapportAI" className="w-8 h-8 flex-shrink-0" />
        <span className="font-bold text-gray-900 text-base ml-3 whitespace-nowrap overflow-hidden"
          style={{ opacity: hovered ? 1 : 0, maxWidth: hovered ? 120 : 0, transition: "opacity 150ms ease, max-width 200ms ease", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          RapportAI
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <button key={item.id}
              onClick={() => !item.pro && setActive(item.id)}
              title={!hovered ? item.label : undefined}
              className={`w-full flex items-center rounded-xl transition-all text-left group ${isActive ? "bg-purple-50" : item.pro ? "cursor-not-allowed" : "hover:bg-gray-50"}`}
              style={{ height: 40, paddingLeft: hovered ? 12 : 0, paddingRight: hovered ? 8 : 0, justifyContent: hovered ? "flex-start" : "center", transition: "padding 200ms ease" }}
            >
              <item.icon className={`flex-shrink-0 w-4 h-4 ${isActive ? "text-purple-600" : item.pro ? "text-gray-300" : "text-gray-400 group-hover:text-gray-600"}`} />
              <span className={`ml-3 text-sm font-medium whitespace-nowrap overflow-hidden ${isActive ? "text-purple-700" : item.pro ? "text-gray-300" : "text-gray-600"}`}
                style={{ opacity: hovered ? 1 : 0, maxWidth: hovered ? 120 : 0, transition: "opacity 150ms ease, max-width 200ms ease" }}>
                {item.label}
              </span>
              {hovered && item.pro && (
                <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Pro</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 py-3 px-2 space-y-0.5 flex-shrink-0">
        <div className="flex items-center rounded-xl"
          style={{ height: 44, paddingLeft: hovered ? 8 : 0, justifyContent: hovered ? "flex-start" : "center", transition: "padding 200ms ease" }}>
          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <span className="text-purple-600 font-semibold text-xs">A</span>
          </div>
          <div className="ml-2.5 flex-1 overflow-hidden"
            style={{ opacity: hovered ? 1 : 0, maxWidth: hovered ? 120 : 0, transition: "opacity 150ms ease, max-width 200ms ease" }}>
            <div className="text-xs font-medium text-gray-800 truncate">Ahmed Benali</div>
            <div className="text-xs text-gray-400 truncate">Plan gratuit</div>
          </div>
        </div>
        <button className="w-full flex items-center rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all"
          style={{ height: 36, paddingLeft: hovered ? 10 : 0, justifyContent: hovered ? "flex-start" : "center", transition: "padding 200ms ease" }}>
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="ml-2.5 whitespace-nowrap overflow-hidden text-sm"
            style={{ opacity: hovered ? 1 : 0, maxWidth: hovered ? 100 : 0, transition: "opacity 150ms ease, max-width 200ms ease" }}>
            Déconnexion
          </span>
        </button>
      </div>
    </aside>
  );
}

function DashboardView({ setActive }: { setActive: (v: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Bonjour, Ahmed 👋
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Tu as un rapport en cours. Continue là où tu t'es arrêté.</p>
        </div>
        <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white" style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.25)" }}>
          <Plus className="w-4 h-4" /> Nouveau rapport
        </Button>
      </div>
      <div className="mb-6">
        <StatsRow progressionGlobale={28} sectionsCompletes={2} totalSections={7} motsGeneres={3240} revisionCount={2} revisionLimit={10} />
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rapport en cours</h2>
          <button onClick={() => setActive("rapports")} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium">
            Voir tous les rapports <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <ActiveReportCard
          title="Optimisation de portefeuille — EMSI Finance"
          type="PFE" currentStep={3} completedSteps={[1, 2]}
          updatedAt="Il y a 2 heures" onContinue={() => setActive("rapports")}
        />
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3"><FiguresPanel /></div>
        <div className="col-span-2">
          <div className="h-full rounded-2xl overflow-hidden text-white flex flex-col justify-between p-5"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)", boxShadow: "0 4px 24px rgba(124,58,237,0.2)" }}>
            <div>
              <div className="text-xs font-semibold text-purple-200 uppercase tracking-wider mb-2">Pro &amp; Premium</div>
              <h3 className="text-lg font-bold leading-snug mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Prépare ta soutenance avec JuryAI
              </h3>
              <p className="text-purple-200 text-xs leading-relaxed">
                Simule les questions de ton jury et arrive le jour J en sachant exactement quoi dire.
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-white/40 text-white hover:bg-white/10 mt-4 self-start text-xs">
              Découvrir JuryAI <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ReportCard({ report }: { report: typeof MOCK_REPORTS[0] }) {
  const status = STATUS_CFG[report.status];
  const progress = Math.round((report.completedSteps.length / 7) * 100);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-purple-200 transition-all"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[report.type]}`}>{report.type}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} title={report.title}>{report.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">{report.school}</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400">{report.field}</span>
              </div>
            </div>
          </div>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">{report.completedSteps.length}/7 sections · {report.wordCount.toLocaleString("fr-FR")} mots</span>
            <span className="text-xs font-semibold text-purple-600">{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: progress === 100 ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#7c3aed,#a855f7)" }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-4">
          {STEPS.map((label, i) => {
            const stepId = i + 1;
            const done = report.completedSteps.includes(stepId);
            const current = report.currentStep === stepId;
            return (
              <span key={stepId} title={label}
                className={`text-xs px-2 py-0.5 rounded-full font-medium border ${done ? "bg-green-50 text-green-700 border-green-200" : current ? "bg-purple-600 text-white border-purple-600" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                {label}
              </span>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{report.updatedAt}</span>
          <button className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
            {report.status === "completed" ? "Voir" : "Continuer"} <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function RapportsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = MOCK_REPORTS
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => !search || r.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Mes rapports</h1>
          <p className="text-gray-500 text-sm mt-0.5">3 rapports au total</p>
        </div>
        <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white" style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.25)" }}>
          <Plus className="w-4 h-4" /> Nouveau rapport
        </Button>
      </div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200 text-sm" />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
          {[{v:"all",l:"Tous"},{v:"in_progress",l:"En cours"},{v:"completed",l:"Terminés"},{v:"draft",l:"Brouillons"}].map((o) => (
            <button key={o.v} onClick={() => setFilter(o.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === o.v ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
      </div>
    </motion.div>
  );
}

export default function DemoPage() {
  const [active, setActive] = useState("dashboard");
  const [hovered, setHovered] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      {/* Demo banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
        Mode aperçu — <button onClick={() => setLocation("/sign-up")} className="underline font-bold">Créer un compte</button> pour accéder à la vraie version
      </div>

      <DemoSidebar active={active} setActive={setActive} hovered={hovered} setHovered={setHovered} />
      <div className="flex-shrink-0" style={{ width: 60 }} />

      <main className="flex-1 p-8 pt-14 min-w-0">
        <div className="max-w-5xl mx-auto">
          {active === "dashboard" && <DashboardView setActive={setActive} />}
          {active === "rapports" && <RapportsView />}
          {active === "figures" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Figures & Graphiques</h1>
              <FiguresPanel />
            </motion.div>
          )}
        </div>
      </main>
      <FloatingChat />
    </div>
  );
}
