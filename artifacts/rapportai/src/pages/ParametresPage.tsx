import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Check, User, GraduationCap, BookOpen, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { getReport, saveReport } from "@/lib/reportStore";
import { useUser } from "@clerk/react";

const FIELDS: { key: string; label: string; placeholder: string; section: string }[] = [
  { key: "studentName",   label: "Nom complet",              placeholder: "Ex: Youssef El Amrani",       section: "Profil étudiant" },
  { key: "school",        label: "École / Université",       placeholder: "Ex: EMSI, ENCG, ENSA…",       section: "Profil étudiant" },
  { key: "filiere",       label: "Filière",                  placeholder: "Ex: Finance, Génie Logiciel…", section: "Profil étudiant" },
  { key: "annee",         label: "Année universitaire",      placeholder: "Ex: 2024–2025",                section: "Profil étudiant" },
  { key: "ville",         label: "Ville",                    placeholder: "Ex: Casablanca, Rabat…",       section: "Profil étudiant" },
  { key: "entreprise",    label: "Entreprise d'accueil",     placeholder: "Ex: Attijariwafa Bank",        section: "Stage / PFE" },
  { key: "encadrantPeda", label: "Encadrant pédagogique",   placeholder: "Ex: Pr. Mohamed Alami",        section: "Encadrants" },
  { key: "encadrantPro",  label: "Encadrant professionnel", placeholder: "Ex: M. Karim Benali",          section: "Encadrants" },
  { key: "citationStyle", label: "Style de citation",       placeholder: "Ex: APA 7th ed., IEEE…",       section: "Préférences" },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Profil étudiant": <User className="w-4 h-4" />,
  "Stage / PFE":     <Building className="w-4 h-4" />,
  "Encadrants":      <GraduationCap className="w-4 h-4" />,
  "Préférences":     <BookOpen className="w-4 h-4" />,
};

export default function ParametresPage() {
  const { user } = useUser();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const report = getReport();
    const initial: Record<string, string> = {};
    FIELDS.forEach(({ key }) => {
      initial[key] = (report as Record<string, string>)[key] ?? "";
    });
    if (!initial.studentName && user?.fullName) {
      initial.studentName = user.fullName;
    }
    setValues(initial);
  }, [user]);

  const handleSave = () => {
    saveReport(values as Parameters<typeof saveReport>[0]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const grouped = FIELDS.reduce<Record<string, typeof FIELDS>>((acc, f) => {
    (acc[f.section] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />
      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-center justify-between mb-7">
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Paramètres
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  Ces informations sont utilisées par l'IA pour personnaliser ton rapport
                </p>
              </div>
              <Button
                onClick={handleSave}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.25)" }}
              >
                {saved ? <><Check className="w-4 h-4" /> Sauvegardé</> : <><Save className="w-4 h-4" /> Sauvegarder</>}
              </Button>
            </div>

            {Object.entries(grouped).map(([section, fields], si) => (
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.06 }}
                className="bg-white rounded-2xl border border-gray-100 p-6 mb-5"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                    {SECTION_ICONS[section]}
                  </div>
                  <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {section}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fields.map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        {label}
                      </label>
                      <Input
                        value={values[key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="h-10 rounded-xl border-gray-200 text-sm focus:border-purple-400 focus:ring-purple-300"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}

            <div className="bg-purple-50 rounded-2xl border border-purple-100 p-5">
              <p className="text-sm text-purple-700 font-medium mb-1">
                Ces données restent sur ton appareil
              </p>
              <p className="text-xs text-purple-500">
                Tes paramètres sont sauvegardés localement dans ton navigateur. Ils ne sont jamais envoyés à un serveur tiers.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
