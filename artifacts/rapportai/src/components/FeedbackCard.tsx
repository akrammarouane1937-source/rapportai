import { useState } from "react";
import { MessageSquarePlus, Loader2, CheckCircle2 } from "lucide-react";
import { useOptionalUser } from "@/lib/useOptionalClerk";
import { API_BASE } from "@/lib/apiBase";

// "Aide-nous à améliorer RapportAI" — students share what they want / their opinion.
// Submissions are emailed to the admin inbox via /api/feedback.
export function FeedbackCard() {
  const { user } = useOptionalUser();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    const text = message.trim();
    if (!text || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          name: user?.fullName ?? user?.firstName ?? undefined,
          email: user?.primaryEmailAddress?.emailAddress ?? undefined,
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-700 font-medium">Merci ! Ton avis nous aide à améliorer RapportAI.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-5">
      <div className="flex items-center gap-2 mb-1.5">
        <MessageSquarePlus className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-bold text-gray-900">Aide-nous à améliorer RapportAI</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Qu'est-ce que tu aimerais voir ? Un bug, une idée, ton opinion — dis-nous tout.
      </p>
      <textarea
        value={message}
        onChange={(e) => { setMessage(e.target.value); if (status === "error") setStatus("idle"); }}
        rows={3}
        maxLength={5000}
        placeholder="Ton message…"
        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        {status === "error"
          ? <span className="text-xs text-red-500">Erreur, réessaie.</span>
          : <span />}
        <button
          onClick={submit}
          disabled={!message.trim() || status === "sending"}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {status === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
          Envoyer
        </button>
      </div>
    </div>
  );
}
