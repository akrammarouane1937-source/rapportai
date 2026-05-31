import { useEffect, useRef } from "react";
import { useOptionalUser } from "@/lib/useOptionalClerk";
import { useReportStore } from "@/lib/store";
import type { Report } from "@/lib/store";
import { hydrateRawFromZustand } from "@/lib/reportStore";
import { API_BASE } from "@/lib/apiBase";

// Count how many generated section fields are non-empty in a report snapshot.
// Used to decide whether server data is richer than local data.
const SECTION_FIELDS: (keyof Report)[] = [
  "introduction", "partieI", "partieII", "conclusion",
  "dedicaces", "remerciements", "resumeFr", "sommaire",
  "bibliographieText", "pageDeGarde",
];

function countFilledSections(r: Partial<Report>): number {
  return SECTION_FIELDS.filter((f) => !!(r[f] as string | undefined)?.trim()).length;
}

function shouldHydrateFromServer(server: Partial<Report>, local: Report): boolean {
  // Always load if local is completely empty (new device / cleared browser)
  if (countFilledSections(local) === 0) return true;
  // Load if server has more generated sections than what's local
  if (countFilledSections(server) > countFilledSections(local)) return true;
  // Load if server is at a higher step (user progressed on another device)
  if ((server.currentStep ?? 0) > (local.currentStep ?? 0)) return true;
  return false;
}

export function useReportSync() {
  const { user, isLoaded } = useOptionalUser();
  const { report, updateReport } = useReportStore();
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSaved = useRef<string>("");

  // On login: fetch from DB and hydrate both stores if server data is richer
  useEffect(() => {
    if (!isLoaded || !user || initialized.current) return;
    initialized.current = true;

    fetch(`${API_BASE}/api/me/report`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { reportData: string | null } | null) => {
        if (!data?.reportData) return;
        try {
          const serverReport = JSON.parse(data.reportData) as Partial<Report>;
          if (shouldHydrateFromServer(serverReport, report)) {
            // Hydrate Zustand (reactive UI: ReportToc, RapportsPage, …)
            updateReport(serverReport as Parameters<typeof updateReport>[0]);
            // Hydrate raw localStorage (generation pages that call getReport())
            hydrateRawFromZustand(serverReport);
          }
        } catch {
          // corrupt JSON — ignore
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  // On Zustand change: debounce-save to DB (2 s)
  useEffect(() => {
    if (!user) return;
    const serialized = JSON.stringify(report);
    if (serialized === lastSaved.current) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lastSaved.current = serialized;
      fetch(`${API_BASE}/api/me/report`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportData: serialized }),
      }).catch(() => {});
    }, 2000);

    return () => clearTimeout(saveTimer.current);
  }, [report, user]);
}
