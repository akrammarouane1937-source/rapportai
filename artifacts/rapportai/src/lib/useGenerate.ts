import { useRef, useState, useCallback } from "react";
import { type ActivityItem, getActivityMeta } from "@/components/report/AgentActivityFeed";
import { getReport, saveReport } from "@/lib/reportStore";
import { getBibSources } from "@/lib/bibliothequeStore";
import { API_BASE as BASE_PATH } from "@/lib/apiBase";
import { useUserSettingsStore } from "@/lib/userSettingsStore";

export type GenerateSection =
  | "partie-i"
  | "partie-ii"
  | "introduction"
  | "conclusion"
  | "resume"
  | "dedicaces"
  | "remerciements"
  | "laisser-ia"
  | "abstract";

export interface GenerateOptions {
  section: GenerateSection;
  theme?: string;
  school?: string;
  filiere?: string;
  problematique?: string;
  motsCles?: string[];
  citationStyle?: string;
  extraContext?: string;
  reportType?: string;
  studentName?: string;
  annee?: string;
  encadrantPeda?: string;
  encadrantPro?: string;
  entreprise?: string;
  ville?: string;
  resume?: string;
}

// The agent asks the student a question — caller must call answerQuestion() to resume
export interface AgentQuestion {
  question: string;
  choices?: string[];
  toolUseId: string;
  sessionId: string;
}

// Sections that use the persistent agent session (full document memory + all tools)
const SESSION_SECTIONS = new Set<GenerateSection>([
  "partie-i",
  "partie-ii",
  "introduction",
  "conclusion",
  "resume",
  "dedicaces",
  "remerciements",
]);

const DEMO: Record<string, unknown> = {
  reportType:    "PFE",
  theme:         "Optimisation de portefeuille d'actifs financiers à la Bourse de Casablanca",
  school:        "EMSI",
  filiere:       "Finance",
  annee:         "2023–2024",
  studentName:   "Youssef El Amrani",
  encadrantPeda: "Pr. Mohamed Alami",
  encadrantPro:  "M. Karim Benali",
  entreprise:    "Attijariwafa Bank",
  ville:         "Casablanca",
  problematique: "Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée aux spécificités du marché boursier marocain ?",
  motsCles:      ["optimisation", "portefeuille", "Markowitz", "MASI", "marché émergent"],
  citationStyle: "APA 7th ed.",
};

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ─── Session management ───────────────────────────────────────────────────────

const SESSION_TTL_MS = 45 * 60 * 1000; // 45 min — matches Render free-tier container uptime

export function clearSession(): void {
  saveReport({ sessionId: undefined, sessionCreatedAt: undefined });
}

export async function ensureSession(signal?: AbortSignal): Promise<string> {
  signal = signal ?? new AbortController().signal;
  const stored = getReport();

  // Return cached session only if it's still within TTL
  if (stored.sessionId && stored.sessionCreatedAt) {
    if (Date.now() - stored.sessionCreatedAt < SESSION_TTL_MS) {
      return stored.sessionId;
    }
    // Expired — clear and recreate
    clearSession();
  } else if (stored.sessionId) {
    // Legacy entry without timestamp — treat as expired
    clearSession();
  }

  const profile = {
    studentName:    stored.studentName   ?? (DEMO.studentName   as string),
    school:         stored.school        ?? (DEMO.school        as string),
    filiere:        stored.filiere       ?? (DEMO.filiere       as string),
    reportType:     stored.reportType    ?? (DEMO.reportType    as string),
    theme:          stored.theme         ?? (DEMO.theme         as string),
    problematique:  stored.problematique ?? (DEMO.problematique as string),
    citationStyle:  stored.citationStyle ?? (DEMO.citationStyle as string),
    annee:          stored.annee         ?? (DEMO.annee         as string),
    encadrantPeda:  stored.encadrantPeda ?? (DEMO.encadrantPeda as string),
    encadrantPro:   stored.encadrantPro  ?? (DEMO.encadrantPro  as string),
    entreprise:     stored.entreprise    ?? (DEMO.entreprise    as string),
    ville:          stored.ville         ?? (DEMO.ville         as string),
    ...(stored.dateDebutStage ? { dateDebutStage: stored.dateDebutStage } : {}),
    ...(stored.dateFinStage   ? { dateFinStage:   stored.dateFinStage   } : {}),
    ...(stored.juryMember1    ? { juryMember1:    stored.juryMember1    } : {}),
    ...(stored.juryMember2    ? { juryMember2:    stored.juryMember2    } : {}),
    ...(stored.juryMember3    ? { juryMember3:    stored.juryMember3    } : {}),
    formatting:     useUserSettingsStore.getState().formatting,
    existingSections: {
      ...(stored.resume        ? { resume:        stored.resume        } : {}),
      ...(stored.introduction  ? { introduction:  stored.introduction  } : {}),
      ...(stored.partieI       ? { "partie-i":    stored.partieI       } : {}),
      ...(stored.partieII      ? { "partie-ii":   stored.partieII      } : {}),
      ...(stored.conclusion    ? { conclusion:    stored.conclusion    } : {}),
      ...(stored.dedicaces     ? { dedicaces:     stored.dedicaces     } : {}),
      ...(stored.remerciements ? { remerciements: stored.remerciements } : {}),
    },
  };

  const resp = await fetch(`${BASE_PATH}/api/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
    signal,
  });

  if (!resp.ok) throw new Error(`Session start failed: HTTP ${resp.status}`);
  const { sessionId } = (await resp.json()) as { sessionId: string };
  saveReport({ sessionId, sessionCreatedAt: Date.now() });
  return sessionId;
}

// ─── SSE reader ───────────────────────────────────────────────────────────────

type SSEMessage = {
  content?: string;
  done?: boolean;
  error?: string;
  tool_call?: string;
  question?: string;
  choices?: string[];
  toolUseId?: string;
  paused?: boolean;
  sections?: Record<string, string>;
};

const TOOL_STATUS: Record<string, string> = {
  WebFetch:  "Recherche de sources académiques…",
  Read:      "Lecture des sections existantes…",
  Write:     "Rédaction en cours…",
  Edit:      "Révision en cours…",
  Glob:      "Exploration du rapport…",
  Bash:      "Traitement en cours…",
};


async function readSSE(
  resp: Response,
  handlers: {
    onChunk: (text: string) => void;
    onDone: () => void;
    onQuestion: (q: AgentQuestion, sessionId: string) => void;
    onToolCall?: (status: string) => void;
    onActivity?: (item: ActivityItem) => void;
    onPaywall?: () => void;
    paywallWords?: number;
    ctrl: AbortController;
    wordCountRef: { current: number };
    paywallTriggeredRef: { current: boolean };
    sessionId: string;
  }
): Promise<void> {
  if (!resp.body) throw new Error("No response body");

  const {
    onChunk, onDone, onQuestion, onToolCall, onActivity, onPaywall, paywallWords,
    ctrl, wordCountRef, paywallTriggeredRef, sessionId,
  } = handlers;

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const msg = JSON.parse(line.slice(6)) as SSEMessage;

        if (msg.error) throw new Error(msg.error);

        // Agent is asking the student a question — pause and surface it
        if (msg.paused && msg.question && msg.toolUseId) {
          onQuestion(
            { question: msg.question, choices: msg.choices, toolUseId: msg.toolUseId, sessionId },
            sessionId
          );
          return;
        }

        // Stream complete — sync written sections back to localStorage
        if (msg.done) {
          if (msg.sections) {
            const patch: Record<string, string> = {};
            if (msg.sections["resume"])        patch.resume        = msg.sections["resume"];
            if (msg.sections["introduction"])  patch.introduction  = msg.sections["introduction"];
            if (msg.sections["partie-i"])      patch.partieI       = msg.sections["partie-i"];
            if (msg.sections["partie-ii"])     patch.partieII      = msg.sections["partie-ii"];
            if (msg.sections["conclusion"])    patch.conclusion    = msg.sections["conclusion"];
            if (msg.sections["dedicaces"])     patch.dedicaces     = msg.sections["dedicaces"];
            if (msg.sections["remerciements"]) patch.remerciements = msg.sections["remerciements"];
            if (Object.keys(patch).length > 0) saveReport(patch);
          }
          onDone();
          return;
        }

        // Tool call — surface as French status + activity item
        if (msg.tool_call) {
          const status = TOOL_STATUS[msg.tool_call] ?? `${msg.tool_call}…`;
          onToolCall?.(status);
          const meta = getActivityMeta(msg.tool_call);
          onActivity?.({
            id: `${msg.tool_call}-${Date.now()}-${Math.random()}`,
            tool: msg.tool_call,
            label: meta.label,
            icon: meta.icon,
            ts: Date.now(),
          });
          continue;
        }

        // Text chunk
        if (msg.content) {
          if (paywallWords && !paywallTriggeredRef.current) {
            wordCountRef.current += countWords(msg.content);
            if (wordCountRef.current >= paywallWords) {
              paywallTriggeredRef.current = true;
              onChunk(msg.content);
              ctrl.abort();
              onPaywall?.();
              return;
            }
          }
          onChunk(msg.content);
        }
      } catch (e) {
        throw e;
      }
    }
  }
}

// ─── useGenerate hook ─────────────────────────────────────────────────────────

export function useGenerate(opts: {
  onChunk: (text: string) => void;
  onDone: () => void;
  onPaywall?: () => void;
  onQuestion?: (q: AgentQuestion) => void;
  paywallWords?: number;
}) {
  const { onChunk, onDone, onPaywall, onQuestion, paywallWords } = opts;
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string>("Génération en cours…");
  const [error, setError] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<AgentQuestion | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const wordCountRef = useRef(0);
  const paywallTriggeredRef = useRef(false);

  const clearActivity = useCallback(() => setActivityLog([]), []);

  const generate = useCallback(
    async (options: GenerateOptions) => {
      if (isStreaming) return;
      setIsStreaming(true);
      setError(null);
      setPendingQuestion(null);
      wordCountRef.current = 0;
      paywallTriggeredRef.current = false;

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStreamingStatus("Génération en cours…");

      try {
        clearActivity();
        const stored = getReport();
        const bibSources = getBibSources().map((s) => ({
          title: s.title, authors: s.authors, year: s.year,
          journal: s.journal, doi: s.doi,
        }));

        const useSession = SESSION_SECTIONS.has(options.section);

        let resp: Response;
        let sessionId = "";

        if (useSession) {
          sessionId = await ensureSession(ctrl.signal);

          // Sync latest form data to session memory before every generation.
          // The session may have been created earlier (e.g. at template upload in Step 2)
          // so fields filled later — motsCles, problematique, objectifs, resume — must be pushed now.
          const memoryPatch: Record<string, unknown> = {};
          if (stored.motsCles?.length)     memoryPatch.mots_cles      = stored.motsCles;
          if (stored.problematique)        memoryPatch.problematique  = stored.problematique;
          if (options.problematique)       memoryPatch.problematique  = options.problematique;
          if (stored.citationStyle)        memoryPatch.citationStyle  = stored.citationStyle;
          if (stored.resume)               memoryPatch.resume         = stored.resume;
          if (Object.keys(memoryPatch).length > 0) {
            fetch(`${BASE_PATH}/api/session/${sessionId}/memory`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(memoryPatch),
              signal: ctrl.signal,
            }).catch(() => {/* non-blocking — generation continues even if patch fails */});
          }

          resp = await fetch(`${BASE_PATH}/api/session/${sessionId}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              section:       options.section,
              sources:       bibSources.length > 0 ? bibSources : undefined,
              // Pass section-specific context so the agent task can use it
              problematique: options.problematique || stored.problematique || undefined,
              extraContext:  options.extraContext  || undefined,
              formatting:    useUserSettingsStore.getState().formatting,
            }),
            signal: ctrl.signal,
          });
        } else {
          const body = {
            ...DEMO,
            reportType: stored.reportType, theme: stored.theme,
            school: stored.school, filiere: stored.filiere, annee: stored.annee,
            studentName: stored.studentName, encadrantPeda: stored.encadrantPeda,
            encadrantPro: stored.encadrantPro, entreprise: stored.entreprise,
            ville: stored.ville, citationStyle: stored.citationStyle,
            motsCles: stored.motsCles,
            resume: stored.resume, introduction: stored.introduction,
            partieI: stored.partieI, partieII: stored.partieII,
            conclusion: stored.conclusion, dedicaces: stored.dedicaces,
            remerciements: stored.remerciements,
            sources: bibSources.length > 0 ? bibSources : undefined,
            formatting: useUserSettingsStore.getState().formatting,
            ...options,
          };
          resp = await fetch(`${BASE_PATH}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))
            ),
            signal: ctrl.signal,
          });
        }

        if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

        await readSSE(resp, {
          onChunk,
          onDone,
          onPaywall,
          onToolCall: setStreamingStatus,
          onActivity: (item) => setActivityLog((prev) => [...prev, item]),
          onQuestion: (q) => {
            setPendingQuestion(q);
            onQuestion?.(q);
          },
          paywallWords,
          ctrl,
          wordCountRef,
          paywallTriggeredRef,
          sessionId,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, onChunk, onDone, onPaywall, onQuestion, paywallWords]
  );

  // Call this after showing the question to the student and collecting their answer
  const answerQuestion = useCallback(
    async (answer: string) => {
      if (!pendingQuestion || isStreaming) return;
      setIsStreaming(true);
      setError(null);
      setPendingQuestion(null);
      wordCountRef.current = 0;
      paywallTriggeredRef.current = false;

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const resp = await fetch(
          `${BASE_PATH}/api/session/${pendingQuestion.sessionId}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toolUseId: pendingQuestion.toolUseId, answer }),
            signal: ctrl.signal,
          }
        );

        if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

        await readSSE(resp, {
          onChunk,
          onDone,
          onPaywall,
          onToolCall: setStreamingStatus,
          onQuestion: (q) => {
            setPendingQuestion(q);
            onQuestion?.(q);
          },
          paywallWords,
          ctrl,
          wordCountRef,
          paywallTriggeredRef,
          sessionId: pendingQuestion.sessionId,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStreaming(false);
      }
    },
    [pendingQuestion, isStreaming, onChunk, onDone, onPaywall, onQuestion, paywallWords]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { generate, abort, answerQuestion, isStreaming, streamingStatus, error, pendingQuestion, activityLog, clearActivity };
}
