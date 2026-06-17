import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useReportStore } from "@/lib/store";
import { ReviewCard } from "./ReviewCard";

// Pops once, after Partie I is generated (a big milestone / happy moment), to ask
// for a review. Shown a single time per browser via a localStorage flag.
const SHOWN_KEY = "rapportai_review_prompt_shown";

export function ReviewPromptModal() {
  const report = useReportStore((s) => s.report);
  const [open, setOpen] = useState(false);

  const hasPartieI = !!(report as Record<string, string> | undefined)?.partieI?.trim();

  useEffect(() => {
    if (!hasPartieI) return;
    try { if (localStorage.getItem(SHOWN_KEY)) return; } catch { /* ignore */ }
    const t = setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem(SHOWN_KEY, "1"); } catch { /* ignore */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [hasPartieI]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Ta Partie I est prête 🎉</h2>
        <p className="text-sm text-gray-500 mb-4">
          Comment s'est passée la génération ? Ton avis nous aide énormément à améliorer RapportAI.
        </p>
        <ReviewCard compact />
      </div>
    </div>
  );
}
