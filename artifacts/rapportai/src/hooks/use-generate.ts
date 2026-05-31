import { useState, useCallback, useRef } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useReportStore } from "@/lib/store";
import { useFileStore } from "@/lib/fileStore";
import { getMyPlan } from "@/lib/userPlan";
import { useUserSettingsStore } from "@/lib/userSettingsStore";

const SESSION_KEY = "rapportai_session";
const SESSION_TS_KEY = "rapportai_session_ts";
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours — matches server-side session TTL

export interface ToolCall {
  id: string;
  name: string;
  detail?: string;
  done: boolean;
}

export interface UploadCallbacks {
  onUploadProgress?: (pct: number) => void;
  onUploadDone?: () => void;
  onError?: (friendlyMessage: string) => void;
}

function friendlyUploadError(msg: string): string {
  if (/HTTP 413|payload.too.large|trop.volumineux/i.test(msg))
    return "Fichier trop volumineux pour le serveur (max 10 Mo)";
  if (/HTTP 415|unsupported.media|format.*support/i.test(msg))
    return "Format non supporté par le serveur";
  if (/HTTP 429|rate.limit/i.test(msg))
    return "Trop de requêtes, réessaie dans quelques secondes";
  if (/HTTP 50[234]|service.unavailable|gateway/i.test(msg))
    return "Serveur temporairement indisponible, réessaie";
  if (/réseau|network|fetch|XMLHttp/i.test(msg))
    return "Erreur réseau, vérifie ta connexion";
  if (/timeout|délai/i.test(msg))
    return "Délai dépassé, réessaie";
  return msg.length > 100 ? msg.slice(0, 100) + "…" : msg;
}

const TOOL_LABELS: Record<string, string> = {
  Read: "Lecture du rapport",
  WebSearch: "Recherche académique",
  WebFetch: "Recherche de sources",
  Write: "Rédaction en cours",
  Edit: "Révision en cours",
  Glob: "Analyse des fichiers",
  Bash: "Traitement",
};

function getToolLabel(name: string): string {
  if (name?.startsWith("pdf:")) return `Lecture de ${name.slice(4)}`;
  if (name?.startsWith("image:")) return `Analyse figure`;
  return TOOL_LABELS[name] || name;
}

function cleanDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const basename = detail.split(/[/\\]/).pop() ?? detail;
  const cleaned = basename.replace(/['"]/g, "").trim();
  if (!cleaned) return undefined;
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned;
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
    problematique: report.problematique || undefined,
    encadrantPeda: report.encadrantPeda,
    encadrantPro: report.encadrantPro,
    entreprise: report.entreprise,
    motsCles: report.motsCles,
    formatting: useUserSettingsStore.getState().formatting,
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

function xhrUpload(
  url: string,
  body: FormData,
  headers: Record<string, string>,
  signal: AbortSignal,
  callbacks: UploadCallbacks,
  onSSELine: (line: string) => void
): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processed = 0;
    let buf = "";
    let uploadSettled = false;
    let sseError: Error | null = null;

    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }

    const settleUpload = (pct: number) => {
      if (uploadSettled) return;
      callbacks.onUploadProgress?.(pct);
      if (pct >= 100) {
        uploadSettled = true;
        callbacks.onUploadDone?.();
      }
    };

    // Wrap onSSELine so throws inside processLine propagate via Promise rejection
    const safeLine = (line: string) => {
      if (sseError) return;
      try {
        onSSELine(line);
      } catch (e) {
        sseError = e instanceof Error ? e : new Error(String(e));
      }
    };

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        settleUpload(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.upload.addEventListener("load", () => settleUpload(100));

    const flushBuffer = () => {
      const newText = xhr.responseText.slice(processed);
      processed = xhr.responseText.length;
      buf += newText;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) safeLine(line);
    };

    xhr.addEventListener("progress", () => {
      if (xhr.status >= 200 && xhr.status < 300) flushBuffer();
    });

    xhr.addEventListener("load", () => {
      flushBuffer();
      if (buf.trim()) { safeLine(buf); buf = ""; }
      if (sseError) reject(sseError);
      else resolve({ status: xhr.status });
    });

    xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
    xhr.addEventListener("abort", () => {
      const err = new Error("AbortError");
      err.name = "AbortError";
      reject(err);
    });

    signal.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
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
      files?: File[],
      figures?: { figureNumber: number; title: string; source: string; author: string; caption: string; placement: string }[],
      uploadCallbacks?: UploadCallbacks
    ) => {
      // Cancel any in-flight request (Replit pattern)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setStreamedContent("");
      setToolCalls([{ id: "init-placeholder", name: "⚙️ Initialisation…", done: false }]);
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

        const planData = getMyPlan();
        const planHeaders: Record<string, string> = {
          "x-plan-id":            planData.planId,
          "x-pages-generated":    String(planData.pagesGenerated ?? 0),
          "x-revision-count":     String(planData.revisionCount ?? 0),
        };
        const formatting = useUserSettingsStore.getState().formatting;

        // ── Shared SSE line processor ──────────────────────────────────────────
        const processLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const raw = line.slice(6).trim();
          if (!raw) return;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return;
          }

          if (data.error) {
            throw new Error(data.error as string);
          }

          if (data.thinking) {
            setThinkingText((prev) =>
              prev ? `${prev}\n${data.thinking as string}` : (data.thinking as string)
            );
          }

          if (data.phase) {
            const phase = data.phase as string;
            if (phase === "retrying") {
              const attempt = data.attempt as number | undefined;
              const errors = data.errors as string[] | undefined;
              const detail = errors ? errors[0] : undefined;
              const id = `retry-${Date.now()}`;
              setToolCalls((prev) => [
                ...prev.map((t) => ({ ...t, done: true })),
                { id, name: `Amélioration en cours${attempt ? ` (${attempt}/2)` : ""}`, detail, done: false },
              ]);
            } else if (phase === "humanizing") {
              const id = `humanize-${Date.now()}`;
              setToolCalls((prev) => [
                ...prev.map((t) => ({ ...t, done: true })),
                { id, name: "Humanisation du style académique", done: false },
              ]);
            }
          }

          if (data.tool_call) {
            const rawName = typeof data.tool_call === "string"
              ? data.tool_call
              : ((data.tool_call as Record<string, unknown>).name as string ?? "");
            const label = getToolLabel(rawName);
            const rawDetail = typeof data.tool_call === "object"
              ? ((data.tool_call as Record<string, unknown>).detail as string | undefined)
              : undefined;
            const detail = cleanDetail(rawDetail);
            const id = `${rawName}-${Date.now()}`;
            setToolCalls((prev) => [
              ...prev.map((t) => ({ ...t, done: true })),
              { id, name: label, detail, done: false },
            ]);
          }

          if (data.content_chunk) {
            setToolCalls((prev) => prev.map((t) => ({ ...t, done: true })));
            finalContent += data.content_chunk as string;
            setStreamedContent((prev) => prev + (data.content_chunk as string));
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
            const sectionContent = (data.sections as Record<string, string> | undefined)?.[section];
            if (sectionContent) {
              finalContent = sectionContent;
              setStreamedContent(sectionContent);
            }
            if (data.partial && !sectionContent) {
              setError("Génération partielle — contenu tronqué. Demande une révision pour compléter.");
            }
          }
        };

        // ── Request — XHR (with upload progress) when files present, fetch otherwise ──
        if (allFiles.length > 0) {
          const form = new FormData();
          form.append("section", section);
          form.append("reportData", JSON.stringify(reportData));
          if (extraPrompt) form.append("extraContext", extraPrompt);
          form.append("formatting", JSON.stringify(formatting));
          if (figures && figures.length > 0) form.append("figures", JSON.stringify(figures));
          for (const file of allFiles) form.append("files", file, file.name);

          const doXHR = async (sid: string, withCallbacks: boolean) => {
            const url = `${API_BASE}/api/session/${sid}/generate`;
            const cbks: UploadCallbacks = withCallbacks ? (uploadCallbacks ?? {}) : {};
            return xhrUpload(url, form, planHeaders, controller.signal, cbks, processLine);
          };

          let result = await doXHR(sessionId, true);

          if (result.status === 404) {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_TS_KEY);
            const newId = await getOrCreateSession();
            result = await doXHR(newId, false);
          }

          if (result.status < 200 || result.status >= 300) {
            throw new Error(`HTTP ${result.status}`);
          }
        } else {
          // fetch path — no files, no upload progress needed
          const makeFetchRequest = (sid: string) =>
            fetch(`${API_BASE}/api/session/${sid}/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...planHeaders },
              body: JSON.stringify({ section, ...reportData, extraContext: extraPrompt, figures, formatting }),
              signal: controller.signal,
            });

          let response = await makeFetchRequest(sessionId);

          if (response.status === 404) {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_TS_KEY);
            const newId = await getOrCreateSession();
            response = await makeFetchRequest(newId);
          }

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (!response.body) throw new Error("Pas de réponse du serveur");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) processLine(line);
          }
          if (buffer.trim()) processLine(buffer);
        }

      // ── Auto-summarize for orchestrator cross-section intelligence ───────────
      if (finalContent && finalContent.split(/\s+/).filter(Boolean).length > 150) {
        try {
          const { updateReport, report: r } = useReportStore.getState();
          const summarizeRes = await fetch(`${API_BASE}/api/summarize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              section,
              content: finalContent,
              theme: r.theme,
              reportType: r.reportType,
            }),
          });
          if (summarizeRes.ok) {
            const { summary } = (await summarizeRes.json()) as { summary?: string };
            if (summary) {
              const existing = useReportStore.getState().report.sectionSummaries ?? {};
              useReportStore.getState().updateReport({ sectionSummaries: { ...existing, [section]: summary } });
            }
          }
        } catch { /* silent — summarization failure never blocks the user */ }
      }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return finalContent;
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        uploadCallbacks?.onError?.(friendlyUploadError(msg));
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
