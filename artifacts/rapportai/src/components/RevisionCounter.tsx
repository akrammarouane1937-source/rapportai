import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";

// Compact "X/15 révisions" badge, fed by the server's real daily count (/api/usage).
// Bump `refreshKey` after a revision completes to re-fetch.
export function RevisionCounter({ className = "", refreshKey = 0 }: { className?: string; refreshKey?: number }) {
  const [usage, setUsage] = useState<{ revisions: number; revisionLimit: number } | null>(null);

  useEffect(() => {
    let sid: string | null = null;
    try { sid = localStorage.getItem("rapportai_session"); } catch { /* ignore */ }
    fetch(`${API_BASE}/api/usage${sid ? `?sessionId=${encodeURIComponent(sid)}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.revisions === "number") setUsage(d); })
      .catch(() => {});
  }, [refreshKey]);

  if (!usage) return null;
  const reachedLimit = usage.revisions >= usage.revisionLimit;
  const low = usage.revisionLimit - usage.revisions <= 3;

  return (
    <span
      title="Révisions utilisées aujourd'hui — se réinitialise chaque jour"
      className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
        reachedLimit ? "bg-red-50 text-red-600" : low ? "bg-amber-50 text-amber-600" : "bg-purple-50 text-purple-600"
      } ${className}`}
    >
      {usage.revisions}/{usage.revisionLimit} révisions
    </span>
  );
}
