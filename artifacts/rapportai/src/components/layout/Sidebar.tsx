import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  LayoutDashboard, FileText, BookOpen, MessageSquare,
  ImageIcon, Settings, LogOut,
} from "lucide-react";
import { UpsellModal } from "@/components/report/UpsellModal";
import { getMyPlan, canUseFeature } from "@/lib/userPlan";

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard",   proFeature: "" },
  { icon: FileText,        label: "Mes rapports",    path: "/rapports",    proFeature: "" },
  { icon: BookOpen,        label: "Bibliothèque",    path: "/bibliotheque",proFeature: "citations" },
  { icon: MessageSquare,   label: "JuryAI",          path: "/juryai",      proFeature: "juryai" },
  { icon: ImageIcon,       label: "Figures",         path: "/figures",     proFeature: "" },
  { icon: Settings,        label: "Paramètres",      path: "/parametres",  proFeature: "" },
];

export function Sidebar() {
  const [hovered, setHovered] = useState(false);
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellFeature, setUpsellFeature] = useState("");

  const plan = getMyPlan();
  const expanded = hovered;
  const w = expanded ? 220 : 60;

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const handleNavClick = (item: typeof navItems[number]) => {
    if (item.proFeature && !canUseFeature(item.proFeature, plan.planId)) {
      setUpsellFeature(item.label);
      setUpsellOpen(true);
      return;
    }
    setLocation(item.path);
  };

  const userInitial = user?.firstName?.[0]
    || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase()
    || "U";
  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "Étudiant";

  const planLabel: Record<string, string> = {
    free: "Gratuit", essentiel: "Essentiel", pro: "Pro", premium: "Premium",
  };

  return (
    <>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: w,
          minWidth: w,
          transition: "width 200ms ease, min-width 200ms ease",
        }}
        className="fixed inset-y-0 left-0 bg-white border-r border-gray-100 flex flex-col z-40 overflow-hidden"
      >
        {/* Logo */}
        <div
          className="flex items-center border-b border-gray-100 flex-shrink-0"
          style={{ height: 64, paddingLeft: expanded ? 20 : 0, justifyContent: expanded ? "flex-start" : "center", transition: "padding 200ms ease" }}
        >
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span
            className="font-bold text-gray-900 text-base ml-3 whitespace-nowrap overflow-hidden"
            style={{
              opacity: expanded ? 1 : 0,
              maxWidth: expanded ? 120 : 0,
              transition: "opacity 150ms ease, max-width 200ms ease",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            RapportAI
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.path || location.startsWith(item.path + "/");
            const isLocked = !!(item.proFeature && !canUseFeature(item.proFeature, plan.planId));
            return (
              <button
                key={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => handleNavClick(item)}
                title={!expanded ? item.label : undefined}
                className={`w-full flex items-center rounded-xl transition-all text-left group
                  ${isActive ? "bg-purple-50" : isLocked ? "opacity-60 hover:bg-gray-50 cursor-pointer" : "hover:bg-gray-50"}
                `}
                style={{
                  height: 40,
                  paddingLeft: expanded ? 12 : 0,
                  paddingRight: expanded ? 8 : 0,
                  justifyContent: expanded ? "flex-start" : "center",
                  transition: "padding 200ms ease, background 150ms ease",
                }}
              >
                <item.icon
                  className={`flex-shrink-0 w-4 h-4
                    ${isActive ? "text-purple-600" : isLocked ? "text-gray-300" : "text-gray-400 group-hover:text-gray-600"}
                  `}
                />
                <span
                  className={`ml-3 text-sm font-medium whitespace-nowrap overflow-hidden
                    ${isActive ? "text-purple-700" : isLocked ? "text-gray-300" : "text-gray-600"}
                  `}
                  style={{
                    opacity: expanded ? 1 : 0,
                    maxWidth: expanded ? 120 : 0,
                    transition: "opacity 150ms ease, max-width 200ms ease",
                  }}
                >
                  {item.label}
                </span>
                {expanded && isLocked && (
                  <span
                    className="ml-auto text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                    style={{ opacity: expanded ? 1 : 0, transition: "opacity 150ms ease" }}
                  >
                    Pro
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 py-3 px-2 space-y-0.5 flex-shrink-0">
          <div
            className="flex items-center rounded-xl"
            style={{
              height: 44,
              paddingLeft: expanded ? 8 : 0,
              justifyContent: expanded ? "flex-start" : "center",
              transition: "padding 200ms ease",
            }}
          >
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="avatar" className="w-7 h-7 object-cover" />
                : <span className="text-purple-600 font-semibold text-xs">{userInitial}</span>
              }
            </div>
            <div
              className="ml-2.5 flex-1 overflow-hidden"
              style={{
                opacity: expanded ? 1 : 0,
                maxWidth: expanded ? 120 : 0,
                transition: "opacity 150ms ease, max-width 200ms ease",
              }}
            >
              <div className="text-xs font-medium text-gray-800 truncate">{userName}</div>
              <div className="text-xs text-gray-400 truncate">{planLabel[plan.planId] ?? "Gratuit"}</div>
            </div>
          </div>

          <button
            data-testid="button-signout"
            onClick={handleSignOut}
            title={!expanded ? "Déconnexion" : undefined}
            className="w-full flex items-center rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
            style={{
              height: 36,
              paddingLeft: expanded ? 10 : 0,
              justifyContent: expanded ? "flex-start" : "center",
              transition: "padding 200ms ease",
            }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span
              className="ml-2.5 whitespace-nowrap overflow-hidden text-sm"
              style={{
                opacity: expanded ? 1 : 0,
                maxWidth: expanded ? 100 : 0,
                transition: "opacity 150ms ease, max-width 200ms ease",
              }}
            >
              Déconnexion
            </span>
          </button>
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
  return <div className="w-[60px] flex-shrink-0" />;
}
