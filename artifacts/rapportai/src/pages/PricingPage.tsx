import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Check, X, Sparkles, ShieldCheck,
  ChevronRight, ArrowLeft, Loader2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyPlan, PLAN_LIMITS, type PlanId } from "@/lib/userPlan";
import { API_BASE as BASE_PATH } from "@/lib/apiBase";

/* ─── Plan definitions ─────────────────────────────────────────────────── */
interface Plan {
  id:          PlanId;
  name:        string;
  priceMad:    number;
  anchorMad:   number;
  popular:     boolean;
  description: string;
  features:    string[];
  locked:      string[];
  highlight?:  string;
}

const PLANS: Plan[] = [
  {
    id:          "free",
    name:        "Gratuit",
    priceMad:    0,
    anchorMad:   0,
    popular:     false,
    description: "Vois par toi-même avant de t'engager.",
    highlight:   "Sans carte bancaire",
    features: [
      "15 pages générées",
      "2 révisions IA",
      "Téléchargement Word inclus",
      "Qualité identique aux plans payants",
    ],
    locked: ["Export PDF", "Humanisation anti-IA", "Génération depuis tes documents"],
  },
  {
    id:          "starter",
    name:        "Essentiel",
    priceMad:    377,
    anchorMad:   1000,
    popular:     false,
    description: "Pour finir ton rapport sans stress.",
    features: [
      "60 pages générées",
      "20 révisions IA",
      "Export Word + PDF",
      "Humanisation anti-détection IA",
      "Génération depuis tes documents",
      "Canevas de ton école",
    ],
    locked: ["Pages illimitées", "Révisions illimitées"],
  },
  {
    id:          "pro",
    name:        "Pro",
    priceMad:    677,
    anchorMad:   1500,
    popular:     true,
    description: "Le choix des étudiants sérieux.",
    features: [
      "Pages illimitées",
      "Révisions illimitées",
      "Export Word + PDF",
      "Humanisation anti-détection IA",
      "Génération depuis tes documents",
      "Canevas de ton école",
      "Accès JuryAI",
    ],
    locked: [],
  },
];

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function PricingPage() {
  const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError]     = useState<string | null>(null);
  const currentPlan = getMyPlan();

  const canUpgrade = (planId: PlanId) => {
    const order: PlanId[] = ["free", "starter", "pro"];
    return order.indexOf(planId) > order.indexOf(currentPlan.planId);
  };

  const handleCheckout = async (plan: Plan) => {
    if (plan.priceMad === 0) return;
    setCheckoutLoading(plan.id);
    setCheckoutError(null);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${BASE_PATH}/api/payments/checkout`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan:       plan.id,
          report_id:  crypto.randomUUID(),
          successUrl: `${origin}${BASE_PATH}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl:  `${origin}${BASE_PATH}/pricing?payment=cancelled`,
        }),
      });
      const data = await res.json() as { checkout_url?: string; error?: string };
      if (!res.ok || !data.checkout_url) throw new Error(data.error ?? "Erreur Stripe");
      window.location.href = data.checkout_url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erreur inconnue");
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f8ff] flex flex-col">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img src="/logo.svg" alt="RapportAI" className="w-8 h-8" />
              <span className="font-bold text-xl text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                RapportAI
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-purple-600 flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Tableau de bord
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-5">
                Commencer gratuitement
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-5xl">

          {/* ── Hero ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4" /> Paiement unique · Pas d'abonnement
            </div>
            <h1
              className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Choisis ton plan
            </h1>
            <p className="text-xl text-gray-500 max-w-xl mx-auto">
              Un seul paiement. Ton rapport académique livré en 30 minutes.
            </p>
          </motion.div>

          {/* ── Market anchor banner ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="max-w-2xl mx-auto mb-12 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center gap-3 text-sm"
          >
            <span className="text-amber-500 text-lg">💡</span>
            <p className="text-amber-800">
              <strong>Les prestataires chargent 1000–2500 MAD</strong> pour un rapport PFE.
              RapportAI génère le même résultat en 30 minutes — <strong>à partir de 377 MAD</strong>.
            </p>
          </motion.div>

          {/* ── Plan cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => {
              const isCurrent  = plan.id === currentPlan.planId;
              const upgradable = canUpgrade(plan.id);
              const isFree     = plan.priceMad === 0;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative bg-white rounded-2xl flex flex-col overflow-hidden transition-transform hover:-translate-y-1
                    ${plan.popular
                      ? "border-2 border-purple-500 shadow-[0_8px_40px_rgba(124,58,237,0.18)]"
                      : "border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"}
                  `}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <span className="bg-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5">
                        <Zap className="w-3 h-3" /> Le plus populaire
                      </span>
                    </div>
                  )}

                  {/* Current plan ribbon */}
                  {isCurrent && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200">
                        Plan actuel
                      </span>
                    </div>
                  )}

                  <div className={`p-7 flex-1 ${plan.popular ? "pt-9" : ""}`}>
                    {/* Name + desc */}
                    <div className="mb-5">
                      <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {plan.name}
                      </h2>
                      <p className="text-sm text-gray-500">{plan.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-1">
                      {!isFree && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm line-through text-gray-400">{plan.anchorMad} MAD</span>
                          <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                            -{Math.round((1 - plan.priceMad / plan.anchorMad) * 100)}%
                          </span>
                        </div>
                      )}
                      <div className="flex items-end gap-1 mb-1">
                        <span className="text-5xl font-extrabold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          {isFree ? "Gratuit" : plan.priceMad}
                        </span>
                        {!isFree && <span className="text-xl font-semibold text-gray-400 mb-1">MAD</span>}
                      </div>
                    </div>

                    {plan.highlight && (
                      <p className="text-xs text-green-600 font-semibold mb-5">{plan.highlight}</p>
                    )}
                    {!plan.highlight && <div className="mb-5" />}

                    {/* Features */}
                    <ul className="space-y-2.5 mb-5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <div className="w-4.5 h-4.5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-purple-600 stroke-[2.5]" />
                          </div>
                          <span className="text-sm text-gray-700 leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Locked features */}
                    {plan.locked.length > 0 && (
                      <ul className="space-y-2.5 opacity-40">
                        {plan.locked.map((f) => (
                          <li key={f} className="flex items-start gap-3">
                            <div className="w-4.5 h-4.5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <X className="w-3 h-3 text-gray-400" />
                            </div>
                            <span className="text-sm text-gray-400 leading-snug line-through">{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="px-7 pb-7">
                    {isCurrent ? (
                      <div className="w-full h-11 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-semibold text-sm flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Plan actuel
                      </div>
                    ) : isFree ? (
                      <Link href="/sign-up">
                        <Button className="w-full h-11 font-semibold rounded-xl text-sm border-2 border-purple-200 text-purple-700 hover:bg-purple-50 bg-white" variant="outline">
                          Commencer gratuitement <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    ) : upgradable ? (
                      <Button
                        onClick={() => handleCheckout(plan)}
                        disabled={checkoutLoading !== null}
                        className={`w-full h-11 font-semibold rounded-xl text-sm transition-all
                          ${plan.popular
                            ? "bg-purple-600 hover:bg-purple-700 text-white shadow-[0_4px_16px_rgba(124,58,237,0.32)]"
                            : "border-2 border-purple-600 text-purple-600 hover:bg-purple-50 bg-white"}
                        `}
                        variant={plan.popular ? "default" : "outline"}
                      >
                        {checkoutLoading === plan.id
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" />Redirection…</>
                          : <>Choisir {plan.name} <ChevronRight className="w-3.5 h-3.5 ml-1 inline" /></>
                        }
                      </Button>
                    ) : (
                      <Button disabled className="w-full h-11 rounded-xl text-sm border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed" variant="ghost">
                        Plan supérieur requis
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── Checkout error ── */}
          {checkoutError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 max-w-md mx-auto bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <X className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{checkoutError}</p>
              <button onClick={() => setCheckoutError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── Trust strip ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400"
          >
            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-500" /> Paiement sécurisé SSL</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Remboursement 48h</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Pas d'abonnement caché</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Support 7j/7</span>
          </motion.div>

          {/* ── FAQ ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 max-w-2xl mx-auto"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Questions fréquentes
            </h2>
            {[
              { q: "Est-ce vraiment un paiement unique ?", a: "Oui. Pas d'abonnement, pas de renouvellement automatique. Tu paies une fois et tu génères ton rapport." },
              { q: "Pourquoi une limite en pages et non en rapports ?", a: "Un rapport PFE fait en moyenne 60–80 pages. Le plan Essentiel couvre exactement 1 rapport complet. Le Pro te donne l'illimité pour itérer autant que tu veux." },
              { q: "Puis-je passer de Essentiel à Pro ?", a: "Oui, tu ne paies que la différence — 300 MAD pour passer au Pro." },
              { q: "Quels modes de paiement sont acceptés ?", a: "Carte bancaire internationale (Visa / Mastercard). Carte marocaine CMI à venir." },
              { q: "Comment fonctionne le remboursement ?", a: "Si tu n'es pas satisfait dans les 48h après l'achat, on te rembourse sans poser de questions." },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-100 py-4">
                <p className="font-semibold text-gray-800 text-sm mb-1.5">{q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </motion.div>

        </div>
      </main>
    </div>
  );
}
