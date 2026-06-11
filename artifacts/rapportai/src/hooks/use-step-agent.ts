import { useState, useRef, useEffect, useCallback, createElement, type ReactNode } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { API_BASE } from "@/lib/apiBase";
import { useReportStore } from "@/lib/store";
import { useUserSettingsStore } from "@/lib/userSettingsStore";
import { ChoiceCard } from "@/components/chat-panel";
import { getMyPlan, incrementPages, incrementRevision } from "@/lib/userPlan";
import { usePaywallStore } from "@/lib/paywallStore";

// Section id (backend) → report store key, to detect whether a file_written
// is a first generation or a revision of existing content.
const SECTION_TO_STORE_KEY: Record<string, string> = {
  "page-de-garde":  "pageDeGarde",
  "dedicaces":      "dedicaces",
  "remerciements":  "remerciements",
  "resume":         "resumeFr",
  "abstract":       "abstractEn",
  "sommaire":       "sommaire",
  "introduction":   "introduction",
  "partie-i":       "partieI",
  "partie-ii":      "partieII",
  "conclusion":     "conclusion",
  "bibliographie":  "bibliographie",
};

// ─── Re-export ToolCall so pages can import from here ────────────────────────
export type { ToolCall } from "@/hooks/use-generate";

const SESSION_KEY     = "rapportai_session";
const SESSION_TS_KEY  = "rapportai_session_ts";
const SESSION_TTL     = 4 * 60 * 60 * 1000; // 4 hours

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConvMsg {
  id: string;
  role: "agent" | "user";
  content: string | ReactNode;
}

export interface ToolCallItem {
  id: string;
  name: string;
  detail?: string;
  done: boolean;
}

interface UseStepAgentOptions {
  step: number | string;
  autoSend?: string;
  onSectionGenerated?: (section: string, content: string) => void;
  onStepComplete?: () => void;
}

const CHAT_LS_PREFIX = "rapportai:chat-history:step-";

let msgCounter = 0;
function nextId(): string { return `sa-${++msgCounter}`; }

const TOOL_LABELS: Record<string, string> = {
  Read:         "Lecture du rapport",
  WebSearch:    "Recherche académique",
  WebFetch:     "Recherche de sources",
  Write:        "Rédaction en cours",
  Edit:         "Révision en cours",
  Glob:         "Analyse des fichiers",
  Bash:         "Traitement",
  Humanizing:   "Humanisation du texte",
};

function getToolLabel(name: string): string {
  if (name?.startsWith("pdf:")) return `Lecture de ${name.slice(4)}`;
  if (name?.startsWith("image:")) return "Analyse figure";
  return TOOL_LABELS[name] || name;
}

function cleanDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const basename = detail.split(/[/\\]/).pop() ?? detail;
  const cleaned = basename.replace(/['"]/g, "").trim();
  if (!cleaned) return undefined;
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned;
}

// ─── Session management (shared with use-generate) ───────────────────────────

async function getOrCreateSession(): Promise<string> {
  const stored = localStorage.getItem(SESSION_KEY);
  const ts     = localStorage.getItem(SESSION_TS_KEY);
  if (stored && ts && Date.now() - Number(ts) < SESSION_TTL) return stored;

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TS_KEY);

  const report = useReportStore.getState().report;
  const formatting = useUserSettingsStore.getState().formatting;
  const profile = {
    studentName:  report.studentName,
    school:       report.school,
    filiere:      report.filiere,
    reportType:   report.reportType,
    theme:        report.theme?.trim() || "Rapport académique",
    annee:        report.academicYear,
    problematique: report.problematique || undefined,
    encadrantPeda: report.encadrantPeda,
    encadrantPro:  report.encadrantPro,
    entreprise:    report.entreprise,
    motsCles:      report.motsCles,
    formatting,
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

  if (!res.ok) {
    let errMsg = `Erreur serveur (HTTP ${res.status})`;
    try { const b = await res.json() as { error?: string }; if (b.error) errMsg = b.error; } catch { /* ignore */ }
    throw new Error(errMsg);
  }
  const { sessionId } = await res.json() as { sessionId: string };
  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
  return sessionId;
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useStepAgent({
  step,
  autoSend,
  onSectionGenerated,
  onStepComplete,
}: UseStepAgentOptions) {
  const lsKey = `${CHAT_LS_PREFIX}${step}`;

  const [messages, setMessages] = useState<ConvMsg[]>(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) return JSON.parse(raw) as ConvMsg[];
    } catch { /* corrupt */ }
    return [];
  });

  const [isThinking, setIsThinking]   = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolCalls, setToolCalls]     = useState<ToolCallItem[]>([]);
  const [thinkingText]                = useState("");

  const abortCtrlRef  = useRef<AbortController | null>(null);
  const autoSentRef   = useRef(false);
  const streamingIdRef = useRef<string | null>(null);

  // Persist messages to localStorage whenever they change (capped at last 20)
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    try {
      // Only string-content messages are serializable. ChoiceCard (ReactNode)
      // messages are transient prompts, not persisted.
      const serializable = messages.filter((m) => typeof m.content === "string").slice(-20);
      localStorage.setItem(lsKey, JSON.stringify(serializable));
    } catch { /* quota */ }
  }, [messages, lsKey]);

  const abort = useCallback(() => {
    abortCtrlRef.current?.abort();
    setIsThinking(false);
    setIsGenerating(false);
  }, []);

  const send = useCallback(
    async (
      text: string,
      _files?: File[],
      opts?: { silent?: boolean }
    ) => {
      if (isThinking || isGenerating) return;
      if (abortCtrlRef.current) abortCtrlRef.current.abort();

      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      const userMsg: ConvMsg = { id: nextId(), role: "user", content: text };
      const displayHistory: ConvMsg[] = [...messagesRef.current];

      if (!opts?.silent) {
        setMessages((prev) => [...prev, userMsg]);
        displayHistory.push(userMsg);
      }

      setIsThinking(true);
      setIsGenerating(false);
      setToolCalls([]);
      streamingIdRef.current = null;

      // Build compact history for the API
      const historyForApi = displayHistory
        .filter((m) => typeof m.content === "string" && m.content.trim())
        .map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 2000) : "" }));

      try {
        const sessionId = await getOrCreateSession();

        // Upload any attached files to the session workDir before generation
        if (_files && _files.length > 0) {
          for (const file of _files) {
            try {
              const fd = new FormData();
              fd.append("file", file);
              await fetch(`${API_BASE}/api/session/${sessionId}/upload-document`, {
                method: "POST",
                body: fd,
                signal: ctrl.signal,
              });
            } catch { /* non-blocking — agent will still generate without files */ }
          }
        }

        const report = useReportStore.getState().report;
        const formatting = useUserSettingsStore.getState().formatting;
        const rawName = report.studentName ?? "";
        const profile = {
          studentName:    rawName.replace(/\b\w/g, (c) => c.toUpperCase()),
          school:         report.school,
          filiere:        report.filiere,
          reportType:     report.reportType,
          theme:          report.theme,
          academicYear:   report.academicYear,
          encadrantPeda:  report.encadrantPeda,
          encadrantPro:   report.encadrantPro,
          entreprise:     report.entreprise,
          ville:          report.ville,
          motsCles:       report.motsCles,
          sommaire:       report.sommaire,
          partieITitle:   report.partieITitle,
          partieIITitle:  report.partieIITitle,
          partieIChapters: report.partieIChapters,
          partieIIChapters: report.partieIIChapters,
          problematique:  report.problematique,
          pendingContextInjection: report.pendingContextInjection,
          formatting,
        };

        // One-shot: the injection came from a chat navigation and applies to
        // this step only — clear it so it doesn't leak into later steps.
        if (report.pendingContextInjection) {
          useReportStore.getState().updateReport({ pendingContextInjection: "" });
        }

        const planData = getMyPlan();

        await fetchEventSource(`${API_BASE}/api/agent/${step}/stream`, {
          method: "POST",
          headers: {
            "Content-Type":      "application/json",
            "x-plan-id":         planData.planId,
            "x-pages-generated": String(planData.pagesGenerated ?? 0),
            "x-revision-count":  String(planData.revisionCount ?? 0),
          },
          body: JSON.stringify({
            message: text,
            history: historyForApi,
            sessionId,
            profile,
          }),
          signal: ctrl.signal,
          openWhenHidden: true,

          async onopen(response) {
            if (response.status === 403) {
              try {
                const body = await response.json() as { error?: string; limit_type?: string; planId?: string };
                if (body.error === "plan_limit_reached") {
                  const lt = body.limit_type === "revisions" ? "revisions" : "pages";
                  const cp = (body.planId === "starter" || body.planId === "pro") ? body.planId : "free";
                  usePaywallStore.getState().trigger(lt, cp as import("@/lib/userPlan").PlanId);
                  const e = new Error("plan_limit_reached");
                  e.name = "PlanLimitError";
                  throw e;
                }
              } catch (jsonErr) {
                if ((jsonErr as Error)?.name === "PlanLimitError") throw jsonErr;
              }
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
          },

          onmessage(ev) {
            if (!ev.data || ev.data === "[DONE]") return;
            let data: Record<string, unknown>;
            try { data = JSON.parse(ev.data) as Record<string, unknown>; }
            catch { return; }

            // ── text event: coordinator chat response ──────────────────
            if (data.type === "text" && typeof data.content === "string") {
              setIsThinking(false);
              const content = data.content as string;
              if (!streamingIdRef.current) {
                // Create a new agent message
                const id = nextId();
                streamingIdRef.current = id;
                setMessages((prev) => [...prev, { id, role: "agent", content }]);
              } else {
                const id = streamingIdRef.current;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === id
                      ? { ...m, content: (typeof m.content === "string" ? m.content : "") + content }
                      : m
                  )
                );
              }
            }

            // ── ask_user: agent asks a question with clickable choices ──
            if (
              data.type === "ask_user" &&
              typeof data.question === "string" &&
              Array.isArray(data.choices) &&
              data.choices.length > 0
            ) {
              setIsThinking(false);
              setIsGenerating(false);
              streamingIdRef.current = null;
              const q = data.question as string;
              const ch = (data.choices as unknown[]).map((c) => String(c));
              setMessages((prev) => [
                ...prev,
                {
                  id: nextId(),
                  role: "agent",
                  content: createElement(ChoiceCard, {
                    question: q,
                    choices: ch,
                    onChoice: (choice: string) => { void sendRef.current(choice); },
                  }),
                },
              ]);
            }

            // ── tool_call: generation activity ────────────────────────
            if (data.type === "tool_call") {
              setIsThinking(false);
              setIsGenerating(true);
              const name   = typeof data.name   === "string" ? getToolLabel(data.name) : "";
              const detail = typeof data.detail === "string" ? cleanDetail(data.detail) : undefined;
              setToolCalls((prev) => {
                const updated = prev.map((tc) => tc.done ? tc : { ...tc, done: true });
                return [...updated, { id: nextId(), name, detail, done: false }];
              });
            }

            // ── file_written: section generated ───────────────────────
            if (
              data.type === "file_written" &&
              typeof data.section === "string" &&
              typeof data.content === "string"
            ) {
              setToolCalls((prev) => prev.map((tc) => ({ ...tc, done: true })));
              const wordCount = (data.content as string).split(/\s+/).filter(Boolean).length;
              incrementPages(wordCount);
              // If this section already had content, the agent just edited it → that's a revision
              const storeKey = SECTION_TO_STORE_KEY[data.section as string];
              const existing = storeKey
                ? (useReportStore.getState().report as unknown as Record<string, unknown>)[storeKey]
                : undefined;
              if (typeof existing === "string" && existing.trim().length > 0) {
                incrementRevision();
              }
              onSectionGenerated?.(data.section as string, data.content as string);
            }

            // ── plan_limit: revision/page limit hit mid-stream ─────────
            if (data.type === "plan_limit") {
              setIsThinking(false);
              setIsGenerating(false);
              const lt = data.limit_type === "revisions" ? "revisions" as const : "pages" as const;
              const cp = (data.planId === "starter" || data.planId === "pro") ? data.planId : "free";
              usePaywallStore.getState().trigger(lt, cp as import("@/lib/userPlan").PlanId);
            }

            // ── step_done: step complete ───────────────────────────────
            if (data.type === "step_done") {
              onStepComplete?.();
            }

            // ── done: request complete ─────────────────────────────────
            if (data.type === "done") {
              setIsThinking(false);
              setIsGenerating(false);
              setToolCalls((prev) => prev.map((tc) => ({ ...tc, done: true })));
              streamingIdRef.current = null;
            }

            // ── error ──────────────────────────────────────────────────
            if (data.type === "error" && typeof data.message === "string") {
              setIsThinking(false);
              setIsGenerating(false);
              const errId = nextId();
              setMessages((prev) => [...prev, { id: errId, role: "agent", content: data.message as string }]);
              streamingIdRef.current = null;
            }
          },

          onerror(err) {
            if ((err as Error)?.name === "AbortError") return;
            setIsThinking(false);
            setIsGenerating(false);
            streamingIdRef.current = null;
            if ((err as Error)?.name === "PlanLimitError") {
              throw err; // paywall already shown — no chat message
            }
            const errId = nextId();
            setMessages((prev) => [...prev, { id: errId, role: "agent", content: "Une erreur est survenue. Réessaie." }]);
            throw err; // stop retrying
          },

          onclose() {
            setIsThinking(false);
            setIsGenerating(false);
          },
        });

      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setIsThinking(false);
        setIsGenerating(false);
        const errId = nextId();
        const msg = err instanceof Error ? err.message : "Erreur de connexion.";
        setMessages((prev) => [...prev, { id: errId, role: "agent", content: msg }]);
      }
    },
    [isThinking, isGenerating, step, onSectionGenerated, onStepComplete]
  );

  // Stable ref to send — lets a ChoiceCard's onChoice (created inside the stream
  // handler) send the chosen option back as the next user message.
  const sendRef = useRef(send);
  sendRef.current = send;

  // Auto-send initial message if configured and no history exists
  useEffect(() => {
    if (!autoSend || autoSentRef.current) return undefined;
    autoSentRef.current = true;
    if (messagesRef.current.length === 0) {
      const t = setTimeout(() => send(autoSend, undefined, { silent: true }), 100);
      return () => clearTimeout(t);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    messages,
    send,
    abort,
    isThinking,
    isGenerating,
    toolCalls,
    thinkingText,
  };
}
