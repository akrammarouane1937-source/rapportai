import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "wouter";

interface PreviewPanelProps {
  activeSection: string;
  content: string;
}

const TABS = [
  { id: "dedicaces", label: "Dédicaces" },
  { id: "remerciements", label: "Remerciements" },
  { id: "resume", label: "Résumé" },
  { id: "abstract", label: "Abstract" },
  { id: "sommaire", label: "Sommaire" },
  { id: "introduction", label: "Introduction" },
  { id: "partie-i", label: "Partie I" },
  { id: "partie-ii", label: "Partie II" },
  { id: "conclusion", label: "Conclusion" },
];

export function PreviewPanel({ activeSection, content }: PreviewPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#f3f4f6]">
      {/* Tabs Header */}
      <div className="flex items-center gap-1 px-4 py-2 bg-background border-b overflow-x-auto no-scrollbar shadow-sm z-10">
        {TABS.map((tab) => {
          let href = `/rapport/step-3`;
          if (tab.id === "resume" || tab.id === "abstract") href = `/rapport/step-4`;
          else if (tab.id === "sommaire") href = `/rapport/step-5`;
          else if (tab.id === "introduction") href = `/rapport/step-6`;
          else if (tab.id === "partie-i") href = `/rapport/partie-i`;
          else if (tab.id === "partie-ii") href = `/rapport/partie-ii`;
          else if (tab.id === "conclusion") href = `/rapport/step-9`;

          return (
            <Link key={tab.id} href={href}>
              <div
                className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  activeSection === tab.id
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-[21cm] min-h-[29.7cm] mx-auto bg-white shadow-sm ring-1 ring-black/5 p-8 md:p-12 pb-24 my-4">
          <div className="prose prose-slate max-w-none font-serif text-[11pt] leading-relaxed">
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <div className="text-muted-foreground italic text-center py-20">
                La section {TABS.find(t => t.id === activeSection)?.label.toLowerCase()} apparaîtra ici une fois générée.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
