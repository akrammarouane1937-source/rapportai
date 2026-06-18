import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageSquare, Eye, Download, ArrowRight, ArrowLeft, X } from "lucide-react";
import { useOptionalUser } from "@/lib/useOptionalClerk";
import { getReport } from "@/lib/reportStore";

// Friendly first-sign-in walkthrough. Shows once per browser (localStorage flag).
const SHOWN_KEY = "rapportai_welcome_tour_shown";

export function hasSeenWelcomeTour(): boolean {
  try { return !!localStorage.getItem(SHOWN_KEY); } catch { return false; }
}

export function WelcomeTour({ onClose }: { onClose?: () => void }) {
  const { user } = useOptionalUser();
  const firstName =
    (getReport() as Record<string, string>).studentName?.split(" ")[0]
    || user?.firstName
    || "";
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: <span className="text-3xl">👋</span>,
      title: firstName ? `Bonjour ${firstName} !` : "Bienvenue sur RapportAI !",
      body: "On va te montrer en 30 secondes comment transformer ton sujet en un rapport complet, prêt à soumettre. C'est simple, promis.",
    },
    {
      icon: <Sparkles className="w-7 h-7 text-purple-600" />,
      title: "1. Commence ton rapport",
      body: "Clique sur « Commencer mon rapport ». Tu donnes ton thème, ton école et ta filière — RapportAI s'occupe du reste, section par section.",
    },
    {
      icon: <MessageSquare className="w-7 h-7 text-purple-600" />,
      title: "2. Discute avec l'IA",
      body: "Dis simplement ce que tu veux, comme à un assistant. L'IA rédige chaque section (introduction, parties, conclusion) à partir de ton sujet et de tes documents.",
    },
    {
      icon: <Eye className="w-7 h-7 text-purple-600" />,
      title: "3. Lis et révise",
      body: "Chaque section apparaît dans l'aperçu à droite. Tu peux demander une modification à tout moment — « rends ce paragraphe plus formel », par exemple.",
    },
    {
      icon: <Download className="w-7 h-7 text-purple-600" />,
      title: "4. Exporte en Word",
      body: "Quand c'est prêt, télécharge ton rapport en Word (.docx), déjà mis en forme au format de ton école. Il ne te reste qu'à relire et soumettre.",
    },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];

  const finish = () => {
    try { localStorage.setItem(SHOWN_KEY, "1"); } catch { /* ignore */ }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Header band */}
        <div className="relative px-7 pt-7 pb-5" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
          <button onClick={finish} className="absolute right-4 top-4 text-white/70 hover:text-white" aria-label="Passer">
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-lg">
            {current.icon}
          </div>
        </div>

        {/* Body */}
        <div className="px-7 pt-5 pb-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {current.title}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">{current.body}</p>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-6 mb-5">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === step ? 22 : 7, background: i === step ? "#7c3aed" : "#e5e7eb" }}
              />
            ))}
          </div>

          {/* Nav */}
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
                <ArrowLeft className="w-4 h-4" /> Précédent
              </button>
            ) : (
              <button onClick={finish} className="text-sm font-medium text-gray-400 hover:text-gray-600">Passer</button>
            )}

            <button
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              style={{ boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
            >
              {isLast ? "C'est parti !" : "Suivant"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
