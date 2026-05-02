import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { ActiveReportCard } from "@/components/dashboard/ActiveReportCard";
import { FiguresPanel } from "@/components/dashboard/FiguresPanel";
import { FloatingChat } from "@/components/dashboard/FloatingChat";

const MOCK_REPORT = {
  title: "Optimisation de portefeuille — EMSI Finance",
  type: "PFE",
  currentStep: 3,
  completedSteps: [1, 2],
  updatedAt: "Il y a 2 heures",
};

export default function DashboardPage() {
  const { user } = useUser();
  const hasActiveReport = true;

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
                  {hasActiveReport ? "Tu as un rapport en cours. Continue là où tu t'es arrêté." : "Prêt à générer ton rapport ? C'est parti."}
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

            {/* Stats row */}
            <div className="mb-6">
              <StatsRow
                progressionGlobale={hasActiveReport ? 28 : 0}
                sectionsCompletes={hasActiveReport ? 2 : 0}
                totalSections={7}
                motsGeneres={hasActiveReport ? 3240 : 0}
                tempsRestant={hasActiveReport ? 18 : 0}
              />
            </div>

            {/* Active report */}
            {hasActiveReport && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2
                    className="text-sm font-semibold text-gray-700"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    Rapport en cours
                  </h2>
                  <button
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
                    data-testid="link-all-reports"
                  >
                    Voir tous les rapports
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <ActiveReportCard {...MOCK_REPORT} onContinue={() => {}} />
              </div>
            )}

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
