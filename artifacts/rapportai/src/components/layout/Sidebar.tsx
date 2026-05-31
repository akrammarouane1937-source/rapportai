import { useState } from "react";
import { useLocation } from "wouter";
import { useOptionalUser as useUser, useOptionalClerk as useClerk } from "@/lib/useOptionalClerk";
import {
  Home, LayoutGrid, ListChecks, ImageIcon, BookOpen,
  MessageSquare, Settings, LogOut, Search, Plus,
  FileInput, GraduationCap, BookMarked, ChevronDown, Zap, FileText,
} from "lucide-react";
import { UpsellModal } from "@/components/report/UpsellModal";
import { getMyPlan, canUseFeature, PLAN_LIMITS } from "@/lib/userPlan";
import { getReport } from "@/lib/reportStore";
import { useReportStore } from "@/lib/store";
import { getApprovedFigures } from "@/lib/figureStore";

const NAV_ITEMS = [
  { icon: Home,          label: "Accueil",            path: "/dashboard",          proFeature: "" },
  { icon: LayoutGrid,    label: "Mon Rapport",         path: "/rapports",           proFeature: "" },
  { icon: ListChecks,    label: "Sections terminées",  path: "/sections-terminees", proFeature: "" },
  { icon: ImageIcon,     label: "Figures",             path: "/figures",            proFeature: "" },
  { icon: BookOpen,      label: "Bibliothèque",        path: "/bibliotheque",       proFeature: "" },
  { icon: MessageSquare, label: "JuryAI",              path: "/juryai",             proFeature: "juryai" },
  { icon: FileText,      label: "Mise en forme",       path: "/mise-en-forme",      proFeature: "" },
  { icon: Settings,      label: "Paramètres",          path: "/parametres",         proFeature: "" },
];

const BOTTOM_NAV = [
  { icon: GraduationCap, label: "Tutoriel",      path: "/tutoriel" },
  { icon: BookMarked,    label: "Documentation", path: "/documentation" },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [upsellOpen, setUpsellOpen]   = useState(false);
  const [upsellFeature, setUpsellFeature] = useState("");

  const plan   = getMyPlan();
  const limits = PLAN_LIMITS[plan.planId];
  const report = getReport();
  const figureCount = getApprovedFigures().length;

  const sectionsWithContent = [
    report.introduction, report.resume, report.dedicaces,
    report.remerciements, report.partieI, report.partieII, report.conclusion,
  ].filter((s) => s && s.length > 50).length;

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const handleNavClick = (item: typeof NAV_ITEMS[number]) => {
    if (item.proFeature && !canUseFeature(item.proFeature, plan.planId)) {
      setUpsellFeature(item.label);
      setUpsellOpen(true);
      return;
    }
    setLocation(item.path);
  };

  const userInitial =
    user?.firstName?.[0] ||
    user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ||
    "U";
  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Étudiant";

  const planLabel: Record<string, string> = {
    free: "Gratuit", essentiel: "Essentiel", pro: "Pro", premium: "Premium",
  };

  const STEP_LABELS: Record<number, string> = {
    1:  "Informations générales",
    2:  "Page de garde",
    3:  "Dédicaces & Remerciements",
    4:  "Résumé & Abstract",
    5:  "Sommaire",
    6:  "Introduction",
    7:  "Partie I",
    8:  "Partie II",
    9:  "Conclusion & Bibliographie",
  };

  const STEP_PATHS: Record<number, string> = {
    1: "/rapport/step-1", 2: "/rapport/step-2", 3: "/rapport/step-3",
    4: "/rapport/step-4", 5: "/rapport/step-5", 6: "/rapport/step-6",
    7: "/rapport/partie-i", 8: "/rapport/partie-ii", 9: "/rapport/step-9",
  };

  const zustandStep = useReportStore((s) => s.report.currentStep);
  const currentStepNum: number = zustandStep ?? 1;
  const currentSection = STEP_LABELS[currentStepNum] ?? null;
  const currentStepPath = STEP_PATHS[currentStepNum] ?? "/rapport/step-1";
  const hasReport      = !!(report.theme || report.school);
  const pagesUsed      = sectionsWithContent;
  const pagesLimit     = limits.sections === Infinity ? "∞" : limits.sections;
  const revisionsUsed  = plan.revisionCount;
  const revisionsLimit = limits.revisions === Infinity ? "∞" : limits.revisions;
  const pagesPct       = limits.sections === Infinity ? 0 : Math.min(100, (pagesUsed / (limits.sections as number)) * 100);
  const revPct         = limits.revisions === Infinity ? 0 : Math.min(100, (revisionsUsed / (limits.revisions as number)) * 100);

  const isActive = (path: string) =>
    location === path || location.startsWith(path + "/");

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 flex flex-col z-40 overflow-hidden"
        style={{ width: 200, background: "#ffffff", borderRight: "1px solid #e5e7eb" }}
      >
        {/* Logo + Search */}
        <div
          className="flex items-center justify-between px-4 flex-shrink-0"
          style={{ height: 56, borderBottom: "1px solid #f3f4f6" }}
        >
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="RapportAI" className="w-7 h-7 flex-shrink-0 object-contain" />
            <span
              className="font-bold text-gray-900 text-sm"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              RapportAI
            </span>
          </div>
          <button
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Rechercher (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Workspace / User */}
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="avatar" className="w-6 h-6 object-cover" />
              ) : (
                <span className="text-purple-600 font-semibold text-[10px]">{userInitial}</span>
              )}
            </div>
            <span className="text-xs font-medium text-gray-700 truncate flex-1 text-left">
              {userName}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="px-3 py-2.5 space-y-1.5 flex-shrink-0" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <button
            onClick={() => setLocation(hasReport ? "/rapports" : "/rapport/step-1")}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#a855f7)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
            }}
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            Nouveau rapport
          </button>
          <button
            onClick={() => setLocation("/figures")}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ border: "1px solid #e5e7eb" }}
          >
            <FileInput className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            Documents
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 min-h-0 flex flex-col">
          <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const locked = !!(item.proFeature && !canUseFeature(item.proFeature, plan.planId));
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all text-left
                  ${active
                    ? "bg-gray-100 text-gray-900"
                    : locked
                    ? "text-gray-300 hover:bg-gray-50 cursor-pointer"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                <item.icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    active ? "text-gray-900" : locked ? "text-gray-300" : "text-gray-500"
                  }`}
                />
                <span className="truncate flex-1">{item.label}</span>
                {item.path === "/figures" && figureCount > 0 && !locked && (
                  <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 min-w-[18px] text-center">
                    {figureCount}
                  </span>
                )}
                {locked && (
                  <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                    Pro
                  </span>
                )}
              </button>
            );
          })}
          </div>

          {/* Active report card — appears once user has started a report */}
          {hasReport && (
            <div className="mt-auto pt-2">
              <div className="mx-0.5 mb-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">En cours</p>
                <button
                  onClick={() => setLocation(currentStepPath)}
                  className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-purple-50 transition-colors text-left group"
                  style={{ border: "1px solid #ede9fe" }}
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 truncate group-hover:text-purple-700">
                      {report.theme ?? "Mon rapport"}
                    </p>
                    {currentSection ? (
                      <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "#7c3aed" }}>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: "#7c3aed" }}
                        />
                        {currentSection}
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {sectionsWithContent} section{sectionsWithContent !== 1 ? "s" : ""} générée{sectionsWithContent !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Bottom section */}
        <div className="flex-shrink-0" style={{ borderTop: "1px solid #f3f4f6" }}>
          {/* Tutoriel / Documentation */}
          <div className="px-2 py-2 space-y-0.5">
            {BOTTOM_NAV.map((item) => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-left"
              >
                <item.icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Plan info + usage bars */}
          <div className="px-3 py-2 space-y-1.5" style={{ borderTop: "1px solid #f3f4f6" }}>
            <div
              className="text-xs font-semibold text-gray-600"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Ton plan {planLabel[plan.planId] ?? "Gratuit"}
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Sections générées</span>
                <span>{pagesUsed}/{pagesLimit}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pagesPct}%`,
                    background: "linear-gradient(90deg,#7c3aed,#a855f7)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Révisions</span>
                <span>{revisionsUsed}/{revisionsLimit}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${revPct}%`,
                    background: "linear-gradient(90deg,#7c3aed,#a855f7)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            <div className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg py-1.5" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
              <Zap className="w-3 h-3" />
              Accès gratuit
            </div>
          </div>

          {/* Sign out */}
          <div className="px-2 pb-3" style={{ borderTop: "1px solid #f3f4f6" }}>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      <UpsellModal
        open={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        variant="feature"
        currentPlan={plan.planId}
        featureName={upsellFeature}
      />
    </>
  );
}

export function SidebarSpacer() {
  return <div className="w-[200px] flex-shrink-0" />;
}
