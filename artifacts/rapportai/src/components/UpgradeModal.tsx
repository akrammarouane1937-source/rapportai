import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CheckCircle2 } from "lucide-react";
import { PLAN_LIMITS, upgradeCostMad, type PlanId } from "@/lib/userPlan";

interface UpgradeModalProps {
  open:        boolean;
  onClose:     () => void;
  currentPlan: PlanId;
  limitType:   "pages" | "revisions";
  onCheckout:  (plan: PlanId) => void;
  loading?:    boolean;
}

const MESSAGES: Record<PlanId, Record<"pages" | "revisions", { title: string; body: string }>> = {
  free: {
    pages:     { title: "Tu as atteint tes 15 pages gratuites 🎯", body: "Tu viens de voir la qualité RapportAI. Passe à Essentiel pour générer ton rapport complet en 30 minutes." },
    revisions: { title: "Tes 2 révisions gratuites sont épuisées", body: "Tu viens de voir comment l'IA améliore ton texte. Passe à Essentiel pour 20 révisions complètes." },
  },
  starter: {
    pages:     { title: "Tu as atteint tes 60 pages 🎯", body: "Les rapports Pro avec pages illimitées obtiennent de meilleures notes — ils peuvent itérer sans limite jusqu'à la perfection." },
    revisions: { title: "Tu as atteint tes 20 révisions", body: "Les rapports Pro avec révisions illimitées obtiennent de meilleures notes — l'IA affine chaque section jusqu'à ce que ce soit parfait." },
  },
  pro: {
    pages:     { title: "", body: "" },
    revisions: { title: "", body: "" },
  },
};

export default function UpgradeModal({
  open, onClose, currentPlan, limitType, onCheckout, loading = false,
}: UpgradeModalProps) {
  const target      = currentPlan === "free" ? "starter" : "pro";
  const targetLimit = PLAN_LIMITS[target];
  const msg         = MESSAGES[currentPlan][limitType];
  const diffMad     = upgradeCostMad(currentPlan, target);
  const isEssentiel = currentPlan === "free";

  const features = isEssentiel
    ? ["60 pages générées", "20 révisions IA", "Export Word + PDF", "Humanisation anti-détection IA"]
    : ["Pages illimitées", "Révisions illimitées", "Export Word + PDF", "Humanisation anti-détection IA"];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Top gradient bar */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7,#7c3aed)" }} />

            <div className="p-6">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>

              {/* Title + body */}
              <h2 className="text-lg font-bold text-gray-900 mb-2 leading-snug" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                {msg.title}
              </h2>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{msg.body}</p>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Pricing display */}
              <div className="bg-purple-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {/* For Pro upsell: show ~~1500~~ ~~677~~ → "pour seulement 300 MAD" */}
                  {!isEssentiel && (
                    <>
                      <span className="text-sm line-through text-gray-400">{targetLimit.anchorMad} MAD</span>
                      <span className="text-sm line-through text-gray-400">{targetLimit.priceMad} MAD</span>
                    </>
                  )}
                  {/* For Essentiel upsell: show ~~1000~~ → "377 MAD" */}
                  {isEssentiel && (
                    <span className="text-sm line-through text-gray-400">{targetLimit.anchorMad} MAD</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-purple-700" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                    {isEssentiel ? `${targetLimit.priceMad} MAD` : `pour seulement ${diffMad} MAD`}
                  </span>
                  {!isEssentiel && (
                    <p className="text-[10px] text-purple-500 font-medium">en plus de ton plan Essentiel</p>
                  )}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => onCheckout(target)}
                disabled={loading}
                className="w-full h-11 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 16px rgba(124,58,237,0.32)" }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Redirection…
                  </span>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Passer au plan {targetLimit.label}
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-gray-400 mt-3">
                Paiement unique · Remboursement 48h · Pas d'abonnement
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
