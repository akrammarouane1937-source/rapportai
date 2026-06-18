import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, X } from "lucide-react";
import { useOptionalUser } from "@/lib/useOptionalClerk";
import { getReport } from "@/lib/reportStore";

const SHOWN_KEY = "rapportai_guided_tour_shown";
export function hasSeenGuidedTour(): boolean {
  try { return !!localStorage.getItem(SHOWN_KEY); } catch { return false; }
}

type Placement = "right" | "top" | "bottom" | "center";
interface Step {
  selector: string | null;   // data-tour value, or null for a centered card
  title: string;
  body: string;
  placement?: Placement;
}

interface Rect { top: number; left: number; width: number; height: number; }

export function GuidedTour({ onClose }: { onClose?: () => void }) {
  const { user } = useOptionalUser();
  const firstName =
    (getReport() as Record<string, string>).studentName?.split(" ")[0] || user?.firstName || "";

  const steps: Step[] = [
    { selector: null, title: firstName ? `Bonjour ${firstName} ! 👋` : "Bienvenue sur RapportAI ! 👋",
      body: "On va faire le tour ensemble, en 1 minute. Je te montre chaque partie de l'outil et à quoi elle sert." },
    { selector: "start", placement: "right", title: "Commence ton rapport",
      body: "Tout part d'ici. Tu lances un nouveau rapport, tu donnes ton thème et ton école, et l'IA rédige chaque section pour toi." },
    { selector: "chat", placement: "top", title: "Parle à l'IA",
      body: "Ici, tu discutes avec RapportAI comme avec un assistant. « Génère mon introduction », « rends ce paragraphe plus formel »… il comprend et exécute." },
    { selector: "nav:/rapports", placement: "right", title: "Mon Rapport",
      body: "Toutes tes sections générées sont rassemblées ici : page de garde, introduction, parties, conclusion. Tu navigues entre elles d'un clic." },
    { selector: "nav:/sections-terminees", placement: "right", title: "Sections terminées",
      body: "Suis ta progression : ce qui est déjà rédigé et ce qu'il te reste à générer." },
    { selector: "nav:/figures", placement: "right", title: "Figures",
      body: "Ajoute tes graphiques, captures et tableaux. RapportAI les référence automatiquement dans le texte (« voir Figure 1 »)." },
    { selector: "nav:/bibliotheque", placement: "right", title: "Bibliothèque",
      body: "Importe tes sources (PDF, DOI, Google Scholar). L'IA s'en sert pour écrire à partir de vraies références, pas du web générique." },
    { selector: "nav:/mise-en-forme", placement: "right", title: "Mise en forme",
      body: "Personnalise la présentation : police, taille, marges, interligne. Ton export Word reprend exactement ces réglages." },
    { selector: "nav:/parametres", placement: "right", title: "Paramètres",
      body: "Ton profil : nom, école, filière, encadrants. Ces infos personnalisent ton rapport et ta page de garde. Pense à les remplir !" },
    { selector: null, title: "C'est parti ! 🚀",
      body: "Tu connais maintenant chaque coin de RapportAI. Lance ton premier rapport — tu peux relancer ce tour quand tu veux depuis l'aide." },
  ];

  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step.selector) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.selector}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step.selector]);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure]);

  const finish = () => {
    try { localStorage.setItem(SHOWN_KEY, "1"); } catch { /* ignore */ }
    onClose?.();
  };
  const isLast = i === steps.length - 1;
  const pad = 8;

  // Tooltip position
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const tipW = 320;
  let tipStyle: React.CSSProperties;
  if (!rect) {
    tipStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  } else if (step.placement === "right") {
    tipStyle = { top: Math.min(rect.top, vh - 220), left: Math.min(rect.left + rect.width + 16, vw - tipW - 12) };
  } else if (step.placement === "top") {
    tipStyle = { top: Math.max(12, rect.top - 200), left: Math.min(Math.max(12, rect.left + rect.width / 2 - tipW / 2), vw - tipW - 12) };
  } else {
    tipStyle = { top: rect.top + rect.height + 16, left: Math.min(Math.max(12, rect.left), vw - tipW - 12) };
  }

  return (
    <div className="fixed inset-0 z-[130]" aria-modal>
      {/* Spotlight: a transparent box over the target with a giant shadow that darkens the rest */}
      {rect ? (
        <motion.div
          initial={false}
          animate={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="absolute rounded-xl pointer-events-none"
          style={{ boxShadow: "0 0 0 9999px rgba(17,12,40,0.62)", outline: "2px solid rgba(168,85,247,0.9)" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(17,12,40,0.62)" }} />
      )}

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="absolute bg-white rounded-2xl shadow-2xl p-5"
          style={{ width: tipW, ...tipStyle }}
        >
          <button onClick={finish} className="absolute right-3 top-3 text-gray-300 hover:text-gray-500" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
          <p className="text-[11px] font-semibold text-purple-500 mb-1">Étape {i + 1} / {steps.length}</p>
          <h3 className="text-base font-bold text-gray-900 mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {step.title}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">{step.body}</p>

          <div className="flex items-center gap-1 mb-4">
            {steps.map((_, k) => (
              <div key={k} className="h-1 rounded-full transition-all"
                style={{ width: k === i ? 18 : 6, background: k === i ? "#7c3aed" : "#e5e7eb" }} />
            ))}
          </div>

          <div className="flex items-center justify-between">
            {i > 0 ? (
              <button onClick={() => setI((s) => s - 1)} className="inline-flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-gray-700">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
            ) : (
              <button onClick={finish} className="text-sm font-medium text-gray-400 hover:text-gray-600">Passer</button>
            )}
            <button
              onClick={() => (isLast ? finish() : setI((s) => s + 1))}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              style={{ boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
            >
              {isLast ? "Terminer" : "Suivant"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
