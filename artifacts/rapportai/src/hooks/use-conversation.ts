import { useState, useCallback, useRef, useEffect, createElement, type ReactNode } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useGenerate } from "./use-generate";
import { useReportStore } from "@/lib/store";
import { GeneratedCard } from "@/components/chat-panel";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConvMsg {
  id: string;
  role: "agent" | "user";
  content: string | ReactNode;
}

type TextBlock     = { type: "text"; text: string };
type ImageBlock    = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type DocumentBlock =
  | { type: "document"; source: { type: "base64"; media_type: string; data: string }; title?: string }
  | { type: "document"; source: { type: "text"; data: string }; title?: string };

export type ContentBlock = TextBlock | ImageBlock | DocumentBlock;

export type ApiMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

interface UseConversationOpts {
  step: number;
  initialMessage?: string;
  autoSend?: string;
  onSectionGenerated: (section: string, content: string) => void;
  onStepComplete: () => void;
}

export const SECTION_LABELS: Record<string, string> = {
  "page-de-garde": "Page de garde",
  dedicaces:       "Dédicaces",
  remerciements:   "Remerciements",
  resume:          "Résumé",
  abstract:        "Abstract",
  sommaire:        "Sommaire",
  introduction:    "Introduction",
  "partie-i":      "Partie I",
  "partie-ii":     "Partie II",
  conclusion:      "Conclusion",
  bibliographie:   "Bibliographie",
  abbreviations:   "Abréviations",
};

// ─── File processing helpers ──────────────────────────────────────────────────

async function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFiles(files: File[]): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];

  for (const file of files) {
    if (file.type === "application/pdf") {
      const data = await readAsBase64(file);
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
        title: file.name,
      });
    } else if (file.type.startsWith("image/")) {
      const data = await readAsBase64(file);
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: file.type, data },
      });
    } else if (
      file.type === "text/plain" ||
      file.type === "text/markdown" ||
      file.type === "text/csv" ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md")
    ) {
      const text = await file.text();
      blocks.push({
        type: "document",
        source: { type: "text", data: text },
        title: file.name,
      });
    } else {
      // DOCX / unknown — inform the agent without crashing
      blocks.push({
        type: "text",
        text: `[Fichier joint: "${file.name}" — format non lisible directement. Pour que je puisse m'en servir, convertis-le en PDF ou colle son contenu ici.]`,
      });
    }
  }

  return blocks;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

let msgIdCounter = 0;
const newId = () => String(++msgIdCounter);

export function useConversation({
  step,
  initialMessage,
  autoSend,
  onSectionGenerated,
  onStepComplete,
}: UseConversationOpts) {
  const { report } = useReportStore();

  const STORAGE_KEY = `rapportai_chat_step${step}`;
  const [messages, setMessages] = useState<ConvMsg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConvMsg[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* corrupt — fall through */ }
    if (autoSend) return [];
    return initialMessage ? [{ id: newId(), role: "agent", content: initialMessage }] : [];
  });

  useEffect(() => {
    try {
      const serializable = messages
        .filter((m) => typeof m.content === "string")
        .map((m) => ({ id: m.id, role: m.role, content: m.content as string }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch { /* quota/unavailable */ }
  }, [messages, STORAGE_KEY]);

  const [isThinking, setIsThinking] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<string[]>([]);
  const stepCompleteRef = useRef(false);
  const autoSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const { generate, abort: abortGen, isGenerating, toolCalls, thinkingText } = useGenerate();

  /** Convert stored messages to the plain API format (text-only; files are sent only once). */
  const toApiMessages = (msgs: ConvMsg[]): ApiMessage[] =>
    msgs
      .filter((m) => typeof m.content === "string" && (m.content as string).trim())
      .map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: m.content as string,
      }));

  const send = useCallback(
    async (text: string, files?: File[], _opts?: { silent?: boolean }) => {
      if (isThinking || isGenerating) return;

      const isSilent = _opts?.silent;
      const trimmed  = text.trim();

      // Build what to store as the user message (text-only — no binary)
      const fileLabel = files?.length
        ? files.map((f) => `[${f.name}]`).join(" ")
        : "";
      const storedContent = [trimmed, fileLabel].filter(Boolean).join(" ") || "(fichier)";

      const userMsg: ConvMsg = { id: newId(), role: "user", content: storedContent };
      setMessages((prev) => isSilent ? prev : [...prev, userMsg]);
      const historyForApi = isSilent ? messages : [...messages, userMsg];

      setIsThinking(true);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      let streamingId = newId();
      let streamingText = "";
      const pendingActions: Array<Record<string, unknown>> = [];
      const pendingSectionContents: Array<{ section: string; content: string }> = [];
      let hasStartedStreaming = false;

      try {
        // Process attached files into content blocks
        const fileBlocks = files?.length ? await processFiles(files) : [];

        // Current user message for the API: may include file content blocks
        const currentApiContent: string | ContentBlock[] =
          fileBlocks.length > 0
            ? [
                ...(trimmed ? [{ type: "text" as const, text: trimmed }] : []),
                ...fileBlocks,
              ]
            : trimmed;

        // Full messages for the API call:
        // - Previous turns: text-only from history
        // - Current turn:   text + file content blocks (sent once, not stored)
        const apiMessages: ApiMessage[] = [
          ...toApiMessages(isSilent ? messages.slice(0, -0) : messages),
          { role: "user", content: currentApiContent },
        ];

        const res = await fetch(`${API_BASE}/api/converse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            step,
            profile: report,
            generatedSections,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error("No body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let data: Record<string, unknown>;
            try { data = JSON.parse(raw); } catch { continue; }

            if (data.error) throw new Error(data.error as string);

            if (data.text) {
              streamingText += data.text as string;
              if (!hasStartedStreaming) {
                hasStartedStreaming = true;
                setMessages((prev) => [...prev, { id: streamingId, role: "agent", content: streamingText }]);
              } else {
                setMessages((prev) =>
                  prev.map((m) => m.id === streamingId ? { ...m, content: streamingText } : m)
                );
              }
            }

            if (data.action) {
              pendingActions.push(data.action as Record<string, unknown>);
            }

            if (data.section_content) {
              const sc = data.section_content as { section: string; content: string };
              if (sc.section && sc.content) {
                pendingSectionContents.push(sc);
              }
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") {
          setIsThinking(false);
          return;
        }
        const raw = err instanceof Error ? err.message : "Erreur inconnue";
        const friendly =
          /failed to fetch|networkerror|load failed/i.test(raw)
            ? "**Connexion interrompue.** Ta connexion a coupé un instant. Vérifie ton réseau et renvoie ton message."
            : /50\d|timeout|timed out/i.test(raw)
              ? "**Le serveur a mis trop de temps à répondre.** Il se réveille peut-être — patiente quelques secondes puis réessaie."
              : `**Un problème est survenu.** ${raw}\n\nRéessaie dans un instant.`;
        setMessages((prev) => [...prev, { id: newId(), role: "agent", content: friendly }]);
        setIsThinking(false);
        return;
      } finally {
        setIsThinking(false);
      }

      // Process server-generated section content first (bypasses SDK)
      for (const { section, content } of pendingSectionContents) {
        setGeneratedSections((prev) => [...prev, section]);
        onSectionGenerated(section, content);
        const label = SECTION_LABELS[section] ?? section;
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const snippet = content
          .replace(/^#+\s*/gm, "")
          .replace(/\*\*/g, "")
          .trim()
          .slice(0, 300);
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "agent", content: createElement(GeneratedCard, { label, wordCount, snippet }) },
        ]);
      }
      const serverHandledSections = new Set(pendingSectionContents.map((sc) => sc.section));

      // Execute SDK-based actions after stream completes
      let generationFailed = false;
      for (const action of pendingActions) {
        if (action.type === "generate_section") {
          const section = action.section as string;
          const context = action.context as string;
          const label = SECTION_LABELS[section] ?? section;

          if (serverHandledSections.has(section)) {
            setGeneratedSections((prev) => prev.includes(section) ? prev : [...prev, section]);
            continue;
          }

          const result = await generate(section, report as Parameters<typeof generate>[1], context);

          if (result) {
            setGeneratedSections((prev) => [...prev, section]);
            onSectionGenerated(section, result);
            const wordCount = result.split(/\s+/).filter(Boolean).length;
            const snippet = result.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim().slice(0, 300);
            setMessages((prev) => [
              ...prev,
              { id: newId(), role: "agent", content: createElement(GeneratedCard, { label, wordCount, snippet }) },
            ]);
          } else {
            generationFailed = true;
            setMessages((prev) => [
              ...prev,
              { id: newId(), role: "agent", content: `**La génération de ${label} n'a pas abouti.** Dis-moi "réessaie" et je relance.` },
            ]);
          }
        }

        if (action.type === "step_complete" && !stepCompleteRef.current && !generationFailed) {
          stepCompleteRef.current = true;
          const msg = (action.message as string) || "Étape terminée";
          setMessages((prev) => [...prev, { id: newId(), role: "agent", content: msg }]);
          onStepComplete();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, isThinking, isGenerating, step, report, generatedSections, generate, onSectionGenerated, onStepComplete]
  );

  useEffect(() => {
    if (autoSend && !autoSentRef.current && messages.length <= 1) {
      autoSentRef.current = true;
      send(autoSend, undefined, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortGen();
    setIsThinking(false);
  }, [abortGen]);

  return { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText, generatedSections };
}
