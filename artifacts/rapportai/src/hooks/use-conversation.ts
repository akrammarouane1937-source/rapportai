import { useState, useCallback, useRef, useEffect } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useGenerate } from "./use-generate";
import { useReportStore } from "@/lib/store";

export interface ConvMsg {
  id: string;
  role: "agent" | "user";
  content: string;
}

interface UseConversationOpts {
  step: number;
  initialMessage: string;
  /** If set, this message is auto-sent on mount (e.g. step-5 auto-generates) */
  autoSend?: string;
  onSectionGenerated: (section: string, content: string) => void;
  onStepComplete: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  "page-de-garde": "la page de garde",
  dedicaces: "les dédicaces",
  remerciements: "les remerciements",
  resume: "le résumé",
  abstract: "l'abstract",
  sommaire: "le sommaire",
  introduction: "l'introduction",
  "partie-i": "la Partie I",
  "partie-ii": "la Partie II",
  conclusion: "la conclusion",
  abbreviations: "les abréviations",
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
  const [messages, setMessages] = useState<ConvMsg[]>([
    { id: newId(), role: "agent", content: initialMessage },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<string[]>([]);
  const stepCompleteRef = useRef(false);
  const autoSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const { generate, abort: abortGen, isGenerating, toolCalls, thinkingText } = useGenerate();

  // Build the API messages array (agent → assistant, user → user)
  const toApiMessages = (msgs: ConvMsg[]) =>
    msgs
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content }));

  const send = useCallback(
    async (text: string, _opts?: { silent?: boolean }) => {
      if (isThinking || isGenerating) return;

      const userMsg: ConvMsg = { id: newId(), role: "user", content: text };
      // For silent/auto sends (like step-5 autoStart), don't push a user bubble
      const isSilent = _opts?.silent;

      setMessages((prev) => {
        const next = isSilent ? prev : [...prev, userMsg];
        return next;
      });

      const currentMessages = isSilent
        ? messages
        : [...messages, userMsg];

      setIsThinking(true);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      let streamingId = newId();
      let streamingText = "";
      const pendingActions: Array<Record<string, unknown>> = [];
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
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") {
          setIsThinking(false);
          return;
        }
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setMessages((prev) => [...prev, { id: newId(), role: "agent", content: `❌ ${msg}` }]);
        setIsThinking(false);
        return;
      } finally {
        setIsThinking(false);
      }

      // Execute actions sequentially after stream completes
      for (const action of pendingActions) {
        if (action.type === "generate_section") {
          const section = action.section as string;
          const context = action.context as string;
          const label = SECTION_LABELS[section] ?? section;

          setMessages((prev) => [
            ...prev,
            { id: newId(), role: "agent", content: `Je génère ${label}...` },
          ]);

          const result = await generate(section, report as any, context);

          if (result) {
            setGeneratedSections((prev) => [...prev, section]);
            onSectionGenerated(section, result);
            setMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "agent",
                content: `${label.charAt(0).toUpperCase() + label.slice(1)} ${section === "abbreviations" ? "extraites" : "généré" + (["dedicaces", "remerciements"].includes(section) ? "es" : "")} ✓`,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { id: newId(), role: "agent", content: `❌ Génération échouée pour ${label}. Réessaie.` },
            ]);
          }
        }

        if (action.type === "step_complete" && !stepCompleteRef.current) {
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

  // Auto-send on mount (for steps that generate immediately)
  useEffect(() => {
    if (autoSend && !autoSentRef.current) {
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
