import {
  useState,
  useCallback,
  useRef,
  useEffect,
  createElement,
  type ReactNode,
} from "react";
import { useChat, Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type FileUIPart } from "ai";
import { API_BASE } from "@/lib/apiBase";
import { useGenerate } from "./use-generate";
import { useReportStore } from "@/lib/store";
import { useFileStore } from "@/lib/fileStore";
import { GeneratedCard, ChoiceCard } from "@/components/chat-panel";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  dedicaces: "Dédicaces",
  remerciements: "Remerciements",
  resume: "Résumé",
  abstract: "Abstract",
  sommaire: "Sommaire",
  introduction: "Introduction",
  "partie-i": "Partie I",
  "partie-ii": "Partie II",
  conclusion: "Conclusion",
  bibliographie: "Bibliographie",
  abbreviations: "Abréviations",
  "liste-figures": "Liste des figures",
  "liste-tableaux": "Liste des tableaux",
};

// ─── File processing → FileUIPart[] ──────────────────────────────────────────

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

async function processFilesToUIParts(
  files: File[],
): Promise<{ fileParts: FileUIPart[]; textParts: Array<{ type: "text"; text: string }> }> {
  const fileParts: FileUIPart[] = [];
  const textParts: Array<{ type: "text"; text: string }> = [];

  for (const file of files) {
    if (file.type === "application/pdf") {
      const data = await readAsBase64(file);
      fileParts.push({
        type: "file",
        mediaType: "application/pdf",
        filename: file.name,
        url: `data:application/pdf;base64,${data}`,
      });
      // Also extract first 3 pages as images so Claude sees figures/charts visually
      try {
        const formData = new FormData();
        formData.append("pdf", file, file.name);
        const previewResp = await fetch(`${API_BASE}/api/pdf-preview`, {
          method: "POST",
          body: formData,
        });
        if (previewResp.ok) {
          const { images } = (await previewResp.json()) as {
            images: Array<{ page: number; base64: string }>;
          };
          for (const img of images) {
            const imgData = img.base64.split(",")[1] ?? "";
            if (imgData) {
              fileParts.push({
                type: "file",
                mediaType: "image/png",
                url: `data:image/png;base64,${imgData}`,
              });
            }
          }
        }
      } catch { /* vision enhancement is best-effort */ }
    } else if (file.type.startsWith("image/")) {
      const data = await readAsBase64(file);
      fileParts.push({
        type: "file",
        mediaType: file.type,
        filename: file.name,
        url: `data:${file.type};base64,${data}`,
      });
    } else if (
      file.type === "text/plain" ||
      file.type === "text/markdown" ||
      file.type === "text/csv" ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md")
    ) {
      const text = await file.text();
      textParts.push({
        type: "text",
        text: `=== Fichier joint : ${file.name} ===\n${text}`,
      });
    } else if (
      file.name.endsWith(".docx") ||
      file.name.endsWith(".doc") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword"
    ) {
      try {
        type MammothImage = { contentType: string; read: (enc: string) => Promise<string> };
        type MammothApi = {
          convertToHtml: (opts: {
            arrayBuffer: ArrayBuffer;
            convertImage: unknown;
          }) => Promise<{ value: string }>;
          extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
          images: {
            inline: (fn: (img: MammothImage) => Promise<Record<string, never>>) => unknown;
            imgElement: (fn: (img: MammothImage) => Promise<{ src: string }>) => unknown;
          };
        };
        const mammoth = (await import("mammoth")) as unknown as MammothApi;
        const arrayBuffer = await file.arrayBuffer();

        // Extract embedded images (logos, header graphics)
        const extractedImages: Array<{ contentType: string; data: string }> = [];
        let htmlWithImages = "";
        try {
          const htmlResult = await mammoth.convertToHtml({
            arrayBuffer,
            convertImage: mammoth.images.imgElement(async (image) => {
              const data = await image.read("base64");
              extractedImages.push({ contentType: image.contentType, data });
              return { src: `data:${image.contentType};base64,${data}` };
            }),
          });
          htmlWithImages = htmlResult.value;
        } catch { /* ignore */ }

        const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        for (const img of extractedImages.slice(0, 3)) {
          const mediaType = supported.includes(img.contentType) ? img.contentType : "image/png";
          fileParts.push({
            type: "file",
            mediaType: mediaType as FileUIPart["mediaType"],
            url: `data:${mediaType};base64,${img.data}`,
          });
        }

        // html2canvas screenshot for full visual layout
        try {
          const wrapper = document.createElement("div");
          wrapper.style.cssText =
            "position:fixed;top:0;left:0;width:700px;opacity:0;pointer-events:none;z-index:-1;" +
            "background:#fff;padding:40px 56px;font-family:'Times New Roman',serif;" +
            "font-size:13px;line-height:1.5;color:#000;";
          wrapper.innerHTML = htmlWithImages || "<p>Template chargé</p>";
          document.body.appendChild(wrapper);

          const imgs = Array.from(wrapper.querySelectorAll("img"));
          if (imgs.length > 0) {
            await Promise.all(
              imgs.map((img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise<void>((res) => {
                      img.onload = () => res();
                      img.onerror = () => res();
                    }),
              ),
            );
          }
          await new Promise<void>((res) => requestAnimationFrame(() => res()));

          const h2c = await import("html2canvas");
          const canvas = await h2c.default(wrapper, {
            scale: 1.0,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: 700,
          });
          document.body.removeChild(wrapper);

          const MAX_W = 900;
          let finalCanvas = canvas;
          if (canvas.width > MAX_W) {
            const ratio = MAX_W / canvas.width;
            const resized = document.createElement("canvas");
            resized.width = MAX_W;
            resized.height = Math.round(canvas.height * ratio);
            resized.getContext("2d")?.drawImage(canvas, 0, 0, resized.width, resized.height);
            finalCanvas = resized;
          }
          const jpeg = finalCanvas.toDataURL("image/jpeg", 0.75).split(",")[1];
          if (jpeg && jpeg.length > 100) {
            fileParts.push({
              type: "file",
              mediaType: "image/jpeg",
              url: `data:image/jpeg;base64,${jpeg}`,
            });
            try {
              const binary = atob(jpeg);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              const screenshotFile = new File([bytes], "template-screenshot.jpg", {
                type: "image/jpeg",
              });
              useFileStore.getState().addFiles([screenshotFile]);
            } catch { /* non-blocking */ }
          }
        } catch { /* screenshot failed */ }

        const textResult = await mammoth.extractRawText({ arrayBuffer });
        if (textResult.value.trim()) {
          textParts.push({
            type: "text",
            text: `=== Contenu du fichier ${file.name} ===\n${textResult.value}`,
          });
          try {
            const textFile = new File([textResult.value], "template-text.txt", {
              type: "text/plain",
            });
            useFileStore.getState().addFiles([textFile]);
          } catch { /* non-blocking */ }
        }
      } catch {
        try {
          const mammoth = (await import("mammoth")) as unknown as {
            extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
          };
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          if (result.value.trim()) {
            textParts.push({
              type: "text",
              text: `=== Contenu du fichier ${file.name} ===\n${result.value}`,
            });
          }
        } catch { /* skip */ }
      }
    }
  }

  return { fileParts, textParts };
}

// ─── ID generator ────────────────────────────────────────────────────────────

let msgIdCounter = 0;
const newId = () => `dm-${++msgIdCounter}`;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversation({
  step,
  initialMessage,
  autoSend,
  onSectionGenerated,
  onStepComplete,
}: UseConversationOpts) {
  const { report } = useReportStore();

  const STORAGE_KEY = `rapportai_chat_step${step}`;

  // ── Refs for dynamic values (stale-closure prevention) ───────────────────
  const stepRef = useRef(step);
  const profileRef = useRef(report);
  const generatedSectionsRef = useRef<string[]>([]);
  const onSectionGeneratedRef = useRef(onSectionGenerated);
  const onStepCompleteRef = useRef(onStepComplete);
  const generateRef = useRef<ReturnType<typeof useGenerate>["generate"] | null>(null);
  // Track if any generation in the current AI turn failed (block step_complete)
  const genFailedRef = useRef(false);
  // Prevent duplicate step_complete calls
  const stepCompleteRef = useRef(false);
  // Always-current ref to `send` so ChoiceCard callbacks never go stale
  const sendRef = useRef<(text: string) => void>(() => {});
  // Status ref to avoid stale closures in send()
  const statusRef = useRef<"submitted" | "streaming" | "ready" | "error">("ready");
  // isGenerating ref to avoid stale closures in send()
  const isGeneratingRef = useRef(false);
  // Set of assistant message IDs already added to displayMessages (prevents double-add)
  const addedMsgIdsRef = useRef(new Set<string>());

  // Keep all refs in sync with latest values
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    profileRef.current = report;
  }, [report]);
  useEffect(() => {
    onSectionGeneratedRef.current = onSectionGenerated;
  }, [onSectionGenerated]);
  useEffect(() => {
    onStepCompleteRef.current = onStepComplete;
  }, [onStepComplete]);

  // ── Display messages state ────────────────────────────────────────────────
  const [displayMessages, setDisplayMessages] = useState<ConvMsg[]>(() => {
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

  const [generatedSections, setGeneratedSections] = useState<string[]>([]);

  // ── Persist display messages to localStorage + Zustand ───────────────────
  useEffect(() => {
    try {
      const serializable = displayMessages
        .filter((m) => typeof m.content === "string")
        .map((m) => ({
          id: m.id,
          role: m.role as "agent" | "user",
          content: m.content as string,
        }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
      const existing = useReportStore.getState().report.chatHistories ?? {};
      useReportStore.getState().updateReport({
        chatHistories: { ...existing, [String(step)]: serializable },
      });
    } catch { /* quota/unavailable */ }
  }, [displayMessages, STORAGE_KEY, step]);

  // ── useGenerate hook ──────────────────────────────────────────────────────
  const { generate, abort: abortGen, isGenerating, toolCalls, thinkingText } = useGenerate();
  // Keep generateRef always pointing to the latest function
  generateRef.current = generate;
  // Keep isGeneratingRef in sync
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // ── Restore history into UIMessages for Chat initialization ───────────────
  // We restore text-only messages so the AI has conversation context on refresh
  const initialUIMessages = useRef<UIMessage[]>(
    (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Array<{ id: string; role: string; content: string }>;
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
              .filter((m) => typeof m.content === "string" && m.content.trim())
              .map((m) => ({
                id: m.id,
                role: (m.role === "agent" ? "assistant" : "user") as "user" | "assistant",
                parts: [{ type: "text" as const, text: m.content }],
              })) as UIMessage[];
          }
        }
      } catch { /* ignore */ }
      return [] as UIMessage[];
    })(),
  );

  // ── addToolOutput ref (populated after useChat, used inside onToolCall) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToolOutputRef = useRef<((toolCallId: string, toolName: string, output: unknown) => void) | null>(null);

  // ── Create Chat instance once (with tool call handling) ───────────────────
  const chatRef = useRef<Chat<UIMessage> | null>(null);
  if (!chatRef.current) {
    // Pre-register restored assistant message IDs to prevent double-adding on first render
    for (const msg of initialUIMessages.current) {
      if (msg.role === "assistant") {
        addedMsgIdsRef.current.add(msg.id);
      }
    }

    chatRef.current = new Chat<UIMessage>({
      messages: initialUIMessages.current,
      transport: new DefaultChatTransport<UIMessage>({
        api: `${API_BASE}/api/converse`,
        body: () => ({
          step: stepRef.current,
          profile: profileRef.current,
          generatedSections: generatedSectionsRef.current,
        }),
        // Strip file parts from history messages to avoid large payloads on each turn
        fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
          if (options?.body && typeof options.body === "string") {
            try {
              const body = JSON.parse(options.body) as {
                messages?: Array<{ role: string; parts?: unknown[] }>;
              };
              if (Array.isArray(body.messages)) {
                const msgs = body.messages;
                body.messages = msgs.map(
                  (msg: { role: string; parts?: unknown[] }, i: number) => {
                    // Keep file parts only in the LAST user message
                    if (i < msgs.length - 1 && msg.role === "user" && Array.isArray(msg.parts)) {
                      return {
                        ...msg,
                        parts: msg.parts.filter(
                          (p: unknown) =>
                            (p as { type?: string }).type === "text" ||
                            (p as { type?: string }).type === "step-start",
                        ),
                      };
                    }
                    return msg;
                  },
                );
              }
              const modifiedOptions = { ...options, body: JSON.stringify(body) };
              return fetch(url, modifiedOptions);
            } catch { /* ignore parse errors */ }
          }
          return fetch(url, options);
        },
      }),

      // Handle tool calls from the AI (static tools — no server-side execute).
      // onToolCall MUST return void — results are sent via addToolOutputRef.
      onToolCall: async (options: { toolCall: { toolName: string; toolCallId: string; input: unknown } }) => {
        const { toolName, toolCallId, input } = options.toolCall as {
          toolName: string;
          toolCallId: string;
          input: Record<string, unknown>;
        };

        if (toolName === "generate_section") {
          const section = input.section as string;
          const context = input.context as string;
          const gen = generateRef.current;

          if (!gen) {
            genFailedRef.current = true;
            addToolOutputRef.current?.(toolCallId, toolName, { success: false, error: "Generator not ready" });
            return;
          }

          const label = SECTION_LABELS[section] ?? section;
          const result = await gen(
            section,
            profileRef.current as Parameters<typeof gen>[1],
            context,
            undefined,
            undefined,
            { onError: () => {} },
          );

          if (result) {
            const newSections = [...generatedSectionsRef.current, section];
            generatedSectionsRef.current = newSections;
            setGeneratedSections(newSections);
            onSectionGeneratedRef.current(section, result);

            const wordCount = result.split(/\s+/).filter(Boolean).length;
            const snippet = result
              .replace(/^#+\s*/gm, "")
              .replace(/\*\*/g, "")
              .trim()
              .slice(0, 300);
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "agent" as const,
                content: createElement(GeneratedCard, { label, wordCount, snippet }),
              },
            ]);
            addToolOutputRef.current?.(toolCallId, toolName, { success: true });
          } else {
            genFailedRef.current = true;
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "agent" as const,
                content: `**La génération de ${label} n'a pas abouti.**\n\nDis-moi "réessaie" et je relance.`,
              },
            ]);
            addToolOutputRef.current?.(toolCallId, toolName, { success: false, error: "Generation failed" });
          }
          return;
        }

        if (toolName === "ask_user") {
          const question = input.question as string;
          const choices = input.choices as string[];
          if (question && Array.isArray(choices) && choices.length > 0) {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "agent" as const,
                content: createElement(ChoiceCard, {
                  question,
                  choices,
                  onChoice: (c: string) => sendRef.current(c),
                }),
              },
            ]);
          }
          addToolOutputRef.current?.(toolCallId, toolName, { acknowledged: true });
          return;
        }

        if (toolName === "step_complete") {
          const message = (input.message as string) || "Étape terminée";
          // Only advance if no generation failed in this turn
          if (!stepCompleteRef.current && !genFailedRef.current) {
            stepCompleteRef.current = true;
            setDisplayMessages((prev) => [
              ...prev,
              { id: newId(), role: "agent" as const, content: message },
            ]);
            onStepCompleteRef.current();
          }
          // Reset failure flag for next turn
          genFailedRef.current = false;
          addToolOutputRef.current?.(toolCallId, toolName, { acknowledged: true });
          return;
        }

        addToolOutputRef.current?.(toolCallId, toolName, {});
      },

      // Never auto-resubmit after tool results (we handle step transitions manually)
      sendAutomaticallyWhen: () => false,
    });
  }

  // ── useChat hook ──────────────────────────────────────────────────────────
  const { messages: chatMessages, sendMessage, stop, status, addToolOutput } = useChat({
    chat: chatRef.current,
  });

  // Wire addToolOutputRef so onToolCall (inside Chat constructor) can call it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addToolOutputRef.current = (toolCallId: string, toolName: string, output: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (addToolOutput as any)({ toolCallId, tool: toolName, output, state: "output-available" });
  };

  // Keep statusRef in sync with latest status
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // ── Sync streaming AI text → displayMessages ──────────────────────────────
  useEffect(() => {
    if (!chatMessages.length) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.role !== "assistant") return;

    // Extract text from parts
    const textContent = (lastMsg.parts as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("");

    if (!textContent.trim()) return;

    if (!addedMsgIdsRef.current.has(lastMsg.id)) {
      // New assistant message — add to display
      addedMsgIdsRef.current.add(lastMsg.id);
      setDisplayMessages((prev) => [
        ...prev,
        { id: lastMsg.id, role: "agent" as const, content: textContent },
      ]);
    } else {
      // Update streaming text in-place
      setDisplayMessages((prev) =>
        prev.map((m) => (m.id === lastMsg.id ? { ...m, content: textContent } : m)),
      );
    }
  }, [chatMessages]);

  // ── Send function ─────────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string, files?: File[], _opts?: { silent?: boolean }) => {
      // Guard using refs to avoid stale closures
      if (statusRef.current !== "ready" && statusRef.current !== "error") return;
      if (isGeneratingRef.current) return;

      const isSilent = _opts?.silent;
      const trimmed = text.trim();

      // Persist uploaded files to fileStore for generation agents
      if (files?.length) {
        useFileStore.getState().addFiles(files);
      }

      // Process files into UIMessage parts
      const { fileParts, textParts } =
        files?.length ? await processFilesToUIParts(files) : { fileParts: [], textParts: [] };

      // Build display label (text-only, no binary)
      const fileLabel = files?.length ? files.map((f) => `[${f.name}]`).join(" ") : "";
      const displayContent = [trimmed, fileLabel].filter(Boolean).join(" ") || "(fichier)";

      if (!isSilent) {
        setDisplayMessages((prev) => [
          ...prev,
          { id: newId(), role: "user" as const, content: displayContent },
        ]);
      }

      // Reset generation failure flag for new turn
      genFailedRef.current = false;

      // Build message with all parts (text + files)
      const hasFiles = fileParts.length > 0 || textParts.length > 0;

      if (hasFiles) {
        // Use full parts-based sendMessage for messages with files
        const allParts: Array<
          { type: "text"; text: string } | { type: "file"; mediaType: string; url: string; filename?: string }
        > = [];
        if (trimmed) allParts.push({ type: "text", text: trimmed });
        allParts.push(...textParts);
        allParts.push(
          ...fileParts.map((fp) => ({
            type: "file" as const,
            mediaType: fp.mediaType,
            url: fp.url,
            filename: fp.filename,
          })),
        );
        if (allParts.length === 0) allParts.push({ type: "text", text: "(fichier joint)" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await sendMessage({ parts: allParts } as any);
      } else {
        // Simple text message
        await sendMessage({ text: trimmed || "(message)" });
      }
    },
    [sendMessage],
  );

  // Keep sendRef always current (stale-closure fix for ChoiceCard)
  useEffect(() => {
    sendRef.current = (text: string) => void send(text);
  }, [send]);

  // ── Auto-send on mount ────────────────────────────────────────────────────
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (autoSend && !autoSentRef.current && displayMessages.length <= 1) {
      autoSentRef.current = true;
      void send(autoSend, undefined, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Abort ────────────────────────────────────────────────────────────────
  const abort = useCallback(() => {
    stop();
    abortGen();
  }, [stop, abortGen]);

  const isThinking = status === "streaming" || status === "submitted";

  return {
    messages: displayMessages,
    send,
    abort,
    isThinking,
    isGenerating,
    toolCalls,
    thinkingText,
    generatedSections,
  };
}
