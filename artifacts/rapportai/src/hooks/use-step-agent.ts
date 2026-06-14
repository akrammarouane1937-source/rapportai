import { useState, useRef, useEffect, useCallback, createElement, type ReactNode } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { API_BASE } from "@/lib/apiBase";
import { useReportStore } from "@/lib/store";
import { useUserSettingsStore } from "@/lib/userSettingsStore";
import { ChoiceCard } from "@/components/chat-panel";
import { getMyPlan, incrementPages, incrementRevision } from "@/lib/userPlan";
import { usePaywallStore } from "@/lib/paywallStore";

// ─── Client-side file extraction ─────────────────────────────────────────────
// Images and PDFs go as base64 (Claude reads them natively).
// DOCX → mammoth text extraction. TXT/CSV/MD → plain text.

type FileContent =
  | { type: "image"; media_type: string; data: string; name: string }
  | { type: "document"; data: string; name: string }
  | { type: "text"; text: string; name: string };

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractFileContents(files: File[]): Promise<FileContent[]> {
  const results: FileContent[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (file.type.startsWith("image/")) {
        const data = await toBase64(file);
        results.push({ type: "image", media_type: file.type, data, name: file.name });
      } else if (file.type === "application/pdf" || ext === "pdf") {
        const data = await toBase64(file);
        results.push({ type: "document", data, name: file.name });
      } else if (ext === "docx" || ext === "doc") {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer });
        results.push({ type: "text", text: result.value.slice(0, 30000), name: file.name });
      } else {
        const text = await file.text();
        results.push({ type: "text", text: text.slice(0, 30000), name: file.name });
      }
    } catch {
      // Non-blocking — if extraction fails, omit this file from content
    }
  }
  return results;
}

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

// ─── Attachment display (parsed by ChatMessage in chat-panel.tsx) ─────────────
// Files are uploaded to the backend separately; this marker makes them VISIBLE
// in the message stream (thumbnails for images, file cards for documents).

function makeImageThumb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = 96 / Math.max(img.width, img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * Math.min(scale, 1)));
        canvas.height = Math.max(1, Math.round(img.height * Math.min(scale, 1)));
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("thumb failed")); };
    img.src = url;
  });
}

async function buildAttachMarker(files: File[]): Promise<string> {
  const items = await Promise.all(files.map(async (f) => {
    const base: { name: string; size: number; type: string; thumb?: string } = {
      name: f.name, size: f.size, type: f.type || "fichier",
    };
    if (f.type.startsWith("image/")) {
      try { base.thumb = await makeImageThumb(f); } catch { /* card without thumb */ }
    }
    return base;
  }));
  return `⟦ATTACH:${JSON.stringify(items)}⟧`;
}

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

      // Attachments stay VISIBLE in the chat (thumbnail/file cards) via marker
      let displayContent = text;
      if (_files && _files.length > 0) {
        try {
          displayContent = `${text}\n\n${await buildAttachMarker(_files)}`.trim();
        } catch { /* marker failed — plain text */ }
      }
      const userMsg: ConvMsg = { id: nextId(), role: "user", content: displayContent };
      const displayHistory: ConvMsg[] = [...messagesRef.current];

      if (!opts?.silent) {
        setMessages((prev) => [...prev, userMsg]);
        displayHistory.push(userMsg);
      }

      setIsThinking(true);
      setIsGenerating(false);
      setToolCalls([]);
      streamingIdRef.current = null;

      // Build compact history for the API — replace the attachment marker
      // (may contain base64 thumbnails) with a short note the coordinator understands
      const stripMarker = (s: string) =>
        s.replace(/⟦ATTACH:([\s\S]+?)⟧/g, (_m, json: string) => {
          try {
            const names = (JSON.parse(json) as Array<{ name: string }>).map((a) => a.name).join(", ");
            return `[fichier(s) joint(s) : ${names}]`;
          } catch { return "[fichier joint]"; }
        });
      const historyForApi = displayHistory
        .filter((m) => typeof m.content === "string" && m.content.trim())
        .map((m) => ({ role: m.role, content: stripMarker(m.content as string).slice(0, 2000) }));

      try {
        const sessionId = await getOrCreateSession();

        // Extract file contents client-side — Claude reads images/PDFs natively,
        // DOCX via mammoth, everything else as plain text.
        let fileContents: FileContent[] = [];
        if (_files && _files.length > 0) {
          fileContents = await extractFileContents(_files);
          // Also upload to workDir so the generation agent can reference them
          for (const file of _files) {
            try {
              const fd = new FormData();
              fd.append("file", file);
              await fetch(`${API_BASE}/api/session/${sessionId}/upload-document`, {
                method: "POST",
                body: fd,
                signal: ctrl.signal,
              });
            } catch { /* non-blocking */ }
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

        // Render's /tmp workDir is wiped on every deploy/restart, so the server
        // can lose section .md files while the store still holds the content.
        // Send all generated sections so the server can restore them to disk
        // before generating anything that depends on them (abstract needs the
        // résumé, partie-ii needs partie-i, conclusion needs all, etc.).
        const existingSections: Record<string, string> = {};
        const sectionMap: Record<string, string> = {
          "resume":         report.resumeFr,
          "abstract":       report.abstractEn,
          "introduction":   report.introduction,
          "partie-i":       report.partieI,
          "partie-ii":      report.partieII,
          "conclusion":     report.conclusion,
          "dedicaces":      report.dedicaces,
          "remerciements":  report.remerciements,
          "sommaire":       report.sommaire,
          "bibliographie":  report.bibliographie,
        };
        for (const [id, content] of Object.entries(sectionMap)) {
          if (typeof content === "string" && content.trim()) existingSections[id] = content;
        }

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
            message: text || (_files && _files.length > 0
              ? `J'ai joint un fichier : ${_files.map((f) => f.name).join(", ")}. Lis-le et utilise-le comme contexte.`
              : text),
            history: historyForApi,
            sessionId,
            profile,
            existingSections: Object.keys(existingSections).length > 0 ? existingSections : undefined,
            fileContents: fileContents.length > 0 ? fileContents : undefined,
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
              const storeKey = (typeof data.zustand_key === "string" && data.zustand_key)
                || SECTION_TO_STORE_KEY[data.section as string];
              const existing = storeKey
                ? (useReportStore.getState().report as unknown as Record<string, unknown>)[storeKey]
                : undefined;
              if (typeof existing === "string" && existing.trim().length > 0) {
                incrementRevision();
              }
              // Write the content DIRECTLY into the store — never depend solely on
              // the page callback. Idempotent with onSectionGenerated.
              if (storeKey) {
                useReportStore.getState().updateReport(
                  { [storeKey]: data.content } as Parameters<ReturnType<typeof useReportStore.getState>["updateReport"]>[0]
                );
              }
              onSectionGenerated?.(data.section as string, data.content as string);
              // Visible confirmation — if this message appears but the preview stays
              // empty, the bug is in rendering; if it never appears, the event was lost.
              setMessages((prev) => [...prev, {
                id: nextId(),
                role: "agent",
                content: `✅ Section enregistrée (${wordCount} mots) — visible dans l'aperçu à droite.`,
              }]);
              streamingIdRef.current = null;
            }

            // ── plan_limit: revision/page limit hit mid-stream ─────────
            if (data.type === "plan_limit") {
              setIsThinking(false);
              setIsGenerating(false);
              const lt = data.limit_type === "revisions" ? "revisions" as const : "pages" as const;
              const cp = (data.planId === "starter" || data.planId === "pro") ? data.planId : "free";
              usePaywallStore.getState().trigger(lt, cp as import("@/lib/userPlan").PlanId);
            }

            // ── template_filled: student's own .docx template, filled ──
            if (data.type === "template_filled" && typeof data.url === "string") {
              const dlUrl = `${API_BASE}${data.url}`;
              setMessages((prev) => [...prev, {
                id: nextId(),
                role: "agent",
                content: `Bonus : j'ai aussi rempli **ton modèle Word exact** avec tes informations — mise en page, logo et polices d'origine conservés.\n\n[📄 Télécharger ta page de garde (ton modèle rempli)](${dlUrl})`,
              }]);
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
        const raw = err instanceof Error ? err.message : "";
        // "Failed to fetch" = the server connection dropped (restart/deploy) — say it humanly
        const msg = /failed to fetch|networkerror|load failed/i.test(raw)
          ? "La connexion au serveur a été interrompue. Attends quelques secondes puis renvoie ton message — tes réponses sont conservées."
          : raw || "Erreur de connexion.";
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
