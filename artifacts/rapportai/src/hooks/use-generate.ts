import { useState, useCallback } from "react";
import { Report } from "@/lib/store";

const BASE_URL = "https://rapportai-production.up.railway.app";
const SESSION_KEY = "rapportai_session";

interface ToolCall {
  name: string;
  status: "running" | "done";
}

// Tool label mapping
const TOOL_LABELS: Record<string, string> = {
  Read: "📖 Lecture du rapport",
  WebSearch: "🔍 Recherche académique",
  Write: "✍️ Rédaction en cours",
  Glob: "📂 Analyse des fichiers",
};

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] || name;
}

async function getOrCreateSession(): Promise<string> {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) return stored;

  const res = await fetch(`${BASE_URL}/api/session/new`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  const { sessionId } = await res.json();
  localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

export function useGenerate() {
  const [streamedContent, setStreamedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const setContent = useCallback((val: string) => {
    setStreamedContent(val);
  }, []);

  const generate = useCallback(
    async (
      section: string,
      reportData: Report,
      extraPrompt?: string,
      files?: File[]
    ) => {
      setIsGenerating(true);
      setStreamedContent("");
      setToolCalls([]);

      try {
        const sessionId = await getOrCreateSession();

        let response: Response;

        if (files && files.length > 0) {
          // Multipart/form-data when files are present
          const form = new FormData();
          form.append("section", section);
          form.append("reportData", JSON.stringify(reportData));
          if (extraPrompt) form.append("prompt", extraPrompt);
          for (const file of files) {
            form.append("files", file, file.name);
          }
          response = await fetch(
            `${BASE_URL}/api/session/${sessionId}/generate`,
            {
              method: "POST",
              body: form,
            }
          );
        } else {
          response = await fetch(
            `${BASE_URL}/api/session/${sessionId}/generate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                section,
                ...reportData,
                prompt: extraPrompt,
              }),
            }
          );
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (part.startsWith("data: ")) {
                try {
                  const data = JSON.parse(part.slice(6));
                  if (data.content) {
                    setStreamedContent((prev) => prev + data.content);
                  }
                  if (data.updatedContent) {
                    setStreamedContent(data.updatedContent);
                  }
                  if (data.tool_call) {
                    const label =
                      data.tool_call.name?.startsWith("pdf:")
                        ? `📄 Lecture de ${data.tool_call.name.slice(4)}`
                        : data.tool_call.name?.startsWith("image:")
                        ? `🖼️ Analyse de la figure`
                        : getToolLabel(data.tool_call.name);

                    setToolCalls((prev) => {
                      const existing = prev.findIndex(
                        (tc) => tc.name === label
                      );
                      const entry = {
                        name: label,
                        status: data.tool_call.status as "running" | "done",
                      };
                      if (existing !== -1) {
                        const updated = [...prev];
                        updated[existing] = entry;
                        return updated;
                      }
                      return [...prev, entry];
                    });
                  }
                  if (data.done) {
                    done = true;
                  }
                } catch {
                  // Ignore parse errors on incomplete chunks
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Generation failed:", error);
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return { generate, isGenerating, toolCalls, streamedContent, setContent };
}
