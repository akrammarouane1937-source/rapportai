import { useState, useCallback, useRef } from "react";
import { API_BASE } from "@/lib/apiBase";
import { ensureSession } from "@/lib/useGenerate";
import { getReport } from "@/lib/reportStore";

export interface GeneratedPage {
  pageNum: number;
  content: string;
  status: "generating" | "pending" | "confirmed" | "revising";
}

export function usePageMode(sectionId: "partie-i" | "partie-ii") {
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const nextPageNumRef = useRef(1);

  const generateNextPage = useCallback(async () => {
    if (isGenerating || isRevising) return;
    const pageNum = nextPageNumRef.current;
    nextPageNumRef.current += 1;
    setIsGenerating(true);

    setPages(prev => [...prev, { pageNum, content: "", status: "generating" }]);

    try {
      const sessionId = await ensureSession();
      const resp = await fetch(`${API_BASE}/api/session/${sessionId}/next-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, page: pageNum }),
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let pageContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as {
              content?: string;
              done?: boolean;
              error?: string;
            };
            if (msg.error) throw new Error(msg.error);
            if (msg.content) {
              pageContent += msg.content;
              setPages(prev =>
                prev.map(p => p.pageNum === pageNum ? { ...p, content: pageContent } : p)
              );
            }
            if (msg.done) {
              setPages(prev =>
                prev.map(p => p.pageNum === pageNum ? { ...p, status: "pending" } : p)
              );
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      // Roll back the failed page
      setPages(prev => prev.filter(p => p.pageNum !== pageNum));
      nextPageNumRef.current -= 1;
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, isRevising, sectionId]);

  const confirmPage = useCallback((pageNum: number) => {
    setPages(prev =>
      prev.map(p => p.pageNum === pageNum ? { ...p, status: "confirmed" } : p)
    );
  }, []);

  const revisePage = useCallback(async (pageNum: number, instruction: string) => {
    const page = pages.find(p => p.pageNum === pageNum);
    if (!page || isRevising || isGenerating) return;
    setIsRevising(true);
    setPages(prev =>
      prev.map(p => p.pageNum === pageNum ? { ...p, status: "revising" } : p)
    );

    try {
      const r = getReport();
      const resp = await fetch(`${API_BASE}/api/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: page.content,
          instruction,
          sessionId: r.sessionId,
          sectionId,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let raw = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
            if (msg.content) raw += msg.content;
            if (msg.done) {
              // Extract <revised_section> block if present; fallback to full raw
              const match = raw.match(/<revised_section>([\s\S]*?)<\/revised_section>/);
              const finalContent = match ? match[1].trim() : raw.trim();
              setPages(prev =>
                prev.map(p =>
                  p.pageNum === pageNum
                    ? { ...p, content: finalContent, status: "pending" }
                    : p
                )
              );
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      // Revert to pending on error
      setPages(prev =>
        prev.map(p => p.pageNum === pageNum ? { ...p, status: "pending" } : p)
      );
    } finally {
      setIsRevising(false);
    }
  }, [pages, isRevising, isGenerating, sectionId]);

  const getAssembledContent = useCallback((): string => {
    return pages
      .filter(p => p.status === "confirmed" || p.status === "pending")
      .sort((a, b) => a.pageNum - b.pageNum)
      .map(p => p.content)
      .join("\n\n");
  }, [pages]);

  const resetPages = useCallback(() => {
    setPages([]);
    nextPageNumRef.current = 1;
  }, []);

  const allConfirmed = pages.length > 0 && pages.every(p => p.status === "confirmed");
  const lastPage = pages[pages.length - 1];
  const canGenerateNext =
    !isGenerating &&
    !isRevising &&
    (pages.length === 0 || lastPage?.status === "confirmed");

  return {
    pages,
    isGenerating,
    isRevising,
    generateNextPage,
    confirmPage,
    revisePage,
    getAssembledContent,
    resetPages,
    allConfirmed,
    canGenerateNext,
    totalPageCount: pages.length,
  };
}
