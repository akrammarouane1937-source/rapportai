import { useState } from "react";
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
import { getMyPlan } from "@/lib/userPlan";

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
    5: !!(d.introduction),        // sommaire: count as done with introduction
    6: !!d.introduction,
    7: !!d.partieI,
    8: !!d.partieII,
    9: !!d.conclusion,
  };

  const completedSteps = Object.entries(stepDone)
    .filter(([, v]) => v)
    .map(([k]) => Number(k));

  const currentStep = ([1,2,3,4,5,6,7,8,9].find(n => !stepDone[n])) ?? 9;

  const totalWords =
    wordCount(d.introduction) +
    wordCount(d.partieI) +
    wordCount(d.partieII) +
    wordCount(d.conclusion) +
    wordCount(d.resume);

  const estimatedPages = Math.round(totalWords / 250);
  const title = d.theme
    ? `${d.theme.slice(0, 55)}${d.theme.length > 55 ? "…" : ""} — ${d.school ?? ""}`
    : "Mon rapport";

  const tempsRestant = Math.max(0, Math.round((9 - completedSteps.length) * 4));

  return { completedSteps, currentStep, totalWords, estimatedPages, title, tempsRestant, reportType: d.reportType ?? "PFE" };
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const {
    completedSteps, currentStep, totalWords, estimatedPages,
    title, tempsRestant, reportType,
  } = computeDashboard();

  const plan = getMyPlan();
  const hasActiveReport = completedSteps.length > 0;

  const stepPaths: Record<number, string> = {
    1: "/rapport/step-1", 2: "/rapport/step-2", 3: "/rapport/step-3",
    4: "/rapport/step-4", 5: "/rapport/step-5", 6: "/rapport/step-6",
    7: "/rapport/partie-i", 8: "/rapport/partie-ii", 9: "/rapport/step-9",
  };

  const handleContinue = () => setLocation(stepPaths[currentStep] ?? "/rapport/step-1");
  const handleJuryAI   = () => setLocation("/juryai");

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
                tempsRestant={tempsRestant}
              />
            </div>

            {/* Active report */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-sm font-semibold text-gray-700"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
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
              />
            </div>

            {/* Bottom row: figures + JuryAI promo */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3">
                <FiguresPanel />
              </div>
              <div className="col-span-2">
                <div
                  className="h-full rounded-2xl overflow-hidden text-white flex flex-col justify-between p-5"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                    boxShadow: "0 4px 24px rgba(124,58,237,0.2)",
                  }}
                >
                  <div>
                    <div className="text-xs font-semibold text-purple-200 uppercase tracking-wider mb-2">
                      Pro &amp; Premium
                    </div>
                    <h3
                      className="text-lg font-bold leading-snug mb-2"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      Prépare ta soutenance avec JuryAI
                    </h3>
                    <p className="text-purple-200 text-xs leading-relaxed">
                      Simule les questions de ton jury et arrive le jour J en sachant exactement quoi dire.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-discover-juryai"
                    onClick={handleJuryAI}
                    className="border-white/40 text-white hover:bg-white/10 mt-4 self-start text-xs"
                  >
                    Découvrir JuryAI
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <FloatingChat />

    </div>
  );
}
