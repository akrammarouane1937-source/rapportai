import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Check, Lock, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { type PlanId, PLAN_LIMITS, upgradeCost, nextPlan } from "@/lib/userPlan";

export type UpsellVariant =
  | "page-essentiel"
  | "revision-essentiel"
  | "page-pro"
  | "feature";

interface UpsellConfig {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  benefits: string[];
  targetPlan: string;
  upgradeLabel: string;
  price: number;
}

function getConfig(
  variant: UpsellVariant,
  currentPlan: PlanId,
  featureName?: string,
): UpsellConfig {
  const to = nextPlan(currentPlan);
  const cost = upgradeCost(currentPlan, to);

  switch (variant) {
    case "page-essentiel":
      return {
        icon: <FileText className="w-6 h-6 text-purple-600" />,
        iconBg: "bg-purple-100",
        title: "Tu as atteint ta limite de 30 pages",
        desc: "Passe au plan Pro pour continuer ton rapport sans interruption.",
        benefits: ["60 pages (×2)", "Révisions illimitées", "JuryAI inclus", "Certificat Anti-IA"],
        targetPlan: "Pro",
        upgradeLabel: "Passer au Pro",
        price: 300,
      };
    case "revision-essentiel":
      return {
        icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
        iconBg: "bg-amber-100",
        title: "Tu as utilisé tes 10 révisions",
        desc: "Débloque les révisions illimitées pour peaufiner ton rapport sans limite.",
        benefits: ["Révisions illimitées", "Anti-plagiat", "JuryAI inclus", "Certificat Anti-IA"],
        targetPlan: "Pro",
        upgradeLabel: "Débloquer les révisions",
        price: 300,
      };
    case "page-pro":
      return {
        icon: <Zap className="w-6 h-6 text-indigo-600" />,
        iconBg: "bg-indigo-100",
        title: "Tu as atteint ta limite de 60 pages",
        desc: "Passe au plan Premium pour des pages illimitées et un rapport sans contrainte.",
        benefits: ["Pages illimitées", "Slides PowerPoint", "Tout Pro inclus", "Support prioritaire"],
        targetPlan: "Premium",
        upgradeLabel: "Passer au Premium",
        price: 300,
      };
    case "feature":
    default:
      return {
        icon: <Lock className="w-6 h-6 text-purple-600" />,
        iconBg: "bg-purple-100",
        title: featureName
          ? `${featureName} est réservé au plan ${PLAN_LIMITS[to].label}`
          : `Cette fonctionnalité est réservée au plan ${PLAN_LIMITS[to].label}`,
        desc: `Mets à niveau pour déverrouiller cette fonctionnalité et bien d'autres.`,
        benefits: to === "pro"
          ? ["JuryAI — entraîne-toi à la soutenance", "Anti-plagiat intelligent", "Révisions illimitées", "Certificat Anti-IA"]
          : ["Pages illimitées", "Slides PowerPoint", "Tout Pro inclus", "Support prioritaire"],
        targetPlan: PLAN_LIMITS[to].label,
        upgradeLabel: `Passer au ${PLAN_LIMITS[to].label}`,
        price: cost,
      };
  }
}

interface UpsellModalProps {
  open: boolean;
  onClose: () => void;
  variant: UpsellVariant;
  currentPlan?: PlanId;
  featureName?: string;
}

export function UpsellModal({
  open,
  onClose,
  variant,
  currentPlan = "free",
  featureName,
}: UpsellModalProps) {
  const cfg = getConfig(variant, currentPlan, featureName);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ background: "rgba(15,10,30,0.45)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1,   opacity: 1, y: 0  }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            style={{ boxShadow: "0 32px 80px rgba(124,58,237,0.22), 0 4px 20px rgba(0,0,0,0.15)" }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Top gradient banner */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)" }} />

            {/* Body */}
            <div className="px-7 pt-6 pb-7">
              {/* Icon */}
              <div className={`w-12 h-12 ${cfg.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
                {cfg.icon}
              </div>

              {/* Text */}
              <h2
                className="text-lg font-bold text-gray-900 mb-2 leading-snug"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {cfg.title}
              </h2>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{cfg.desc}</p>

              {/* Benefits */}
              <div className="bg-purple-50/60 rounded-xl p-4 mb-5 border border-purple-100">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-3">
                  Plan {cfg.targetPlan} inclut
                </p>
                <ul className="space-y-2">
                  {cfg.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                      </div>
                      <span className="text-sm text-gray-700">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price callout */}
              <div className="flex items-center justify-between mb-5 px-1">
                <span className="text-sm text-gray-500">Mise à niveau</span>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-gray-900">+{cfg.price}</span>
                  <span className="text-sm text-gray-400 ml-1">MAD</span>
                  <p className="text-xs text-gray-400">paiement unique · différence seulement</p>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-2.5">
                <Link href="/pricing">
                  <Button
                    onClick={onClose}
                    className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"
                    style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
                  >
                    <Zap className="w-4 h-4" />
                    {cfg.upgradeLabel} — +{cfg.price} MAD
                  </Button>
                </Link>
                <button
                  onClick={onClose}
                  className="w-full h-10 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Plus tard
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 mt-3">
                Paiement sécurisé · Remboursement 48h
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
