import { useState } from "react";
import { useLocation } from "wouter";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { saveReport } from "@/lib/reportStore";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, GraduationCap, BookOpen, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REPORT_TYPES = [
  { id: "pfe", label: "PFE", desc: "Projet de Fin d'Études", icon: "🎓" },
  { id: "rapport_stage", label: "Rapport de Stage", desc: "Stage professionnel", icon: "💼" },
  { id: "memoire", label: "Mémoire", desc: "Mémoire de Master / Thèse", icon: "📚" },
];

const SCHOOLS = [
  "EMSI", "ENCG", "ENSA", "ENSIAS", "UIR", "UM5", "ISCAE", "HEM",
  "FST", "FSJES", "ENCGT", "UCA", "UIZ", "USMBA", "INSEA", "EHTP", "EMI", "IIHEM", "Autre",
];

const FIELDS = [
  "Finance", "Génie Informatique", "Génie Civil", "Marketing",
  "Management", "Économie", "Génie Industriel", "Droit", "Médecine", "Autre",
];

interface OnboardingData {
  reportType: string;
  school: string;
  field: string;
  firstName: string;
}

const steps = [
  { id: 1, label: "Type de rapport", icon: BookOpen },
  { id: 2, label: "Ton école", icon: Building2 },
  { id: 3, label: "Ta filière", icon: GraduationCap },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    reportType: "",
    school: "",
    field: "",
    firstName: user?.firstName || "",
  });

  const canNext = () => {
    if (step === 1) return !!data.reportType;
    if (step === 2) return !!data.school;
    if (step === 3) return !!data.field;
    return false;
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = () => {
    saveReport({
      reportType:  data.reportType || undefined,
      school:      data.school     || undefined,
      filiere:     data.field      || undefined,
      studentName: data.firstName  || user?.firstName || undefined,
    });
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#f9f8ff] flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <img src="/logo.svg" alt="RapportAI" className="w-8 h-8" />
        <span className="font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          RapportAI
        </span>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {user?.firstName ? `Bienvenue, ${user.firstName} 👋` : "Bienvenue sur RapportAI 👋"}
            </h1>
            <p className="text-gray-500">Dis-nous en plus sur ton projet pour personnaliser ton expérience.</p>
          </div>

          <div className="flex items-center justify-center mb-10 gap-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  step === s.id
                    ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                    : step > s.id
                    ? "bg-green-100 text-green-700"
                    : "bg-white text-gray-400 border border-gray-200"
                }`}>
                  {step > s.id ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <s.icon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.id}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-px ${step > s.id ? "bg-green-300" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Quel type de rapport veux-tu générer ?
                  </h2>
                  <p className="text-gray-500 text-sm mb-6">Choisis le type qui correspond à ton projet académique.</p>
                  <div className="grid gap-3">
                    {REPORT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        data-testid={`report-type-${type.id}`}
                        onClick={() => setData({ ...data, reportType: type.id })}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                          data.reportType === type.id
                            ? "border-purple-600 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-3xl">{type.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900">{type.label}</div>
                          <div className="text-sm text-gray-500">{type.desc}</div>
                        </div>
                        {data.reportType === type.id && (
                          <CheckCircle2 className="w-5 h-5 text-purple-600 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Dans quelle école es-tu ?
                  </h2>
                  <p className="text-gray-500 text-sm mb-6">
                    RapportAI adapte la structure de ton rapport au canevas de ton école.
                  </p>
                  <div className="mb-4">
                    <Label htmlFor="school-input" className="text-sm font-medium text-gray-700 mb-2 block">
                      Recherche ou sélectionne ton école
                    </Label>
                    <Input
                      id="school-input"
                      data-testid="input-school"
                      placeholder="Tape le nom de ton école..."
                      value={data.school}
                      onChange={(e) => setData({ ...data, school: e.target.value })}
                      className="mb-3"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SCHOOLS.map((school) => (
                      <button
                        key={school}
                        data-testid={`school-${school}`}
                        onClick={() => setData({ ...data, school })}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          data.school === school
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600"
                        }`}
                      >
                        {school}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Quelle est ta filière ?
                  </h2>
                  <p className="text-gray-500 text-sm mb-6">
                    Ça nous permet d'adapter le vocabulaire et la méthodologie de ton rapport.
                  </p>
                  <div className="mb-4">
                    <Label htmlFor="field-input" className="text-sm font-medium text-gray-700 mb-2 block">
                      Recherche ou sélectionne ta filière
                    </Label>
                    <Input
                      id="field-input"
                      data-testid="input-field"
                      placeholder="Tape ta filière..."
                      value={data.field}
                      onChange={(e) => setData({ ...data, field: e.target.value })}
                      className="mb-3"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {FIELDS.map((field) => (
                      <button
                        key={field}
                        data-testid={`field-${field}`}
                        onClick={() => setData({ ...data, field })}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          data.field === field
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600"
                        }`}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1}
                data-testid="button-back"
                className="flex items-center gap-2 text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </Button>
              <div className="flex items-center gap-2">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={`h-1.5 rounded-full transition-all ${
                      s.id === step ? "w-6 bg-purple-600" : s.id < step ? "w-3 bg-purple-300" : "w-3 bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <Button
                onClick={handleNext}
                disabled={!canNext()}
                data-testid="button-next"
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200"
              >
                {step === 3 ? "Commencer" : "Continuer"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
