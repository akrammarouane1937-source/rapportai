import { useRef, useState, useCallback } from "react";
import { getReport } from "@/lib/reportStore";

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
  // Callers may override any field; everything else is auto-filled from the store
  theme?: string;
  school?: string;
  filiere?: string;
  problematique?: string;
  motsCles?: string[];
  citationStyle?: string;
  extraContext?: string;
}

/** Fallback demo context — used when the store has no data yet */
const DEMO: Record<string, unknown> = {
  reportType:   "PFE",
  theme:        "Optimisation de portefeuille d'actifs financiers à la Bourse de Casablanca",
  school:       "EMSI",
  filiere:      "Finance",
  annee:        "2023–2024",
  studentName:  "Youssef El Amrani",
  encadrantPeda:"Pr. Mohamed Alami",
  encadrantPro: "M. Karim Benali",
  entreprise:   "Attijariwafa Bank",
  ville:        "Casablanca",
  problematique:"Dans quelle mesure la théorie moderne du portefeuille peut-elle être appliquée aux spécificités du marché boursier marocain ?",
  motsCles:     ["optimisation", "portefeuille", "Markowitz", "MASI", "marché émergent"],
  citationStyle:"APA 7th ed.",
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
      // Load everything from the store so Claude has maximum context
      const stored = getReport();

      const body = {
        // 1. Demo defaults (lowest priority — only when store is empty)
        ...DEMO,
        // 2. Stored user data (the real profile + previously generated sections)
        reportType:    stored.reportType,
        theme:         stored.theme,
        school:        stored.school,
        filiere:       stored.filiere,
        annee:         stored.annee,
        studentName:   stored.studentName,
        encadrantPeda: stored.encadrantPeda,
        encadrantPro:  stored.encadrantPro,
        entreprise:    stored.entreprise,
        ville:         stored.ville,
        citationStyle: stored.citationStyle,
        motsCles:      stored.motsCles,
        // Previously generated sections → Claude can cross-reference them
        resume:        stored.resume,
        introduction:  stored.introduction,
        partieI:       stored.partieI,
        partieII:      stored.partieII,
        // 3. Explicit call-site options override everything
        ...options,
      };

      // Strip undefined so JSON body stays clean
      const cleanBody = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      );

      const resp = await fetch(`${BASE_PATH}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanBody),
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
            if (msg.done)  { onDone(); break; }
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
