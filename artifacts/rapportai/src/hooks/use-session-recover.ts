import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useReportStore } from "@/lib/store";

const SESSION_KEY    = "rapportai_session";
const SESSION_TS_KEY = "rapportai_session_ts";
const SESSION_TTL    = 4 * 60 * 60 * 1000;

const SECTION_STORE_MAP: Record<string, keyof ReturnType<typeof useReportStore.getState>["report"]> = {
  "dedicaces":    "dedicaces",
  "remerciements":"remerciements",
  "resume":       "resumeFr",
  "sommaire":     "sommaire",
  "introduction": "introduction",
  "partie-i":     "partieI",
  "partie-ii":    "partieII",
  "conclusion":   "conclusion",
  "page-de-garde":"pageDeGarde",
};

/**
 * On mount, checks the server for sections that were written to disk but
 * are missing from the local Zustand store (e.g. generated while tab was closed).
 * Silently merges them in — no UI disruption.
 */
export function useSessionRecover() {
  const { report, updateReport } = useReportStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const sessionId = localStorage.getItem(SESSION_KEY);
    const ts        = localStorage.getItem(SESSION_TS_KEY);
    if (!sessionId || !ts || Date.now() - Number(ts) >= SESSION_TTL) return;

    fetch(`${API_BASE}/api/session/${sessionId}/state`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { sections?: Record<string, string> } | null) => {
        if (!data?.sections) return;

        const patch: Partial<typeof report> = {};
        for (const [sectionId, storeKey] of Object.entries(SECTION_STORE_MAP)) {
          const serverContent = data.sections[sectionId];
          const localContent  = report[storeKey] as string | undefined;
          // Only update if server has content and local is empty
          if (serverContent && serverContent.length > 50 && (!localContent || localContent.length < 50)) {
            (patch as Record<string, string>)[storeKey as string] = serverContent;
          }
        }

        if (Object.keys(patch).length > 0) {
          updateReport(patch);
        }
      })
      .catch(() => { /* silent — recovery is best-effort */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
