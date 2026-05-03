import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Plus, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { ActiveReportCard } from "@/components/dashboard/ActiveReportCard";
import { FiguresPanel } from "@/components/dashboard/FiguresPanel";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { getReport } from "@/lib/reportStore";
import { getMyPlan, PLAN_LIMITS } from "@/lib/userPlan";

function wordCount(s?: string) {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

function computeDashboard() {
  const d = getReport();

  const stepDone: Record<number, boolean> = {
    1: !!(d.theme && d.school),
    2: !!d.studentName,
    3: !!(d.dedicaces || d.remerciements),
    4: !!d.resume,
    5: !!(d.introduction),
    6: !!d.introduction,
    7: !!d.partieI,
    8: !!d.partieII,
    9: !!d.conclusion,
  };

  const completedSteps = Object.entries(stepDone)
    .filter(([, v]) => v)
    .map(([k]) => Number(k));

  const currentStep = ([1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !stepDone[n])) ?? 9;

  const totalWords =
    wordCount(d.introduction) +
    wordCount(d.partieI) +
    wordCount(d.partieII) +
    wordCount(d.conclusion) +
    wordCount(d.resume);

  const title = d.theme
    ? `${d.theme.slice(0, 55)}${d.theme.length > 55 ? "…" : ""} — ${d.school ?? ""}`
    : "Mon rapport";

  return { completedSteps, currentStep, totalWords, title, reportType: d.reportType ?? "PFE" };
}

// ── Submission checklist ──────────────────────────────────────────────────────
function SubmissionChecklist() {
  const d = getReport();

  const items = [
    { label: "Informations générales",  done: !!(d.theme && d.school) },
    { label: "Page de garde",           done: !!d.studentName },
    { label: "Dédicaces",               done: !!(d.dedicaces   && d.dedicaces.length   > 50) },
    { label: "Remerciements",           done: !!(d.remerciements && d.remerciements.length > 50) },
    { label: "Résumé / Abstract",       done: !!(d.resume      && d.resume.length      > 100) },
    { label: "Introduction générale",   done: !!(d.introduction && d.introduction.length > 200) },
    { label: "Mots-clés définis",       done: !!(d.motsCles    && d.motsCles.length    > 0) },
    { label: "Partie I rédigée",        done: !!(d.partieI     && d.partieI.length     > 200) },
    { label: "Partie II rédigée",       done: !!(d.partieII    && d.partieII.length    > 200) },
    { label: "Conclusion rédigée",      done: !!(d.conclusion  && d.conclusion.length  > 200) },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const pct       = Math.round((doneCount / items.length) * 100);
  const circumference = 2 * Math.PI * 15;
  const isReady   = pct === 100;

  return (
    <div
      className="h-full rounded-2xl bg-white border border-gray-100 flex flex-col overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Checklist de rendu
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{doneCount}/{items.length} sections complètes</p>
        </div>
        {/* Circular progress */}
        <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
          <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={isReady ? "#10b981" : "#7c3aed"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <span className={`absolute text-[10px] font-bold ${isReady ? "text-emerald-600" : "text-purple-700"}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ minHeight: 0 }}>
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              item.done ? "bg-green-50" : "bg-gray-50"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                item.done ? "bg-green-500" : "border-2 border-gray-200 bg-white"
              }`}
            >
              {item.done && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-xs leading-tight ${item.done ? "text-green-700 font-medium" : "text-gray-400"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={`px-4 py-2.5 border-t flex-shrink-0 text-center transition-colors ${
        isReady ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"
      }`}>
        <p className={`text-xs font-semibold ${isReady ? "text-green-700" : "text-gray-400"}`}>
          {isReady
            ? "🎓 Rapport prêt pour la soutenance !"
            : `Encore ${items.length - doneCount} section${items.length - doneCount > 1 ? "s" : ""} à compléter`}
        </p>
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [, setLocation]  = useLocation();
  const { user }         = useUser();
  const { completedSteps, currentStep, totalWords, title, reportType } = computeDashboard();

  const plan           = getMyPlan();
  const revisionLimit  = PLAN_LIMITS[plan.planId].revisions;
  const hasActiveReport = completedSteps.length > 0;

  const stepPaths: Record<number, string> = {
    1: "/rapport/step-1", 2: "/rapport/step-2", 3: "/rapport/step-3",
    4: "/rapport/step-4", 5: "/rapport/step-5", 6: "/rapport/step-6",
    7: "/rapport/partie-i", 8: "/rapport/partie-ii", 9: "/rapport/step-9",
  };

  const handleContinue = () => setLocation(stepPaths[currentStep] ?? "/rapport/step-1");

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-7">
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Bonjour, {user?.firstName || "Étudiant"} 👋
                </h1>
                <p className="text-gray-500 mt-0.5 text-sm">
                  {hasActiveReport
                    ? "Tu as un rapport en cours. Continue là où tu t'es arrêté."
                    : "Prêt à générer ton rapport ? C'est parti."}
                </p>
              </div>
              <Button
                data-testid="button-new-report"
                onClick={() => setLocation("/rapport/step-1")}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.25)" }}
              >
                <Plus className="w-4 h-4" />
                {hasActiveReport ? "Nouveau rapport" : "Commencer maintenant"}
              </Button>
            </div>

            {/* Stats row */}
            <div className="mb-6">
              <StatsRow
                progressionGlobale={Math.round((completedSteps.length / 9) * 100)}
                sectionsCompletes={completedSteps.length}
                totalSections={9}
                motsGeneres={totalWords}
                revisionCount={plan.revisionCount}
                revisionLimit={revisionLimit}
              />
            </div>

            {/* Active report */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {hasActiveReport ? "Rapport en cours" : "Démarrer un rapport"}
                </h2>
                <button
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
                  data-testid="link-all-reports"
                  onClick={() => setLocation("/rapports")}
                >
                  Voir tous les rapports
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <ActiveReportCard
                title={hasActiveReport ? title : "Nouveau rapport PFE/Stage/Mémoire"}
                type={reportType}
                currentStep={currentStep}
                completedSteps={completedSteps}
                updatedAt={hasActiveReport ? "Sauvegarde auto" : "Pas encore commencé"}
                onContinue={handleContinue}
                onStepClick={(stepId) => setLocation(stepPaths[stepId] ?? "/rapport/step-1")}
              />
            </div>

            {/* Bottom row: figures + checklist */}
            <div className="grid grid-cols-5 gap-4" style={{ minHeight: 220 }}>
              <div className="col-span-3">
                <FiguresPanel />
              </div>
              <div className="col-span-2">
                <SubmissionChecklist />
              </div>
            </div>

          </motion.div>
        </div>
      </main>

      <FloatingChat />
    </div>
  );
}
