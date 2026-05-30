import { useState, useCallback, useRef, useEffect, createElement, type ReactNode } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useGenerate } from "./use-generate";
import { useReportStore } from "@/lib/store";
import { GeneratedCard } from "@/components/chat-panel";

export interface ConvMsg {
  id: string;
  role: "agent" | "user";
  content: string | ReactNode;
}

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

  // Persist the conversation per step so a page refresh doesn't wipe it.
  // Only string-content messages are serializable; GeneratedCard (ReactNode)
  // messages are derived from report data and re-shown via the preview panel.
  const STORAGE_KEY = `rapportai_chat_step${step}`;
  const [messages, setMessages] = useState<ConvMsg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConvMsg[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* corrupt/unavailable — fall through to fresh */ }
    // When autoSend is set, start with no message — the AI generates its own opening.
    // When no autoSend, show the static initialMessage immediately.
    if (autoSend) return [];
    return initialMessage ? [{ id: newId(), role: "agent", content: initialMessage }] : [];
  });

  useEffect(() => {
    try {
      const serializable = messages
        .filter((m) => typeof m.content === "string")
        .map((m) => ({ id: m.id, role: m.role, content: m.content as string }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch { /* quota/unavailable — non-fatal */ }
  }, [messages, STORAGE_KEY]);
  const [isThinking, setIsThinking] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<string[]>([]);
  const stepCompleteRef = useRef(false);
  const autoSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const { generate, abort: abortGen, isGenerating, toolCalls, thinkingText } = useGenerate();

  const toApiMessages = (msgs: ConvMsg[]) =>
    msgs
      .filter((m) => typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content as string }));

  const send = useCallback(
    async (text: string, _opts?: { silent?: boolean }) => {
      if (isThinking || isGenerating) return;

      const userMsg: ConvMsg = { id: newId(), role: "user", content: text };
      const isSilent = _opts?.silent;

      setMessages((prev) => isSilent ? prev : [...prev, userMsg]);
      const currentMessages = isSilent ? messages : [...messages, userMsg];

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
        const res = await fetch(`${API_BASE}/api/converse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: toApiMessages(currentMessages),
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
              ? "**Le serveur a mis trop de temps à répondre.** Il se réveille peut-être après une période d'inactivité — patiente quelques secondes puis réessaie."
              : `**Un problème est survenu.** ${raw}\n\nRéessaie dans un instant.`;
        setMessages((prev) => [...prev, { id: newId(), role: "agent", content: friendly }]);
        setIsThinking(false);
        return;
      } finally {
        setIsThinking(false);
      }

      // Process server-generated section content first (bypasses SDK entirely)
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

      // Execute actions after stream completes
      let generationFailed = false;
      for (const action of pendingActions) {
        if (action.type === "generate_section") {
          const section = action.section as string;
          const context = action.context as string;
          const label = SECTION_LABELS[section] ?? section;

          // Skip sections already generated server-side (e.g. page-de-garde)
          if (serverHandledSections.has(section)) {
            setGeneratedSections((prev) => prev.includes(section) ? prev : [...prev, section]);
            continue;
          }

          // No "Je génère..." announcement — tool call cards are the live indicator
          const result = await generate(section, report as Parameters<typeof generate>[1], context);

          if (result) {
            setGeneratedSections((prev) => [...prev, section]);
            onSectionGenerated(section, result);

            const wordCount = result.split(/\s+/).filter(Boolean).length;
            const snippet = result
              .replace(/^#+\s*/gm, "")
              .replace(/\*\*/g, "")
              .trim()
              .slice(0, 300);

            // Show a compact GeneratedCard instead of plain "Généré ✓"
            setMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "agent",
                content: createElement(GeneratedCard, { label, wordCount, snippet }),
              },
            ]);
          } else {
            generationFailed = true;
            setMessages((prev) => [
              ...prev,
              { id: newId(), role: "agent", content: `**La génération de ${label} n'a pas abouti.** C'est souvent dû à une section longue ou au serveur. Dis-moi simplement "réessaie" — ou donne-moi une précision (problématique, angle) et je relance.` },
            ]);
          }
        }

        // Only advance the step if all generate_section actions succeeded.
        // If any generation failed, block step_complete so the user knows to retry.
        if (action.type === "step_complete" && !stepCompleteRef.current && !generationFailed) {
          stepCompleteRef.current = true;
          const msg = (action.message as string) || "Étape terminée ✓";
          setMessages((prev) => [...prev, { id: newId(), role: "agent", content: msg }]);
          onStepComplete();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, isThinking, isGenerating, step, report, generatedSections, generate, onSectionGenerated, onStepComplete]
  );

  useEffect(() => {
    // Only auto-send on a fresh conversation. If messages were restored from a
    // refresh (length > 1), the section was already generated — don't redo it.
    if (autoSend && !autoSentRef.current && messages.length <= 1) {
      autoSentRef.current = true;
      send(autoSend, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortGen();
    setIsThinking(false);
  }, [abortGen]);

  return {
    messages,
    send,
    abort,
    isThinking,
    isGenerating,
    toolCalls,
    thinkingText,
    generatedSections,
  };
}
