import { useRef, useState, useCallback } from "react";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

export type GenerateSection =
  | "partie-i"
  | "partie-ii"
  | "introduction"
  | "conclusion"
  | "resume"
  | "dedicaces"
  | "remerciements"
  | "laisser-ia";

export interface GenerateOptions {
  section: GenerateSection;
  theme?: string;
  school?: string;
  filiere?: string;
  problematique?: string;
  motsCles?: string[];
  citationStyle?: string;
  extraContext?: string;
}

const DEMO_CONTEXT: GenerateOptions = {
  theme: "Optimisation de portefeuille d'actifs financiers à la Bourse de Casablanca",
  school: "EMSI",
  filiere: "Finance",
  problematique: "Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée aux spécificités du marché boursier marocain ?",
  motsCles: ["optimisation", "portefeuille", "Markowitz", "MASI", "marché émergent"],
  citationStyle: "APA 7th ed.",
  section: "laisser-ia",
};

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function useGenerate(opts: {
  onChunk: (text: string) => void;
  onDone: () => void;
  onPaywall?: () => void;
  paywallWords?: number;
}) {
  const { onChunk, onDone, onPaywall, paywallWords } = opts;
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wordCountRef = useRef(0);
  const paywallTriggeredRef = useRef(false);

  const generate = useCallback(async (options: GenerateOptions) => {
    if (isStreaming) return;
    setIsStreaming(true);
    setError(null);
    wordCountRef.current = 0;
    paywallTriggeredRef.current = false;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const body = { ...DEMO_CONTEXT, ...options };
      const resp = await fetch(`${BASE_PATH}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

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
          const json = line.slice(6);
          try {
            const msg = JSON.parse(json) as { content?: string; done?: boolean; error?: string };
            if (msg.error) { setError(msg.error); break; }
            if (msg.done) { onDone(); break; }
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
          } catch {
            // malformed JSON chunk, skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, onChunk, onDone, onPaywall, paywallWords]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { generate, abort, isStreaming, error };
}
