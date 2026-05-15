import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReportStore } from "@/lib/store";

interface PreviewPanelProps {
  activeSection: string;
  content?: string;
}

const SECTIONS = [
  { id: "dedicaces",      label: "Dédicaces",      field: "dedicaces" },
  { id: "remerciements",  label: "Remerciements",  field: "remerciements" },
  { id: "resume",         label: "Résumé",         field: "resumeFr" },
  { id: "abstract",       label: "Abstract",       field: "abstractEn" },
  { id: "sommaire",       label: "Sommaire",       field: "sommaire" },
  { id: "introduction",   label: "Introduction",   field: "introduction" },
  { id: "partie-i",       label: "Partie I",       field: "partieI" },
  { id: "partie-ii",      label: "Partie II",      field: "partieII" },
  { id: "conclusion",     label: "Conclusion",     field: "conclusion" },
];

export function PreviewPanel({ activeSection, content }: PreviewPanelProps) {
  const { report } = useReportStore();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to active section when tab changes
  useEffect(() => {
    const el = sectionRefs.current[activeSection];
    if (el && scrollRef.current) {
      const container = scrollRef.current;
      const top = el.offsetTop - 24;
      container.scrollTo({ top, behavior: "smooth" });
    }
  }, [activeSection]);

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
                scrollRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 py-8 space-y-1" style={{ background: "#e8e8e8" }}>
        {SECTIONS.map(({ id, label, field }) => {
          const text = id === activeSection && content
            ? content
            : (report as Record<string, string>)[field] || "";

          return (
            <div
              key={id}
              ref={(el) => { sectionRefs.current[id] = el; }}
              className="mx-auto"
              style={{ width: "21cm", maxWidth: "100%" }}
            >
              {/* Page */}
              <div
                className="bg-white word-preview-content"
                style={{
                  padding: "2.5cm 2.5cm",
                  minHeight: "8cm",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
                  marginBottom: "0.5cm",
                }}
              >
                {text ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <span className="text-gray-300 text-3xl">···</span>
                    <span className="text-gray-300 text-sm italic">{label} — non encore généré</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: "4cm" }} />
      </div>
    </div>
  );
}
