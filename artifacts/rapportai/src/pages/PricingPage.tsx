import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Check, Sparkles, X, CreditCard, Smartphone, ShieldCheck,
  ChevronRight, ArrowLeft, Loader2, PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyPlan, saveMyPlan, type PlanId } from "@/lib/userPlan";

/* ─── Plan definitions ─────────────────────────────────────────────────── */
interface Plan {
  id: PlanId;
  name: string;
  price: number;
  popular: boolean;
  color: string;
  description: string;
  features: string[];
  locked: string[];
}

const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: 149,
    popular: false,
    color: "#7c3aed",
    description: "Pour finir ton rapport sans stress.",
    features: [
      "30 pages générées",
      "Export Word + PDF",
      "10 révisions IA",
      "Canevas de ton école",
      "Chatbot IA intégré",
    ],
    locked: ["JuryAI", "Anti-plagiat", "Certificat Anti-IA", "Slides PowerPoint"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 449,
    popular: true,
    color: "#7c3aed",
    description: "Le choix des étudiants sérieux.",
    features: [
      "60 pages générées",
      "Export Word + PDF",
      "Révisions illimitées",
      "Canevas de ton école",
      "Chatbot IA intégré",
      "Rapport de citations complet",
      "Vérification anti-plagiat",
      "Certificat Anti-Détection IA",
      "JuryAI — Simulation de soutenance",
    ],
    locked: ["Slides PowerPoint"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 749,
    popular: false,
    color: "#4c1d95",
    description: "Zéro limite. Zéro compromis.",
    features: [
      "Pages illimitées",
      "Export Word + PDF",
      "Révisions illimitées",
      "Tout le plan Pro inclus",
      "Slides PowerPoint",
      "Support prioritaire",
    ],
    locked: [],
  },
];

/* ─── Payment methods ───────────────────────────────────────────────────── */
type PayMethod = "cmi" | "orange" | "cih";

const PAY_METHODS: { id: PayMethod; label: string; sub: string; icon: React.ReactNode }[] = [
  {
    id: "cmi",
    label: "Carte bancaire",
    sub: "Visa / Mastercard / CMI",
    icon: <CreditCard className="w-5 h-5 text-blue-600" />,
  },
  {
    id: "orange",
    label: "Orange Money",
    sub: "Paiement mobile instantané",
    icon: <Smartphone className="w-5 h-5 text-orange-500" />,
  },
  {
    id: "cih",
    label: "CIH Pay",
    sub: "Via votre compte CIH",
    icon: <Smartphone className="w-5 h-5 text-green-600" />,
  },
];

/* ─── Checkout modal ────────────────────────────────────────────────────── */
type CheckoutStep = "method" | "details" | "processing" | "success";

function CheckoutModal({
  plan,
  onClose,
}: {
  plan: Plan;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<CheckoutStep>("method");
  const [method, setMethod] = useState<PayMethod>("cmi");
  const [phone, setPhone] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const handlePay = () => {
    setStep("processing");
    setTimeout(() => {
      saveMyPlan({ planId: plan.id, purchasedAt: Date.now() });
      setStep("success");
    }, 2400);
  };

  const handleGoToDashboard = () => {
    onClose();
    setLocation("/dashboard");
  };

  const detailsValid =
    method === "cmi"
      ? cardNum.replace(/\s/g, "").length >= 16 && cardExp.length >= 5 && cardCvv.length >= 3
      : phone.replace(/\s/g, "").length >= 10;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(15,10,30,0.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && step !== "processing") onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1,     opacity: 1, y: 0  }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: "0 32px 80px rgba(124,58,237,0.25), 0 4px 24px rgba(0,0,0,0.12)" }}
      >
        {/* Top stripe */}
        <div className="h-1.5" style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)" }} />

        {/* Close button (hidden during processing) */}
        {step !== "processing" && step !== "success" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <AnimatePresence mode="wait">

          {/* ── Step 1: choose method ── */}
          {step === "method" && (
            <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-7">
              {/* Plan summary */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-0.5">Plan {plan.name}</p>
                  <p className="text-2xl font-extrabold text-gray-900">{plan.price} <span className="text-base font-semibold text-gray-400">MAD</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">Paiement unique · Remboursement 48h</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-purple-600" />
                </div>
              </div>

              <p className="text-sm font-semibold text-gray-700 mb-3">Choisir le mode de paiement</p>
              <div className="space-y-2.5 mb-6">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`w-full flex items-center gap-3.5 p-4 rounded-xl border-2 transition-all text-left
                      ${method === m.id ? "border-purple-500 bg-purple-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${method === m.id ? "bg-white" : "bg-gray-50"}`}>
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                      <p className="text-xs text-gray-400">{m.sub}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === m.id ? "border-purple-500 bg-purple-500" : "border-gray-300"}`}>
                      {method === m.id && <div className="w-full h-full rounded-full bg-white scale-50" />}
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={() => setStep("details")}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
              >
                Continuer <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 2: payment details ── */}
          {step === "details" && (
            <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-7">
              <button onClick={() => setStep("method")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>

              <h3 className="font-bold text-gray-900 text-base mb-5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {method === "cmi" ? "Informations de carte" : method === "orange" ? "Orange Money" : "CIH Pay"}
              </h3>

              {method === "cmi" ? (
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Numéro de carte</label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={cardNum}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
                        setCardNum(v.replace(/(.{4})/g, "$1 ").trim());
                      }}
                      className="h-11 rounded-xl border-gray-200 focus:border-purple-400 focus:ring-purple-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Date d'expiration</label>
                      <Input
                        placeholder="MM/AA"
                        value={cardExp}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                          if (v.length > 2) v = v.slice(0,2) + "/" + v.slice(2);
                          setCardExp(v);
                        }}
                        className="h-11 rounded-xl border-gray-200 focus:border-purple-400 focus:ring-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">CVV</label>
                      <Input
                        placeholder="123"
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                        className="h-11 rounded-xl border-gray-200 focus:border-purple-400 focus:ring-purple-300"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Numéro de téléphone</label>
                  <Input
                    placeholder="06 12 34 56 78"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 14))}
                    className="h-11 rounded-xl border-gray-200 focus:border-purple-400 focus:ring-purple-300"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {method === "orange" ? "Un code OTP vous sera envoyé pour confirmer." : "Vous recevrez une notification CIH Pay pour approuver."}
                  </p>
                </div>
              )}

              {/* Security note */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 mb-5">
                <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-xs text-gray-500">Paiement sécurisé SSL 256-bit. Vos données ne sont jamais stockées.</p>
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between mb-5 px-1">
                <span className="text-sm text-gray-600">Total — Plan {plan.name}</span>
                <span className="font-extrabold text-gray-900 text-lg">{plan.price} MAD</span>
              </div>

              <Button
                onClick={handlePay}
                disabled={!detailsValid}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-50"
                style={{ boxShadow: detailsValid ? "0 4px 20px rgba(124,58,237,0.35)" : "none" }}
              >
                Payer {plan.price} MAD
              </Button>
            </motion.div>
          )}

          {/* ── Step 3: processing ── */}
          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 flex flex-col items-center text-center"
            >
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                </div>
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Traitement en cours...
              </h3>
              <p className="text-sm text-gray-500">Validation du paiement. Ne fermez pas cette fenêtre.</p>
              <div className="flex gap-1.5 mt-6">
                {[0,1,2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-purple-300"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 4: success ── */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 flex flex-col items-center text-center"
            >
              {/* Animated success circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 14, stiffness: 300, delay: 0.1 }}
                className="relative mb-6"
              >
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-10 h-10 text-green-600 stroke-[2.5]" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="absolute inset-0 rounded-full bg-green-100"
                />
              </motion.div>

              <PartyPopper className="w-8 h-8 text-amber-400 mb-3" />
              <h3 className="font-bold text-gray-900 text-xl mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Plan {plan.name} activé !
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-xs">
                Ton paiement a été confirmé. Tu peux maintenant accéder à toutes les fonctionnalités du plan {plan.name}.
              </p>

              {/* What's unlocked */}
              <div className="w-full bg-purple-50 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Ce qui est débloqué</p>
                <ul className="space-y-1.5">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 stroke-[2.5]" />
                      <span className="text-xs text-gray-700">{f}</span>
                    </li>
                  ))}
                  {plan.features.length > 4 && (
                    <li className="text-xs text-purple-500 font-medium pl-5">+{plan.features.length - 4} de plus…</li>
                  )}
                </ul>
              </div>

              <Button
                onClick={handleGoToDashboard}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
              >
                Aller à mon tableau de bord <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const currentPlan = getMyPlan();

  const canUpgrade = (planId: PlanId) => {
    const order: PlanId[] = ["free", "essentiel", "pro", "premium"];
    return order.indexOf(planId) > order.indexOf(currentPlan.planId);
  };

  return (
    <div className="min-h-screen bg-[#f9f8ff] flex flex-col">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
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
            className="text-center mb-16"
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

            {/* Current plan chip */}
            {currentPlan.planId !== "free" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-semibold px-4 py-2 rounded-full mt-4 border border-green-200"
              >
                <Check className="w-4 h-4" />
                Plan actuel : {currentPlan.planId.charAt(0).toUpperCase() + currentPlan.planId.slice(1)}
              </motion.div>
            )}
          </motion.div>

          {/* ── Plan cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => {
              const isCurrent = plan.id === currentPlan.planId;
              const upgradable = canUpgrade(plan.id);

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative bg-white rounded-2xl flex flex-col overflow-hidden transition-transform hover:-translate-y-1
                    ${plan.popular
                      ? "border-2 border-purple-500 shadow-[0_8px_40px_rgba(124,58,237,0.2)]"
                      : "border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"}
                  `}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <span className="bg-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                        Le plus populaire
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

                  {/* Body */}
                  <div className={`p-7 flex-1 ${plan.popular ? "pt-9" : ""}`}>
                    {/* Name + desc */}
                    <div className="mb-5">
                      <h2
                        className="text-xl font-bold text-gray-900 mb-1"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {plan.name}
                      </h2>
                      <p className="text-sm text-gray-500">{plan.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-7 flex items-end gap-1">
                      <span
                        className="text-5xl font-extrabold text-gray-900"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {plan.price}
                      </span>
                      <span className="text-xl font-semibold text-gray-400 mb-1">MAD</span>
                    </div>

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

                    {/* Locked features (if any) */}
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
                    ) : upgradable ? (
                      <Button
                        onClick={() => setSelectedPlan(plan)}
                        className={`w-full h-11 font-semibold rounded-xl text-sm transition-all
                          ${plan.popular
                            ? "bg-purple-600 hover:bg-purple-700 text-white shadow-[0_4px_16px_rgba(124,58,237,0.32)]"
                            : "border-2 border-purple-600 text-purple-600 hover:bg-purple-50 bg-white"
                          }
                        `}
                        variant={plan.popular ? "default" : "outline"}
                      >
                        Choisir {plan.name}
                      </Button>
                    ) : (
                      <Button
                        disabled
                        className="w-full h-11 rounded-xl text-sm border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                        variant="ghost"
                      >
                        Plan supérieur requis
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

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
              { q: "Est-ce vraiment un paiement unique ?", a: "Oui. Pas d'abonnement, pas de renouvellement automatique. Tu paies une fois et tu gardes l'accès pour ton rapport." },
              { q: "Puis-je changer de plan plus tard ?", a: "Oui, tu peux mettre à niveau n'importe quand. Tu ne paies que la différence entre les plans." },
              { q: "Quels modes de paiement sont acceptés ?", a: "Carte bancaire (CMI / Visa / Mastercard), Orange Money et CIH Pay. Plus de méthodes bientôt." },
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

      {/* ── Checkout modal ── */}
      <AnimatePresence>
        {selectedPlan && (
          <CheckoutModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
