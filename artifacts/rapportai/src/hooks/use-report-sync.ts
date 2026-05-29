import { useEffect, useRef } from "react";
import { useOptionalUser } from "@/lib/useOptionalClerk";
import { useReportStore } from "@/lib/store";
import { API_BASE } from "@/lib/apiBase";

export function useReportSync() {
  const { user, isLoaded } = useOptionalUser();
  const { report, updateReport } = useReportStore();
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSaved = useRef<string>("");

  useEffect(() => {
    if (!isLoaded || !user || initialized.current) return;
    initialized.current = true;

    fetch(`${API_BASE}/api/me/report`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { reportData: string | null } | null) => {
        if (!data?.reportData) return;
        try {
          const serverReport = JSON.parse(data.reportData) as { currentStep?: number };
          if ((serverReport.currentStep ?? 0) > (report.currentStep ?? 0)) {
            updateReport(serverReport as Parameters<typeof updateReport>[0]);
          }
        } catch {
          // corrupt JSON — ignore
        }
      })
      .catch(() => {});
  }, [isLoaded, user]);

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
