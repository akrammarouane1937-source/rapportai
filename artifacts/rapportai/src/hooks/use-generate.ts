import { useState, useCallback } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useReportStore } from "@/lib/store";
import { useFileStore } from "@/lib/fileStore";

const SESSION_KEY = "rapportai_session";
const SESSION_TS_KEY = "rapportai_session_ts";
const SESSION_TTL = 45 * 60 * 1000;

interface ToolCall {
  name: string;
  status: "running" | "done";
}

const TOOL_LABELS: Record<string, string> = {
  Read: "📖 Lecture du rapport",
  WebSearch: "🔍 Recherche académique",
  WebFetch: "🔍 Recherche de sources",
  Write: "✍️ Rédaction en cours",
  Edit: "✏️ Révision en cours",
  Glob: "📂 Analyse des fichiers",
  Bash: "⚙️ Traitement",
};

function getToolLabel(name: string): string {
  if (name?.startsWith("pdf:")) return `📄 Lecture de ${name.slice(4)}`;
  if (name?.startsWith("image:")) return `🖼️ Analyse figure`;
  return TOOL_LABELS[name] || name;
}

async function getOrCreateSession(): Promise<string> {
  const stored = localStorage.getItem(SESSION_KEY);
  const ts = localStorage.getItem(SESSION_TS_KEY);

  if (stored && ts && Date.now() - Number(ts) < SESSION_TTL) {
    return stored;
  }

  // Clear stale session
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TS_KEY);

  // Build profile from store
  const report = useReportStore.getState().report;
  const profile = {
    studentName: report.studentName,
    school: report.school,
    filiere: report.filiere,
    reportType: report.reportType,
    theme: report.theme,
    annee: report.academicYear,
    encadrantPeda: report.encadrantPeda,
    encadrantPro: report.encadrantPro,
    entreprise: report.entreprise,
    motsCles: report.motsCles,
    existingSections: {
      ...(report.dedicaces     ? { dedicaces:     report.dedicaces }     : {}),
      ...(report.remerciements ? { remerciements: report.remerciements } : {}),
      ...(report.resumeFr      ? { resume:        report.resumeFr }      : {}),
      ...(report.introduction  ? { introduction:  report.introduction }  : {}),
      ...(report.partieI       ? { "partie-i":    report.partieI }       : {}),
      ...(report.partieII      ? { "partie-ii":   report.partieII }      : {}),
      ...(report.conclusion    ? { conclusion:    report.conclusion }    : {}),
    },
  };

  const res = await fetch(`${API_BASE}/api/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });

  if (!res.ok) throw new Error(`Session start failed: HTTP ${res.status}`);
  const { sessionId } = await res.json();
  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
  return sessionId;
}

export function useGenerate() {
  const [streamedContent, setStreamedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);

  const setContent = useCallback((val: string) => setStreamedContent(val), []);

  const generate = useCallback(
    async (
      section: string,
      reportData: Parameters<typeof useReportStore.getState>["length"] extends never ? never : ReturnType<typeof useReportStore.getState>["report"],
      extraPrompt?: string,
      files?: File[]
    ) => {
      setIsGenerating(true);
      setStreamedContent("");
      setToolCalls([]);
      setError(null);

      // Merge globally accumulated files with locally passed files
      const globalFiles = useFileStore.getState().files;
      const allFiles = [
        ...globalFiles,
        ...(files || []).filter(
          (f) => !globalFiles.some((gf) => gf.name === f.name && gf.size === f.size)
        ),
      ];

      let finalContent = "";

      try {
        const sessionId = await getOrCreateSession();

        let response: Response;

        if (allFiles.length > 0) {
          const form = new FormData();
          form.append("section", section);
          form.append("reportData", JSON.stringify(reportData));
          if (extraPrompt) form.append("prompt", extraPrompt);
          for (const file of allFiles) {
            form.append("files", file, file.name);
          }
          response = await fetch(`${API_BASE}/api/session/${sessionId}/generate`, {
            method: "POST",
            body: form,
          });
        } else {
          response = await fetch(`${API_BASE}/api/session/${sessionId}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              section,
              ...reportData,
              prompt: extraPrompt,
            }),
          });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("Pas de réponse du serveur");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (!part.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(part.slice(6));
                if (data.error) throw new Error(data.error);
                if (data.content) {
                  finalContent += data.content;
                  setStreamedContent((prev) => prev + data.content);
                }
                if (data.updatedContent) {
                  finalContent = data.updatedContent;
                  setStreamedContent(data.updatedContent);
                }
                if (data.tool_call) {
                  const label = getToolLabel(data.tool_call.name ?? data.tool_call);
                  const status: "running" | "done" = data.tool_call.status ?? "running";
                  setToolCalls((prev) => {
                    const idx = prev.findIndex((tc) => tc.name === label);
                    const entry = { name: label, status };
                    if (idx !== -1) {
                      const updated = [...prev];
                      updated[idx] = entry;
                      return updated;
                    }
                    return [...prev, entry];
                  });
                }
                if (data.done) done = true;
              } catch (parseErr) {
                if (parseErr instanceof Error && parseErr.message !== "JSON parse") {
                  throw parseErr;
                }
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        console.error("Generation failed:", err);
      } finally {
        setIsGenerating(false);
      }

      return finalContent;
    },
    []
  );

  return { generate, isGenerating, toolCalls, streamedContent, setContent, error };
}
