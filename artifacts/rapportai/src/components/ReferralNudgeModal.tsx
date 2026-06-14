import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { API_BASE } from "@/lib/apiBase";

const SEEN_KEY = "rapportai_referral_nudge_seen";

interface MeResponse {
  referralCode: string;
  referralLink: string;
}

/**
 * One-time warm "invite your friends" screen, shown once per user on the
 * dashboard. Friendly framing — not affiliate-y. Self-contained: manages its
 * own open state, fetch, and the seen-flag.
 */
export function ReferralNudgeModal() {
  const { user } = useUser();
  const [open, setOpen]   = useState(false);
  const [data, setData]   = useState<MeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { /* ignore */ }
    if (seen) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/referral/me?clerkId=${user.id}`);
        if (!res.ok) return; // not registered yet → skip silently, try next time
        const json = await res.json() as MeResponse;
        if (!cancelled) {
          setData(json);
          setOpen(true);
          // Mark seen on display so it appears exactly once (it stays available
          // permanently in the sidebar under "Parrainage").
          try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
        }
      } catch { /* network — skip, no flag set so it retries next visit */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const copy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const share = () => {
    if (!data) return;
    const text = "Je rédige mon rapport avec RapportAI — rejoins-moi 👇";
    if (navigator.share) {
      void navigator.share({ title: "RapportAI", text, url: data.referralLink });
    } else {
      copy();
    }
  };

  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ background: "rgba(15,10,30,0.45)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden text-center"
            style={{ boxShadow: "0 24px 80px rgba(124,58,237,0.22)" }}
          >
            <div className="px-8 pt-9 pb-7">
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <Gift className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Rédige ton rapport avec tes amis
              </h2>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Partage RapportAI à un ami qui galère sur son rapport. Quand il finalise le sien,
                tu reçois <span className="font-semibold text-gray-700">100 MAD de crédit</span> pour 2 amis.
              </p>

              {/* Link */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1 flex items-center px-3 h-11 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 overflow-hidden">
                  <span className="truncate">{data.referralLink}</span>
                </div>
                <Button
                  onClick={copy}
                  variant="outline"
                  className="h-11 px-4 rounded-xl border-gray-200 text-sm font-medium"
                >
                  {copied ? <><Check className="w-4 h-4 mr-1.5 text-green-500" />Copié</> : <><Copy className="w-4 h-4 mr-1.5" />Copier</>}
                </Button>
              </div>

              {/* Share */}
              <Button
                onClick={share}
                className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold flex items-center justify-center gap-2 mb-2"
                style={{ boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}
              >
                <Share2 className="w-4 h-4" />
                Partager avec un ami
              </Button>

              <button
                onClick={dismiss}
                className="w-full h-10 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Plus tard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
