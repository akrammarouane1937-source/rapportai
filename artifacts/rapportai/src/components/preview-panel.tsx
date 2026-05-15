import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReportStore } from "@/lib/store";

interface PreviewPanelProps {
  activeSection: string;
  content?: string;
}

const SECTIONS = [
  { id: "dedicaces",     label: "Dédicaces",     field: "dedicaces" },
  { id: "remerciements", label: "Remerciements", field: "remerciements" },
  { id: "resume",        label: "Résumé",        field: "resumeFr" },
  { id: "abstract",      label: "Abstract",      field: "abstractEn" },
  { id: "sommaire",      label: "Sommaire",      field: "sommaire" },
  { id: "introduction",  label: "Introduction",  field: "introduction" },
  { id: "partie-i",      label: "Partie I",      field: "partieI" },
  { id: "partie-ii",     label: "Partie II",     field: "partieII" },
  { id: "conclusion",    label: "Conclusion",    field: "conclusion" },
];

// Split markdown text into page-sized chunks (~400 words per page)
// Splits on paragraph boundaries so no sentence is cut in half
function splitIntoPages(text: string, wordsPerPage = 400): string[] {
  if (!text.trim()) return [];
  const paragraphs = text.split(/\n\n+/);
  const pages: string[] = [];
  let current = "";
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount + words > wordsPerPage && current) {
      pages.push(current.trim());
      current = para;
      wordCount = words;
    } else {
      current = current ? current + "\n\n" + para : para;
      wordCount += words;
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages.length > 0 ? pages : [""];
}

let globalPageIndex = 1;

export function PreviewPanel({ activeSection, content }: PreviewPanelProps) {
  const { report } = useReportStore();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRefs.current[activeSection];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
    }
  }, [activeSection]);

  // Build all pages across all sections (for sequential page numbers)
  let pageCounter = 1;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 bg-background border-b overflow-x-auto shadow-sm">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              const el = sectionRefs.current[id];
              if (el && scrollRef.current) {
                scrollRef.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
              }
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              activeSection === id
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Scrollable document */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 py-6"
        style={{ background: "#d0d0d0" }}
      >
        <div className="flex flex-col items-center gap-3 px-4">
          {SECTIONS.map(({ id, label, field }) => {
            const text =
              id === activeSection && content
                ? content
                : (report as Record<string, string>)[field] || "";

            const pages = text ? splitIntoPages(text) : null;

            return (
              <div
                key={id}
                ref={(el) => { sectionRefs.current[id] = el; }}
                className="w-full flex flex-col items-center gap-3"
                style={{ maxWidth: "21cm" }}
              >
                {pages ? (
                  pages.map((pageText, pageIdx) => {
                    const thisPage = pageCounter++;
                    return (
                      <div
                        key={pageIdx}
                        className="w-full bg-white relative word-preview-content"
                        style={{
                          padding: "2.54cm 2.54cm 2.54cm 3cm",
                          minHeight: "20cm",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                        }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{pageText}</ReactMarkdown>
                        {/* Page number */}
                        <div
                          className="absolute bottom-4 w-full text-center text-xs text-gray-400"
                          style={{ left: 0 }}
                        >
                          {thisPage}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    className="w-full bg-white flex flex-col items-center justify-center"
                    style={{
                      minHeight: "12cm",
                      padding: "2.54cm",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }}
                  >
                    <span className="text-gray-300 text-4xl mb-2">···</span>
                    <span className="text-gray-300 text-sm italic">{label} — non encore généré</span>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ height: "4cm" }} />
        </div>
      </div>
    </div>
  );
}
