import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface PaywallModalProps {
  open: boolean;
  onClose?: () => void;
}

const PLANS = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: "149",
    popular: false,
    features: ["30 pages", "PDF + Word", "10 révisions", "Chatbot IA"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "449",
    popular: true,
    features: ["60 pages", "Révisions illimitées", "Anti-plagiat", "Certificat Anti-IA", "JuryAI"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "749",
    popular: false,
    features: ["Pages illimitées", "Tout Pro inclus", "Slides PowerPoint", "JuryAI"],
  },
];

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(249,248,255,0.7)", backdropFilter: "blur(2px)" }}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden"
            style={{ boxShadow: "0 24px 80px rgba(124,58,237,0.18)" }}
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100 relative">
              {onClose && (
                <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Continue la génération de ton rapport
              </h2>
              <p className="text-sm text-gray-500">
                Tu as atteint la limite gratuite. Choisis un plan pour débloquer la génération complète.
              </p>
            </div>

            {/* Plans */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative rounded-xl flex flex-col overflow-visible ${
                      plan.popular
                        ? "border-2 border-purple-500 bg-purple-50/40"
                        : "border border-gray-100 bg-white"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow">
                          Le plus populaire
                        </span>
                      </div>
                    )}
                    <div className={`p-4 flex-1 ${plan.popular ? "pt-6" : ""}`}>
                      <h3 className="font-bold text-gray-900 text-sm mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {plan.name}
                      </h3>
                      <div className="mb-3">
                        <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                        <span className="text-sm text-gray-400 ml-1">MAD</span>
                      </div>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 mt-0.5 stroke-[2.5]" />
                            <span className="text-xs text-gray-600 leading-snug">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4 pt-0">
                      <Link href="/pricing">
                        <Button
                          className={`w-full h-9 text-xs font-semibold rounded-lg ${
                            plan.popular
                              ? "bg-purple-600 hover:bg-purple-700 text-white"
                              : "border-2 border-purple-500 text-purple-600 hover:bg-purple-50 bg-white"
                          }`}
                          variant={plan.popular ? "default" : "outline"}
                        >
                          Choisir {plan.name}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-gray-400 mt-5">
                Paiement sécurisé · Remboursement 48h · MAD
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
