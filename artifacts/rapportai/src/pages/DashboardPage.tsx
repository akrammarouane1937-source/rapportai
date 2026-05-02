import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FileText, BookOpen, MessageSquare, ImageIcon,
  Settings, LogOut, Plus, ChevronRight, Clock, FileCheck2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard", active: true },
  { icon: FileText, label: "Mes rapports", path: "/rapports" },
  { icon: BookOpen, label: "Bibliothèque", path: "/bibliotheque", pro: true },
  { icon: MessageSquare, label: "JuryAI", path: "/juryai", pro: true },
  { icon: ImageIcon, label: "Figures", path: "/figures" },
  { icon: Settings, label: "Paramètres", path: "/parametres" },
];

const stats = [
  { label: "Rapports générés", value: "0", icon: FileCheck2, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Temps économisé", value: "0h", icon: Clock, color: "text-green-600", bg: "bg-green-50" },
  { label: "Mots générés", value: "0", icon: Sparkles, color: "text-blue-600", bg: "bg-blue-50" },
];

export default function DashboardPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              RapportAI
            </span>
          </div>
        </div>

        <div className="px-3 py-4 flex-1 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => !item.pro && setLocation(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  item.active
                    ? "bg-purple-50 text-purple-700"
                    : item.pro
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${item.active ? "text-purple-600" : item.pro ? "text-gray-300" : "text-gray-400"}`} />
                <span className="flex-1">{item.label}</span>
                {item.pro && (
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-semibold">Pro</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="text-purple-600 font-semibold text-sm">
                  {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Étudiant"}
              </div>
              <div className="text-xs text-gray-400 truncate">Plan gratuit</div>
            </div>
          </div>
          <button
            data-testid="button-signout"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Bonjour, {user?.firstName || "Étudiant"} 👋
              </h1>
              <p className="text-gray-500 mt-1">Prêt à générer ton rapport ? C'est parti.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center mb-6">
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Aucun rapport pour l'instant
              </h2>
              <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
                Génère ton premier rapport académique en 30 minutes. C'est gratuit pour commencer.
              </p>
              <Button
                data-testid="button-new-report"
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Nouveau rapport
              </Button>
            </div>

            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-purple-200 uppercase tracking-wider mb-1">Pro & Premium</div>
                  <h3 className="text-lg font-bold mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Prépare ta soutenance avec JuryAI
                  </h3>
                  <p className="text-purple-200 text-sm max-w-sm">
                    Simule les questions de ton jury et arrive le jour J en sachant exactement quoi dire.
                  </p>
                </div>
                <Button
                  variant="outline"
                  data-testid="button-discover-juryai"
                  className="border-white text-white hover:bg-white hover:text-purple-700 flex-shrink-0 ml-4"
                >
                  Découvrir
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
