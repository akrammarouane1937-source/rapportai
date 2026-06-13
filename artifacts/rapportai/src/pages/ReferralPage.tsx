import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Copy, Check, Gift, Users, Wallet, Clock,
  AlertCircle, Loader2, ExternalLink, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { API_BASE } from "@/lib/apiBase";

interface ReferralData {
  referralCode:       string;
  referralLink:       string;
  balance:            number;  // USD cents (internal)
  balanceMad:         number;  // display in MAD
  isFoundingUser:     boolean;
  totalReferrals:     number;
  pendingReferrals:   number;
  completedReferrals: number;
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

  const { data, isLoading, error } = useQuery<ReferralData>({
    queryKey: ["referral-me", clerkId],
    enabled:  !!clerkId,
    queryFn:  async () => {
      const res = await fetch(`${API_BASE}/api/referral/me?clerkId=${clerkId}`);
      if (!res.ok) throw new Error("Impossible de charger les données de parrainage");
      return res.json() as Promise<ReferralData>;
    },
  });

  const link = data?.referralLink ?? "";
  const code = data?.referralCode ?? "";
  const { copied: linkCopied, copy: copyLink } = useCopy(link);
  const { copied: codeCopied, copy: copyCode } = useCopy(code);

  const balanceMad = data?.balanceMad ?? 0;

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
                Invite tes amis et gagne 100 MAD de crédit pour 2 amis qui finalisent leur rapport.
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
                    { icon: Wallet, label: "Crédit disponible", value: `${balanceMad} MAD`,             color: "text-green-600",  bg: "bg-green-50"  },
                    { icon: Users,  label: "Total parrainés",   value: String(data.totalReferrals),     color: "text-purple-600", bg: "bg-purple-50" },
                    { icon: Clock,  label: "En attente",        value: String(data.pendingReferrals),   color: "text-amber-600",  bg: "bg-amber-50"  },
                    { icon: Gift,   label: "Validés",           value: String(data.completedReferrals), color: "text-blue-600",   bg: "bg-blue-50"   },
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

                {/* Credit banner */}
                {balanceMad > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-4 flex items-center gap-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl px-5 py-4"
                  >
                    <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800">
                        Tu as {balanceMad} MAD de crédit
                      </p>
                      <p className="text-xs text-green-700">
                        Appliqué automatiquement sur ton prochain achat — rien à faire.
                      </p>
                    </div>
                  </motion.div>
                )}

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
                  className="bg-purple-50 rounded-2xl border border-purple-100 p-5"
                >
                  <h2 className="text-sm font-bold text-purple-800 mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Comment ça marche ?
                  </h2>
                  <div className="space-y-2">
                    {[
                      "Partage ton lien ou ton code avec un ami",
                      "Il s'inscrit et choisit le plan Essentiel ou Pro",
                      "Pour 2 amis, tu reçois 100 MAD de crédit",
                      "Ton crédit s'applique tout seul à ton prochain achat",
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
              </>
            )}

          </motion.div>
        </div>
      </main>
    </div>
  );
}
