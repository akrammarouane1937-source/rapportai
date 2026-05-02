import { motion } from "framer-motion";
import { Link } from "wouter";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: "149",
    label: "Paiement unique",
    popular: false,
    cta: "Choisir Essentiel",
    ctaVariant: "outline" as const,
    features: [
      "30 pages",
      "PDF + Word",
      "10 révisions",
      "Chatbot IA",
      "Canevas de ton école",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "449",
    label: "Paiement unique",
    popular: true,
    cta: "Choisir Pro",
    ctaVariant: "default" as const,
    features: [
      "60 pages",
      "PDF + Word",
      "Révisions illimitées",
      "Chatbot IA",
      "Canevas de ton école",
      "Rapport de citations",
      "Vérification anti-plagiat",
      "Certificat Anti-Détection IA",
      "JuryAI — Simulation de soutenance",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "749",
    label: "Paiement unique",
    popular: false,
    cta: "Choisir Premium",
    ctaVariant: "outline" as const,
    features: [
      "Pages illimitées",
      "PDF + Word",
      "Tout le plan Pro inclus",
      "Slides PowerPoint",
      "JuryAI — Simulation de soutenance",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f9f8ff] flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center text-white">
                <Sparkles size={18} />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                RapportAI
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" className="text-gray-600 hover:text-purple-600">Se connecter</Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6">
                Commencer gratuitement
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4" /> Tarifs transparents, paiement unique
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Choisis ton plan
            </h1>
            <p className="text-xl text-gray-500 max-w-xl mx-auto">
              Un seul paiement. Pas d'abonnement. Ton rapport livré en 30 minutes.
            </p>
          </motion.div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative bg-white rounded-2xl flex flex-col overflow-hidden ${
                  plan.popular
                    ? "border-2 border-purple-500 shadow-[0_8px_40px_rgba(124,58,237,0.18)]"
                    : "border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                      Le plus populaire
                    </span>
                  </div>
                )}

                <div className={`p-7 flex-1 ${plan.popular ? "pt-9" : ""}`}>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {plan.name}
                    </h2>
                    <p className="text-xs text-gray-400 font-medium">{plan.label}</p>
                  </div>

                  <div className="mb-7">
                    <span className="text-5xl font-extrabold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {plan.price}
                    </span>
                    <span className="text-xl font-semibold text-gray-500 ml-1">MAD</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-purple-600 stroke-[2.5]" />
                        </div>
                        <span className="text-sm text-gray-700 leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-7 pb-7">
                  <Link href="/sign-up">
                    <Button
                      className={`w-full h-11 font-semibold rounded-xl text-sm ${
                        plan.popular
                          ? "bg-purple-600 hover:bg-purple-700 text-white shadow-[0_4px_16px_rgba(124,58,237,0.3)]"
                          : "border-2 border-purple-600 text-purple-600 hover:bg-purple-50 bg-white"
                      }`}
                      variant={plan.ctaVariant}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer note */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-center text-sm text-gray-400 mt-10">
            Paiement sécurisé · Remboursement 48h · MAD
          </motion.p>
        </div>
      </main>
    </div>
  );
}
