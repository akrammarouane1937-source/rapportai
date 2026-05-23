import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Copy, Check, Gift, Users, DollarSign, Clock,
  ArrowDownToLine, AlertCircle, Loader2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { API_BASE } from "@/lib/apiBase";

interface ReferralData {
  referralCode:       string;
  referralLink:       string;
  balance:            number;
  balanceUsd:         string;
  isFoundingUser:     boolean;
  totalReferrals:     number;
  pendingReferrals:   number;
  completedReferrals: number;
}

interface WithdrawForm {
  method:        "paypal" | "stripe";
  payoutDetails: string;
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
}

export default function ReferralPage() {
  const { user } = useUser();
  const clerkId = user?.id;

  const [withdrawOpen, setWithdrawOpen]   = useState(false);
  const [withdrawForm, setWithdrawForm]   = useState<WithdrawForm>({ method: "paypal", payoutDetails: "" });
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ReferralData>({
    queryKey: ["referral-me", clerkId],
    enabled:  !!clerkId,
    queryFn:  async () => {
      const res = await fetch(`${API_BASE}/api/referral/me?clerkId=${clerkId}`);
      if (!res.ok) throw new Error("Impossible de charger les données de parrainage");
      return res.json() as Promise<ReferralData>;
    },
  });

  const withdraw = useMutation({
    mutationFn: async (form: WithdrawForm) => {
      const res = await fetch(`${API_BASE}/api/referral/withdraw`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ clerkId, ...form }),
      });
      const json = await res.json() as { success?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erreur lors du retrait");
      return json;
    },
    onSuccess: (json) => {
      setWithdrawSuccess(json.message ?? "Retrait demandé avec succès");
      setWithdrawOpen(false);
      setWithdrawForm({ method: "paypal", payoutDetails: "" });
    },
  });

  const link = data?.referralLink ?? "";
  const code = data?.referralCode ?? "";
  const { copied: linkCopied, copy: copyLink } = useCopy(link);
  const { copied: codeCopied, copy: copyCode } = useCopy(code);

  const availableUsd = data
    ? parseFloat(data.balanceUsd)
    : 0;
  const canWithdraw = availableUsd >= 10;

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />
      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Header */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Parrainage
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Invite tes amis — gagne 10 $ pour chaque 2 utilisateurs qui complètent leur rapport.
              </p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {(error as Error).message}
              </div>
            )}

            {data && (
              <>
                {/* Founding user badge */}
                {data.isFoundingUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3"
                  >
                    <span className="text-xl">🏆</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Utilisateur fondateur</p>
                      <p className="text-xs text-amber-600">Tu fais partie des 20 premiers utilisateurs de RapportAI. Merci !</p>
                    </div>
                  </motion.div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { icon: DollarSign, label: "Solde disponible", value: `$${data.balanceUsd}`, color: "text-green-600", bg: "bg-green-50" },
                    { icon: Users,      label: "Total parrainés",  value: String(data.totalReferrals),     color: "text-purple-600", bg: "bg-purple-50" },
                    { icon: Clock,      label: "En attente",       value: String(data.pendingReferrals),   color: "text-amber-600",  bg: "bg-amber-50"  },
                    { icon: Gift,       label: "Complétés",        value: String(data.completedReferrals), color: "text-blue-600",   bg: "bg-blue-50"   },
                  ].map(({ icon: Icon, label, value, color, bg }, i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="bg-white rounded-2xl border border-gray-100 p-4"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                    >
                      <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mb-2`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div className="text-xl font-bold text-gray-900">{value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Share section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-2xl border border-gray-100 p-6 mb-4"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                >
                  <h2 className="text-sm font-bold text-gray-800 mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Ton lien de parrainage
                  </h2>

                  {/* Link */}
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 overflow-hidden">
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{link}</span>
                    </div>
                    <Button
                      onClick={copyLink}
                      variant="outline"
                      className="h-10 px-4 rounded-xl border-gray-200 text-sm font-medium"
                    >
                      {linkCopied ? <><Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />Copié</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copier</>}
                    </Button>
                  </div>

                  {/* Code */}
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-400">Code :</div>
                    <div
                      onClick={copyCode}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors"
                    >
                      <span className="text-sm font-mono font-bold text-purple-700 tracking-widest">{code}</span>
                      {codeCopied
                        ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        : <Copy className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      }
                    </div>
                  </div>
                </motion.div>

                {/* How it works */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 }}
                  className="bg-purple-50 rounded-2xl border border-purple-100 p-5 mb-4"
                >
                  <h2 className="text-sm font-bold text-purple-800 mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Comment ça marche ?
                  </h2>
                  <div className="space-y-2">
                    {[
                      "Partage ton lien ou code avec un ami",
                      "Il s'inscrit et génère son rapport",
                      "Tu reçois 10 $ dès que 2 amis complètent leur rapport",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-purple-700">
                        <div className="w-5 h-5 bg-purple-200 rounded-full flex items-center justify-center text-[11px] font-bold text-purple-700 flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        {step}
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Withdraw */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.34 }}
                  className="bg-white rounded-2xl border border-gray-100 p-6"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Retirer mes gains
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {canWithdraw
                          ? `${data.balanceUsd} $ disponibles — minimum 10 $`
                          : `Minimum 10 $ requis (actuellement ${data.balanceUsd} $)`
                        }
                      </p>
                    </div>
                    <Button
                      onClick={() => setWithdrawOpen(true)}
                      disabled={!canWithdraw}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm"
                      style={{ boxShadow: canWithdraw ? "0 4px 16px rgba(124,58,237,0.25)" : "none" }}
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      Retirer
                    </Button>
                  </div>

                  {withdrawSuccess && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      {withdrawSuccess}
                    </div>
                  )}
                </motion.div>
              </>
            )}

          </motion.div>
        </div>
      </main>

      {/* Withdraw modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Demander un retrait
            </h3>
            <p className="text-sm text-gray-500 mb-5">Traitement sous 48h ouvrées.</p>

            {/* Method */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Méthode</label>
              <div className="flex gap-2">
                {(["paypal", "stripe"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setWithdrawForm(f => ({ ...f, method: m }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                      withdrawForm.method === m
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {m === "paypal" ? "PayPal" : "Stripe / Carte"}
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {withdrawForm.method === "paypal" ? "Email PayPal" : "Email Stripe / IBAN"}
              </label>
              <Input
                value={withdrawForm.payoutDetails}
                onChange={(e) => setWithdrawForm(f => ({ ...f, payoutDetails: e.target.value }))}
                placeholder={withdrawForm.method === "paypal" ? "ton@email.com" : "ton@email.com ou IBAN"}
                className="h-10 rounded-xl border-gray-200 text-sm"
              />
            </div>

            {withdraw.error && (
              <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {(withdraw.error as Error).message}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setWithdrawOpen(false); withdraw.reset(); }}
                className="flex-1 rounded-xl border-gray-200"
                disabled={withdraw.isPending}
              >
                Annuler
              </Button>
              <Button
                onClick={() => withdraw.mutate(withdrawForm)}
                disabled={!withdrawForm.payoutDetails.trim() || withdraw.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                style={{ boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}
              >
                {withdraw.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Envoi…</>
                  : "Confirmer le retrait"
                }
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
