import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronDown, ChevronRight, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/layout/Sidebar";

const REPORT_TYPES = [
  { id: "pfe", label: "PFE", desc: "Projet de Fin d'Études", icon: "🎓" },
  { id: "stage", label: "Rapport de Stage", desc: "Immersion professionnelle", icon: "🏢" },
  { id: "memoire", label: "Mémoire", desc: "Recherche approfondie", icon: "📚" },
];

const SCHOOLS = ["EMSI", "ENCG", "ENSA", "ENSIAS", "UIR", "UCA", "UM5", "ISCAE", "HEM", "Autre"];
const YEARS = ["2023–2024", "2024–2025", "2025–2026"];

export default function Step1Page() {
  const [, setLocation] = useLocation();
  const [reportType, setReportType] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [school, setSchool] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [filiere, setFiliere] = useState("");
  const [annee, setAnnee] = useState("");
  const [anneeOpen, setAnneeOpen] = useState(false);
  const [encadrantPeda, setEncadrantPeda] = useState("");
  const [encadrantPro, setEncadrantPro] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [ville, setVille] = useState("");

  const filteredSchools = SCHOOLS.filter((s) =>
    s.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  const canContinue = reportType && theme.trim() && school && filiere.trim() && annee && encadrantPeda.trim() && ville.trim();

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <div className="flex-shrink-0" style={{ width: 60 }} />

      <main className="flex-1 overflow-y-auto pb-32">
        {/* Step header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 sticky top-0 z-30">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">Étape 1 sur 7</span>
              <span className="text-xs text-gray-400">Informations Générales</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: "14.28%" }} />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Informations générales
            </h1>
            <p className="text-gray-500 text-sm mb-10">Ces informations serviront à personnaliser l'ensemble de ton rapport.</p>

            {/* Type de rapport */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Type de rapport *</label>
              <div className="grid grid-cols-3 gap-3">
                {REPORT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setReportType(t.id)}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 text-center transition-all ${
                      reportType === t.id
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30"
                    }`}
                    style={{ boxShadow: reportType === t.id ? "0 0 0 3px rgba(124,58,237,0.1)" : "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="font-bold text-gray-900 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{t.label}</span>
                    <span className="text-xs text-gray-400">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Thème */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Thème du rapport *</label>
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex: Optimisation de portefeuille d'actifs financiers à la Bourse de Casablanca"
                className="h-12 text-sm border-gray-200 rounded-xl focus:ring-purple-300 focus:border-purple-400"
              />
            </div>

            {/* École */}
            <div className="mb-6 relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">École *</label>
              <button
                onClick={() => setSchoolOpen(!schoolOpen)}
                className={`w-full h-12 px-4 flex items-center justify-between rounded-xl border text-sm text-left transition-colors ${
                  school ? "text-gray-900 border-gray-200" : "text-gray-400 border-gray-200"
                } bg-white hover:border-purple-300 focus:outline-none`}
              >
                <span>{school || "Sélectionner ton école"}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${schoolOpen ? "rotate-180" : ""}`} />
              </button>
              {schoolOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden z-20"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        autoFocus
                        value={schoolSearch}
                        onChange={(e) => setSchoolSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full pl-8 pr-3 py-2 text-sm text-gray-700 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredSchools.map((s) => (
                      <button key={s} onClick={() => { setSchool(s); setSchoolOpen(false); setSchoolSearch(""); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors ${school === s ? "bg-purple-50 text-purple-700 font-medium" : "text-gray-700"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Filière + Année */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Filière *</label>
                <Input value={filiere} onChange={(e) => setFiliere(e.target.value)} placeholder="Ex: Finance" className="h-12 text-sm border-gray-200 rounded-xl" />
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Année académique *</label>
                <button
                  onClick={() => setAnneeOpen(!anneeOpen)}
                  className="w-full h-12 px-4 flex items-center justify-between rounded-xl border border-gray-200 text-sm bg-white hover:border-purple-300 focus:outline-none"
                >
                  <span className={annee ? "text-gray-900" : "text-gray-400"}>{annee || "Sélectionner"}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${anneeOpen ? "rotate-180" : ""}`} />
                </button>
                {anneeOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden z-20 shadow-lg">
                    {YEARS.map((y) => (
                      <button key={y} onClick={() => { setAnnee(y); setAnneeOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 hover:text-purple-700 ${annee === y ? "bg-purple-50 text-purple-700 font-medium" : "text-gray-700"}`}>
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Encadrants */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Encadrant pédagogique *</label>
              <Input value={encadrantPeda} onChange={(e) => setEncadrantPeda(e.target.value)} placeholder="Pr. Mohamed Alami" className="h-12 text-sm border-gray-200 rounded-xl" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                Encadrant professionnel <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <Input value={encadrantPro} onChange={(e) => setEncadrantPro(e.target.value)} placeholder="M. Karim Bensouda" className="h-12 text-sm border-gray-200 rounded-xl" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                Entreprise d'accueil <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <Input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Banque Centrale Populaire" className="h-12 text-sm border-gray-200 rounded-xl" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ville *</label>
              <Input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Casablanca" className="h-12 text-sm border-gray-200 rounded-xl" />
            </div>
          </motion.div>
        </div>

        {/* Sticky bottom */}
        <div className="fixed bottom-0 right-0 bg-white border-t border-gray-100 px-8 py-4 z-30" style={{ left: 60 }}>
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-xs text-gray-400">{canContinue ? "Tout est prêt ✓" : "Remplis les champs obligatoires (*)"}</span>
            <Button
              onClick={() => setLocation("/rapport/partie-i")}
              disabled={!canContinue}
              className="bg-purple-600 hover:bg-purple-700 text-white h-11 px-6 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40"
              style={{ boxShadow: canContinue ? "0 4px 16px rgba(124,58,237,0.3)" : "none" }}
            >
              Suivant — Page de garde <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
