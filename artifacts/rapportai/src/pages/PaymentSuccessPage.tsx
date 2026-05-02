import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, ArrowRight } from "lucide-react";
import { saveMyPlan, type PlanId } from "@/lib/userPlan";

const BASE_PATH = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

export default function PaymentSuccessPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [planId, setPlanId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      return;
    }

    fetch(`${BASE_PATH}/api/stripe/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data: { paid: boolean; planId: string; email: string | null; error?: string }) => {
        if (data.error || !data.paid || !data.planId) {
          setStatus("error");
          return;
        }
        saveMyPlan({ planId: data.planId as PlanId, purchasedAt: Date.now() });
        setPlanId(data.planId);
        setEmail(data.email);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, []);

  const PLAN_LABELS: Record<string, string> = {
    essentiel: "Essentiel",
    pro: "Pro",
    premium: "Premium",
  };

  return (
    <div className="min-h-screen bg-[#f9f8ff] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl border border-gray-100 w-full max-w-md p-10 text-center"
        style={{ boxShadow: "0 32px 80px rgba(124,58,237,0.12), 0 4px 24px rgba(0,0,0,0.06)" }}
      >
        {/* Loading */}
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-black text-gray-900 mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Vérification du paiement…
            </h2>
            <p className="text-sm text-gray-400">Un instant, nous confirmons ta commande avec Stripe.</p>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </motion.div>

            <h2 className="text-2xl font-black text-gray-900 mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Paiement confirmé !
            </h2>
            <p className="text-gray-500 text-sm mb-1">
              Bienvenue dans le plan{" "}
              <span className="font-bold text-purple-600">{PLAN_LABELS[planId ?? ""] ?? planId}</span>
            </p>
            {email && (
              <p className="text-xs text-gray-400 mb-6">Reçu envoyé à {email}</p>
            )}

            <div className="bg-purple-50 rounded-2xl p-4 mb-8 text-left">
              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Ce que tu débloque</p>
              {planId === "essentiel" && (
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>✓ 30 pages générées par IA</li>
                  <li>✓ Export Word + PDF</li>
                  <li>✓ 10 révisions IA</li>
                  <li>✓ Bibliothèque de sources</li>
                </ul>
              )}
              {planId === "pro" && (
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>✓ 60 pages générées par IA</li>
                  <li>✓ Export Word + PDF</li>
                  <li>✓ Révisions illimitées</li>
                  <li>✓ JuryAI — simulation de soutenance</li>
                  <li>✓ Vérification anti-plagiat</li>
                  <li>✓ Certificat Anti-Détection IA</li>
                </ul>
              )}
              {planId === "premium" && (
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>✓ Pages illimitées</li>
                  <li>✓ Tout le plan Pro inclus</li>
                  <li>✓ Slides PowerPoint</li>
                  <li>✓ Support prioritaire</li>
                </ul>
              )}
            </div>

            <button
              onClick={() => setLocation("/dashboard")}
              className="w-full h-12 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Aller à mon tableau de bord <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Paiement non confirmé
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Nous n'avons pas pu vérifier ton paiement. Si tu as été débité, contacte-nous.
            </p>
            <button
              onClick={() => setLocation("/pricing")}
              className="w-full h-11 rounded-xl font-bold text-sm border-2 border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
            >
              Retour aux plans
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
