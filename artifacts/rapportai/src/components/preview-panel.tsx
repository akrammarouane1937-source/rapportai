import { useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReportStore } from "@/lib/store";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { generatePdf } from "@/lib/generatePdf";
import { Download, FileText, Maximize2, Minimize2, Copy, CheckCheck, Loader2, Share2, Pencil, Eye } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";

interface PreviewPanelProps {
  activeSection: string;
  content?: string;
}

const SECTIONS = [
  { id: "page-de-garde", field: "pageDeGarde",   label: "Page de garde" },
  { id: "dedicaces",     field: "dedicaces",     label: "Dédicaces" },
  { id: "remerciements", field: "remerciements", label: "Remerciements" },
  { id: "resume",        field: "resumeFr",      label: "Résumé" },
  { id: "abstract",      field: "abstractEn",    label: "Abstract" },
  { id: "sommaire",      field: "sommaire",      label: "Sommaire" },
  { id: "introduction",  field: "introduction",  label: "Introduction" },
  { id: "partie-i",      field: "partieI",       label: "Partie I" },
  { id: "partie-ii",     field: "partieII",      label: "Partie II" },
  { id: "conclusion",    field: "conclusion",    label: "Conclusion" },
];

function splitIntoPages(text: string, wordsPerPage = 420): string[] {
  if (!text?.trim()) return [];
  const paragraphs = text.split(/\n\n+/);
  const pages: string[] = [];
  let current = "";
  let count = 0;
  for (const para of paragraphs) {
    const w = para.trim().split(/\s+/).filter(Boolean).length;
    if (count + w > wordsPerPage && current) {
      pages.push(current.trim());
      current = para;
      count = w;
    } else {
      current = current ? current + "\n\n" + para : para;
      count += w;
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages.length ? pages : [];
}

export function PreviewPanel({ activeSection, content }: PreviewPanelProps) {
  const { report, updateReport } = useReportStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to active section when it changes
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-section="${activeSection}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSection]);

  // Total words across all generated sections
  const allText = SECTIONS.map(({ field }) => (report as unknown as Record<string, string>)[field] || "").join(" ");
  const totalWords = allText.trim() ? allText.trim().split(/\s+/).filter(Boolean).length : 0;
  const totalPages = Math.max(1, Math.round(totalWords / 420));

  const handleDocx = async () => {
    if (exportingDocx) return;
    setExportingDocx(true);
    try {
      const blob = await generateDocx(report as any);
      const slug = report.theme?.slice(0, 40).replace(/\s+/g, "-").replace(/[^a-z0-9\-]/gi, "") || "rapport";
      downloadBlob(blob, `RapportAI-${slug}.docx`);
    } finally {
      setExportingDocx(false);
    }
  };

  const handlePdf = () => void generatePdf(report as any);

  const handleCopy = async () => {
    const currentText = SECTIONS.find(s => s.id === activeSection);
    const text = (currentText && (report as unknown as Record<string, string>)[currentText.field]) || content || "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await fetch(`${API_BASE}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      const url = `${window.location.origin}/share/${id}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  // Build all page cards across all sections
  let pageNumber = 1;
  const allPageCards: React.ReactNode[] = [];

  for (const { id, field } of SECTIONS) {
    const text = id === activeSection && content
      ? content
      : (report as unknown as Record<string, string>)[field] || "";

    if (!text.trim()) continue;

    // ── Cover page gets its own dedicated layout ──────────────────────────────
    if (id === "page-de-garde") {
      allPageCards.push(
        <div
          key="page-de-garde"
          data-section="page-de-garde"
          className="bg-white relative flex flex-col"
          style={{
            width: "21cm",
            maxWidth: "100%",
            minHeight: "29.7cm",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            marginBottom: "0.6cm",
            fontFamily: "Times New Roman, Times, serif",
            fontSize: "12pt",
            lineHeight: "1.6",
            color: "#111",
            padding: "2cm 2.5cm",
          }}
        >
          {/* Top accent bar */}
          <div style={{ height: 4, background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 2, marginBottom: "1.2cm" }} />

          <div
            className="flex-1 flex flex-col items-center"
            style={{ textAlign: "center" }}
          >
            <div
              className="cover-page-content w-full"
              style={{
                ["--cover-h1-size" as string]: "16pt",
                ["--cover-h2-size" as string]: "13pt",
              }}
            >
              <style>{`
                .cover-page-content h1 { font-size: 16pt; font-weight: 700; margin: 0.4cm 0; letter-spacing: -0.01em; }
                .cover-page-content h2 { font-size: 13pt; font-weight: 600; margin: 0.3cm 0; }
                .cover-page-content h3 { font-size: 12pt; font-weight: 600; margin: 0.25cm 0; }
                .cover-page-content p  { margin: 0.2cm 0; }
                .cover-page-content hr { border: none; border-top: 1px solid #d1d5db; margin: 0.5cm auto; width: 60%; }
                .cover-page-content strong { font-weight: 700; }
                .cover-page-content em { font-style: italic; }
              `}</style>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          </div>

          {/* Bottom accent bar */}
          <div style={{ height: 4, background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 2, marginTop: "1.2cm" }} />
        </div>
      );
      continue;
    }

    // ── All other sections: standard paginated cards ──────────────────────────
    const pages = splitIntoPages(text);
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx];
      const pn = pageNumber++;
      allPageCards.push(
        <div
          key={`${id}-${pn}`}
          {...(pageIdx === 0 ? { "data-section": id } : {})}
          className="bg-white word-preview-content relative"
          style={{
            width: "21cm",
            maxWidth: "100%",
            padding: "2.54cm 2.54cm 3cm 3cm",
            minHeight: "22cm",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            marginBottom: "0.6cm",
            fontFamily: "Times New Roman, Times, serif",
            fontSize: "12pt",
            lineHeight: "1.5",
            color: "#111",
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{pageText}</ReactMarkdown>
          <div
            className="absolute bottom-4 left-0 right-0 text-center text-xs"
            style={{ color: "#9ca3af", fontFamily: "Times New Roman, serif" }}
          >
            {pn}
          </div>
        </div>
      );
    }
  }

  // If nothing generated yet, show empty first page
  if (allPageCards.length === 0) {
    allPageCards.push(
      <div
        key="empty"
        className="bg-white flex flex-col items-center justify-center"
        style={{
          width: "21cm",
          maxWidth: "100%",
          minHeight: "22cm",
          padding: "2.54cm",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        }}
      >
        <span className="text-4xl mb-3" style={{ color: "#d1d5db" }}>···</span>
        <span className="text-sm italic" style={{ color: "#9ca3af" }}>Votre rapport apparaîtra ici</span>
      </div>
    );
  }

  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#374151",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  };

  return (
    <div
      className="flex flex-col min-h-0"
      style={{
        height: fullscreen ? "100vh" : "100%",
        position: fullscreen ? "fixed" : "relative",
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 50 : undefined,
        background: "#f1f5f9",
      }}
    >
      {/* Action toolbar */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2.5 gap-2 overflow-x-auto"
        style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", minHeight: "48px" }}
      >
        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
            <FileText style={{ width: 13, height: 13 }} />
            <span style={{ fontWeight: 600, color: "#111827" }}>{totalWords.toLocaleString("fr-FR")}</span>
            <span>mots</span>
          </div>
          <span style={{ color: "#e2e8f0" }}>·</span>
          <div className="text-xs" style={{ color: "#6b7280" }}>
            <span style={{ fontWeight: 600, color: "#111827" }}>{totalPages}</span> pages
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Copy section */}
          <button style={btnBase} onClick={handleCopy} title="Copier la section active">
            {copied ? <CheckCheck style={{ width: 13, height: 13, color: "#16a34a" }} /> : <Copy style={{ width: 13, height: 13 }} />}
            {copied ? "Copié !" : "Copier"}
          </button>

          {/* Share */}
          <button style={btnBase} onClick={handleShare} disabled={sharing} title="Lien de partage">
            {sharing ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Share2 style={{ width: 13, height: 13 }} />}
            Partager
          </button>

          {/* PDF */}
          <button
            style={{ ...btnBase, background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }}
            onClick={handlePdf}
            title="Télécharger PDF"
          >
            <Download style={{ width: 13, height: 13 }} />
            PDF
          </button>

          {/* Word */}
          <button
            style={{ ...btnBase, background: exportingDocx ? "#ede9fe" : "linear-gradient(135deg,#7c3aed,#a855f7)", borderColor: "transparent", color: "#fff" }}
            onClick={handleDocx}
            disabled={exportingDocx}
            title="Télécharger Word"
          >
            {exportingDocx ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Download style={{ width: 13, height: 13 }} />}
            {exportingDocx ? "Export..." : "Word .docx"}
          </button>

          {/* Edit toggle */}
          <button
            style={{ ...btnBase, ...(editMode ? { background: "#ecfdf5", borderColor: "#a7f3d0", color: "#059669" } : {}) }}
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? "Revenir à l'aperçu" : "Modifier le texte"}
          >
            {editMode ? <Eye style={{ width: 13, height: 13 }} /> : <Pencil style={{ width: 13, height: 13 }} />}
            {editMode ? "Aperçu" : "Modifier"}
          </button>

          {/* Fullscreen */}
          <button
            style={{ ...btnBase, padding: "6px 8px" }}
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Réduire" : "Plein écran"}
          >
            {fullscreen ? <Minimize2 style={{ width: 14, height: 14 }} /> : <Maximize2 style={{ width: 14, height: 14 }} />}
          </button>
        </div>
      </div>

      {/* Share URL toast */}
      {shareUrl && (
        <div className="shrink-0 px-4 py-2 text-xs font-mono truncate" style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", color: "#15803d" }}>
          {shareUrl} - lien copié ✓
        </div>
      )}

      {/* Document scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 py-6"
        style={{ background: editMode ? "#f8fafc" : "#d0d0d0" }}
      >
        {editMode ? (
          <div className="max-w-3xl mx-auto px-4 flex flex-col gap-5">
            <p className="text-xs text-gray-500 -mb-1">
              Modifie le texte de chaque section. Les changements sont sauvegardés automatiquement et repris dans l'export Word/PDF.
            </p>
            {SECTIONS.filter(({ field }) => ((report as unknown as Record<string, string>)[field] || "").trim()).map(({ id, field, label }) => (
              <div key={id} data-section={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-100 bg-gray-50">
                  {label}
                </div>
                <textarea
                  value={(report as unknown as Record<string, string>)[field] || ""}
                  onChange={(e) => updateReport({ [field]: e.target.value } as Partial<typeof report>)}
                  spellCheck
                  className="w-full px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none"
                  style={{ minHeight: "180px", fontFamily: "Times New Roman, Times, serif", color: "#111" }}
                />
              </div>
            ))}
            {SECTIONS.every(({ field }) => !((report as unknown as Record<string, string>)[field] || "").trim()) && (
              <div className="text-center text-sm text-gray-400 italic py-10">
                Aucun contenu à modifier pour l'instant — génère d'abord une section.
              </div>
            )}
            <div style={{ height: "2cm" }} />
          </div>
        ) : (
          <div className="flex flex-col items-center px-4">
            {allPageCards}
            <div style={{ height: "4cm" }} />
          </div>
        )}
      </div>
    </div>
  );
}
