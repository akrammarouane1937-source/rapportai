import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReportStore } from "@/lib/store";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { generatePdf } from "@/lib/generatePdf";
import { Download, FileText, Maximize2, Minimize2, Copy, CheckCheck, Loader2, Share2 } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";

interface PreviewPanelProps {
  activeSection: string;
  content?: string;
}

const SECTIONS = [
  { id: "dedicaces",     field: "dedicaces" },
  { id: "remerciements", field: "remerciements" },
  { id: "resume",        field: "resumeFr" },
  { id: "abstract",      field: "abstractEn" },
  { id: "sommaire",      field: "sommaire" },
  { id: "introduction",  field: "introduction" },
  { id: "partie-i",      field: "partieI" },
  { id: "partie-ii",     field: "partieII" },
  { id: "conclusion",    field: "conclusion" },
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
  const { report } = useReportStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Total words across all generated sections
  const allText = SECTIONS.map(({ field }) => (report as Record<string, string>)[field] || "").join(" ");
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

  const handlePdf = () => generatePdf(report as any);

  const handleCopy = async () => {
    const currentText = SECTIONS.find(s => s.id === activeSection);
    const text = (currentText && (report as Record<string, string>)[currentText.field]) || content || "";
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
      : (report as Record<string, string>)[field] || "";

    const pages = splitIntoPages(text);
    if (pages.length === 0) continue;

    for (const pageText of pages) {
      const pn = pageNumber++;
      allPageCards.push(
        <div
          key={`${id}-${pn}`}
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
          {shareUrl} — lien copié ✓
        </div>
      )}

      {/* Document scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 py-6"
        style={{ background: "#d0d0d0" }}
      >
        <div className="flex flex-col items-center px-4">
          {allPageCards}
          <div style={{ height: "4cm" }} />
        </div>
      </div>
    </div>
  );
}
