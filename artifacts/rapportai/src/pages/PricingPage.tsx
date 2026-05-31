import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { Check, X, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicNavbar from "@/components/layout/PublicNavbar";
import { getMyPlan, type PlanId } from "@/lib/userPlan";
import { API_BASE as BASE_PATH } from "@/lib/apiBase";

/* ─── Plan definitions ──────────────────────────────────────────────────── */
interface Plan {
  id:          PlanId;
  name:        string;
  priceMad:    number | null;
  anchorMad:   number | null;
  description: string;
  cta:         string;
  popular:     boolean;
  features:    string[];
}

const PLANS: Plan[] = [
  {
    id:          "free",
    name:        "Gratuit",
    priceMad:    null,
    anchorMad:   null,
    description: "Pour explorer la plateforme sans engagement.",
    cta:         "Commencer gratuitement",
    popular:     false,
    features: [
      "15 pages générées",
      "2 révisions IA",
      "Export Word",
      "Qualité identique aux plans payants",
    ],
  },
  {
    id:          "starter",
    name:        "Essentiel",
    priceMad:    377,
    anchorMad:   1000,
    description: "Pour finir ton rapport en une seule session.",
    cta:         "Choisir Essentiel",
    popular:     false,
    features: [
      "60 pages générées",
      "20 révisions IA",
      "Export Word + PDF",
      "Humanisation anti-détection IA",
      "Génération depuis tes documents",
      "Canevas de ton école",
    ],
  },
  {
    id:          "pro",
    name:        "Pro",
    priceMad:    677,
    anchorMad:   1500,
    description: "Pages et révisions illimitées. Accès complet.",
    cta:         "Choisir Pro",
    popular:     true,
    features: [
      "Pages illimitées",
      "Révisions illimitées",
      "Export Word + PDF",
      "Humanisation anti-détection IA",
      "Génération depuis tes documents",
      "Canevas de ton école",
      "Accès JuryAI",
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "Est-ce un paiement unique ou un abonnement ?",
    a: "Paiement unique. Pas d'abonnement, pas de renouvellement automatique. Tu paies une fois et tu accèdes à ta limite de pages.",
  },
  {
    q: "Pourquoi une limite en pages et non en rapports ?",
    a: "Un rapport PFE fait en moyenne 60–80 pages. Le plan Essentiel couvre exactement 1 rapport complet. Le Pro te donne l'illimité pour itérer autant que tu veux.",
  },
  {
    q: "Puis-je passer de Essentiel à Pro ?",
    a: "Oui. Tu ne paies que la différence — 300 MAD. Contacte-nous par email pour le faire.",
  },
  {
    q: "Quels modes de paiement sont acceptés ?",
    a: "Carte bancaire internationale (Visa / Mastercard). Carte marocaine CMI à venir.",
  },
  {
    q: "Est-ce que les paiements sont sécurisés ?",
    a: "Oui. Tous les paiements passent par Stripe, le standard mondial de sécurité. Nous ne stockons aucune donnée de carte.",
  },
];

/* ─── Main content — receives auth as props ─────────────────────────────── */
function PricingContent({
  isSignedIn,
  userEmail,
}: {
  isSignedIn: boolean;
  userEmail:  string | undefined;
}) {
  const [, setLocation]       = useLocation();
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currentPlan = getMyPlan();
  const planOrder: PlanId[] = ["free", "starter", "pro"];
  const canUpgrade = (id: PlanId) =>
    planOrder.indexOf(id) > planOrder.indexOf(currentPlan.planId);

  const handleCheckout = async (plan: Plan) => {
    if (!plan.priceMad) return;
    if (!isSignedIn) { setLocation("/sign-up"); return; }

    setLoading(plan.id);
    setError(null);
    try {
      const origin = window.location.origin;
      const res    = await fetch(`${BASE_PATH}/api/payments/checkout`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan:       plan.id,
          report_id:  crypto.randomUUID(),
          user_email: userEmail,
          successUrl: `${origin}${BASE_PATH}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl:  `${origin}${BASE_PATH}/pricing?payment=cancelled`,
        }),
      });
      const data = await res.json() as { checkout_url?: string; error?: string };
      if (!res.ok || !data.checkout_url) throw new Error(data.error ?? "Erreur paiement");
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicNavbar />

      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-5xl">

          {/* Hero */}
          <div className="text-center mb-16">
            <h1
              className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Pricing
            </h1>
            <p className="text-lg text-gray-500">
              Un seul paiement. Ton rapport académique livré en 30 minutes.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => {
              const isCurrent  = plan.id === currentPlan.planId;
              const isFree     = plan.priceMad === null;
              const upgradable = canUpgrade(plan.id);
              const discount   =
                plan.priceMad && plan.anchorMad
                  ? Math.round((1 - plan.priceMad / plan.anchorMad) * 100)
                  : null;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-7 flex flex-col border transition-shadow
                    ${plan.popular
                      ? "border-purple-400 shadow-[0_0_0_1px_rgba(124,58,237,0.2),0_8px_32px_rgba(124,58,237,0.10)]"
                      : "border-gray-200 shadow-sm hover:shadow-md"
                    }`}
                >
                  {/* Popular badge — top-right inside card */}
                  {plan.popular && (
                    <span className="absolute top-5 right-5 bg-purple-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full leading-none">
                      Le plus populaire
                    </span>
                  )}
                  {isCurrent && !plan.popular && (
                    <span className="absolute top-5 right-5 bg-green-100 text-green-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-green-200 leading-none">
                      Plan actuel
                    </span>
                  )}

                  {/* Plan name */}
                  <p className="text-sm font-semibold text-gray-500 mb-4">{plan.name}</p>

                  {/* Price */}
                  <div className="mb-6">
                    {isFree ? (
                      <p
                        className="text-4xl font-extrabold text-gray-900"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        Free
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-400 line-through">{plan.anchorMad} MAD</span>
                          {discount && (
                            <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                              -{discount}%
                            </span>
                          )}
                        </div>
                        <p
                          className="text-4xl font-extrabold text-gray-900"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          {plan.priceMad}{" "}
                          <span className="text-lg font-semibold text-gray-400">MAD</span>
                        </p>
                      </>
                    )}
                    <p className="text-sm text-gray-500 mt-2 leading-snug">{plan.description}</p>
                  </div>

                  {/* CTA */}
                  <div className="mb-6">
                    {isCurrent ? (
                      <div className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 text-sm font-medium flex items-center justify-center">
                        Plan actuel
                      </div>
                    ) : isFree ? (
                      <Link href="/sign-up">
                        <Button
                          variant="outline"
                          className="w-full h-10 rounded-lg font-semibold text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          {plan.cta}
                        </Button>
                      </Link>
                    ) : upgradable || !isSignedIn ? (
                      <Button
                        onClick={() => void handleCheckout(plan)}
                        disabled={loading !== null}
                        className={`w-full h-10 rounded-lg font-semibold text-sm ${
                          plan.popular
                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                            : "bg-gray-900 hover:bg-gray-800 text-white"
                        }`}
                      >
                        {loading === plan.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2 inline" />Redirection…</>
                        ) : (
                          plan.cta
                        )}
                      </Button>
                    ) : (
                      <div className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 text-sm font-medium flex items-center justify-center">
                        Plan supérieur requis
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 mb-5" />

                  {/* Features */}
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-sm text-gray-600">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Checkout error */}
          {error && (
            <div className="mt-6 max-w-md mx-auto bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <X className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" /> Paiement sécurisé SSL
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" /> Pas d'abonnement caché
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" /> Support 7j/7
            </span>
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2
              className="text-2xl font-bold text-gray-900 mb-8"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Questions fréquentes
            </h2>
            <div className="divide-y divide-gray-100">
              {FAQ_ITEMS.map(({ q, a }, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between py-4 text-left gap-4"
                  >
                    <span className="text-sm font-medium text-gray-800">{q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openFaq === i && (
                    <p className="pb-4 text-sm text-gray-500 leading-relaxed">{a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

/* ─── Clerk-aware wrapper (only rendered inside ClerkProvider) ──────────── */
function PricingWithClerk() {
  const { isSignedIn } = useAuth();
  const { user }       = useUser();
  return (
    <PricingContent
      isSignedIn={!!isSignedIn}
      userEmail={user?.primaryEmailAddress?.emailAddress ?? undefined}
    />
  );
}

/* ─── Default export — safe in both Clerk and no-Clerk contexts ─────────── */
export default function PricingPage() {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  if (clerkKey) return <PricingWithClerk />;
  return <PricingContent isSignedIn={false} userEmail={undefined} />;
}
