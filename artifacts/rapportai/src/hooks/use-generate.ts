import { useState, useCallback, useRef } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useReportStore } from "@/lib/store";
import { useFileStore } from "@/lib/fileStore";

const SESSION_KEY = "rapportai_session";
const SESSION_TS_KEY = "rapportai_session_ts";
const SESSION_TTL = 45 * 60 * 1000;

export interface ToolCall {
  id: string;
  name: string;
  detail?: string;
  done: boolean;
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

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TS_KEY);

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
  const [thinkingText, setThinkingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // AbortController ref — enables stop button (Replit pattern)
  const abortRef = useRef<AbortController | null>(null);

  const setContent = useCallback((val: string) => setStreamedContent(val), []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const generate = useCallback(
    async (
      section: string,
      reportData: Parameters<typeof useReportStore.getState>["length"] extends never ? never : ReturnType<typeof useReportStore.getState>["report"],
      extraPrompt?: string,
      files?: File[]
    ) => {
      // Cancel any in-flight request (Replit pattern)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setStreamedContent("");
      setToolCalls([]);
      setThinkingText("");
      setError(null);

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

        const makeRequest = (sid: string) => {
          if (allFiles.length > 0) {
            const form = new FormData();
            form.append("section", section);
            form.append("reportData", JSON.stringify(reportData));
            if (extraPrompt) form.append("prompt", extraPrompt);
            for (const file of allFiles) form.append("files", file, file.name);
            return fetch(`${API_BASE}/api/session/${sid}/generate`, {
              method: "POST",
              body: form,
              signal: controller.signal,
            });
          }
          return fetch(`${API_BASE}/api/session/${sid}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section, ...reportData, prompt: extraPrompt }),
            signal: controller.signal,
          });
        };

        let response = await makeRequest(sessionId);

        if (response.status === 404) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(SESSION_TS_KEY);
          const newId = await getOrCreateSession();
          response = await makeRequest(newId);
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("Pas de réponse du serveur");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          // Replit pattern: split on \n, check each line for "data: " prefix
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (data.error) {
              throw new Error(data.error as string);
            }

            if (data.thinking) {
              // Append thinking text (Replit pattern: newline-separated)
              setThinkingText((prev) =>
                prev ? `${prev}\n${data.thinking as string}` : (data.thinking as string)
              );
            }

            if (data.tool_call) {
              const rawName = typeof data.tool_call === "string"
                ? data.tool_call
                : ((data.tool_call as Record<string, unknown>).name as string ?? "");
              const label = getToolLabel(rawName);
              const detail = typeof data.tool_call === "object"
                ? ((data.tool_call as Record<string, unknown>).detail as string | undefined)
                : undefined;
              // Unique ID per tool call (Replit pattern — fixes React key issues)
              const id = `${rawName}-${Date.now()}`;
              setToolCalls((prev) => [
                ...prev.map((t) => ({ ...t, done: true })),
                { id, name: label, detail, done: false },
              ]);
            }

            if (data.content) {
              setToolCalls((prev) => prev.map((t) => ({ ...t, done: true })));
              finalContent += data.content as string;
              setStreamedContent((prev) => prev + (data.content as string));
            }

            if (data.updatedContent) {
              setToolCalls((prev) => prev.map((t) => ({ ...t, done: true })));
              finalContent = data.updatedContent as string;
              setStreamedContent(data.updatedContent as string);
            }

            if (data.done) {
              setToolCalls((prev) => prev.map((t) => ({ ...t, done: true })));
              // Extract from disk-written sections (works for both complete and partial)
              const sectionContent = (data.sections as Record<string, string> | undefined)?.[section];
              if (sectionContent) {
                finalContent = sectionContent;
                setStreamedContent(sectionContent);
              }
              if (data.partial && !sectionContent) {
                setError("Génération partielle — contenu tronqué. Demande une révision pour compléter.");
              }
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return finalContent;
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

  return { generate, abort, isGenerating, toolCalls, streamedContent, thinkingText, setContent, error };
}
