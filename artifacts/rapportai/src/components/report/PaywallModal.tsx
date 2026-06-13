import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type PlanId, PLAN_LIMITS, getMyPlan, upgradeCostMad } from "@/lib/userPlan";
import { startCheckout } from "@/lib/checkout";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";

interface PaywallModalProps {
  open:          boolean;
  onClose?:      () => void;
  /** Defaults to the locally-stored plan. */
  currentPlan?:  PlanId;
  /** Lowest plan that unlocks what the user clicked. Hides cheaper plans. */
  requiredPlan?: PlanId;
}

const ORDER: PlanId[] = ["free", "basique", "starter", "pro"];

const FEATURES: Record<Exclude<PlanId, "free">, string[]> = {
  basique: ["35 pages", "Partie I incluse", "8 révisions", "Humanisation anti-détection IA"],
  starter: ["60 pages", "Parties I + II", "Export Word + PDF", "Humanisation anti-détection IA", "20 révisions"],
  pro:     ["Pages illimitées", "Révisions illimitées", "Humanisation anti-détection IA", "JuryAI"],
};

const PAID: Exclude<PlanId, "free">[] = ["basique", "starter", "pro"];

export function PaywallModal({ open, onClose, currentPlan, requiredPlan }: PaywallModalProps) {
  const { user } = useUser();
  const current  = currentPlan ?? getMyPlan().planId;
  const minRank  = requiredPlan ? ORDER.indexOf(requiredPlan) : 0;

  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Reset the spinner if the user returns via the browser back button (the page
  // is restored from bfcache with React state frozen mid-redirect).
  useEffect(() => {
    const reset = () => setLoading(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  useEffect(() => { if (!open) { setLoading(null); setError(null); } }, [open]);

  // Plans above the user's current plan AND high enough to unlock the content.
  const plans = PAID.filter(
    (p) => ORDER.indexOf(p) > ORDER.indexOf(current) && ORDER.indexOf(p) >= minRank,
  );

  const isUpgrade   = current !== "free";
  const recommended = plans.includes("starter") ? "starter" : plans[0];

  const handle = async (plan: PlanId) => {
    setLoading(plan);
    setError(null);
    try {
      await startCheckout({
        plan,
        clerkId:   user?.id,
        userEmail: user?.primaryEmailAddress?.emailAddress,
      });
      // success → browser redirects to Stripe
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de paiement");
      setLoading(null);
    }
  };

  const cols = plans.length >= 3 ? "grid-cols-3" : plans.length === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ background: "rgba(15,10,30,0.45)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden"
            style={{ boxShadow: "0 24px 80px rgba(124,58,237,0.22)" }}
          >
            <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {isUpgrade ? "Passe au plan supérieur" : "Débloque ton rapport complet"}
              </h2>
              <p className="text-sm text-gray-500">
                {isUpgrade
                  ? "Tu ne paies que la différence avec ton plan actuel."
                  : "Choisis ton plan et génère ton rapport en quelques minutes."}
              </p>
            </div>

            <div className="p-6">
              {plans.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">
                  Tu as déjà le meilleur plan disponible. 🎉
                </p>
              ) : (
                <div className={`grid ${cols} gap-3`}>
                  {plans.map((plan) => {
                    const popular = plan === recommended;
                    const amount  = isUpgrade ? upgradeCostMad(current, plan) : PLAN_LIMITS[plan].priceMad;
                    return (
                      <div
                        key={plan}
                        className={`relative rounded-xl flex flex-col overflow-visible ${
                          popular ? "border-2 border-purple-500 bg-purple-50/40" : "border border-gray-100 bg-white"
                        }`}
                      >
                        {popular && (
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow">
                              Recommandé
                            </span>
                          </div>
                        )}
                        <div className={`p-4 flex-1 ${popular ? "pt-6" : ""}`}>
                          <h3 className="font-bold text-gray-900 text-sm mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {PLAN_LIMITS[plan].label}
                          </h3>
                          <div className="mb-3">
                            <span className="text-2xl font-extrabold text-gray-900">{isUpgrade ? `+${amount}` : amount}</span>
                            <span className="text-sm text-gray-400 ml-1">MAD</span>
                            {isUpgrade && <p className="text-xs text-gray-400">différence seulement</p>}
                          </div>
                          <ul className="space-y-1.5">
                            {FEATURES[plan].map((f) => (
                              <li key={f} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 mt-0.5 stroke-[2.5]" />
                                <span className="text-xs text-gray-600 leading-snug">{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-4 pt-0">
                          <Button
                            onClick={() => handle(plan)}
                            disabled={loading !== null}
                            className={`w-full h-9 text-xs font-semibold rounded-lg ${
                              popular
                                ? "bg-purple-600 hover:bg-purple-700 text-white"
                                : "border-2 border-purple-500 text-purple-600 hover:bg-purple-50 bg-white"
                            }`}
                            variant={popular ? "default" : "outline"}
                          >
                            {loading === plan
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : `Choisir ${PLAN_LIMITS[plan].label}`}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <p className="text-center text-xs text-gray-400 mt-5">
                Paiement sécurisé · Remboursement 48h
              </p>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  Plus tard
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
