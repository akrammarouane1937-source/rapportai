import { useState } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { useOptionalUser } from "@/lib/useOptionalClerk";
import { getReport } from "@/lib/reportStore";
import { API_BASE } from "@/lib/apiBase";

// "Laisse un avis" — collects a star rating + text. Emailed to the admin (tagged
// ⭐ Avis) so you can curate and add the best ones to the landing testimonials.
export function ReviewCard({ compact = false }: { compact?: boolean }) {
  const { user } = useOptionalUser();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    const text = message.trim();
    if (!rating || !text || status === "sending") return;
    setStatus("sending");
    try {
      const report = getReport() as Record<string, string>;
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "review",
          rating,
          message: text,
          name: user?.fullName ?? user?.firstName ?? undefined,
          email: user?.primaryEmailAddress?.emailAddress ?? undefined,
          school: report.school || undefined,
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800 font-medium">Merci pour ton avis ! 🙏</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">
        ⭐ Ton avis aide d'autres étudiants
      </h3>
      {!compact && (
        <p className="text-xs text-gray-500 mb-3">
          Qu'as-tu pensé de RapportAI ? Ton avis sera peut-être affiché (avec ton prénom + école).
        </p>
      )}
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
            aria-label={`${n} étoiles`}
          >
            <Star
              className="w-6 h-6 transition-colors"
              style={{
                fill: n <= (hover || rating) ? "#f59e0b" : "transparent",
                color: "#f59e0b",
              }}
            />
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => { setMessage(e.target.value); if (status === "error") setStatus("idle"); }}
        rows={3}
        maxLength={1000}
        placeholder="Ton avis…"
        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        {status === "error"
          ? <span className="text-xs text-red-500">Erreur, réessaie.</span>
          : <span />}
        <button
          onClick={submit}
          disabled={!rating || !message.trim() || status === "sending"}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {status === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
          Envoyer mon avis
        </button>
      </div>
    </div>
  );
}
