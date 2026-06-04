import type { ReportData } from "./reportStore";
import { jsPDF } from "jspdf";
import { API_BASE } from "./apiBase";

interface TocEntry {
  title: string;
  level: number; // 1 = main section, 2 = h2, 3 = h3
  page: number;
}

interface SectionData {
  title: string;
  content: string;
}

interface AnnexeItem {
  title?: string;
  content?: string;
}

type RGB = [number, number, number];

const MARGIN_L = 25;
const MARGIN_R = 20;
const MARGIN_T = 25;
const PAGE_W   = 210;
const PAGE_H   = 297;
const USABLE_W = PAGE_W - MARGIN_L - MARGIN_R;

// ─── Figure image helpers (mirrors generateDocx.ts approach) ─────────────────
// Figures referenced as ![alt](figures/name.png) in section markdown are
// fetched from the session API and embedded inline in the PDF.
// Strategy: pre-fetch all images BEFORE rendering (async), then embed
// synchronously during renderSections (jsPDF.addImage is sync).

function collectFigurePathsPdf(md: string): string[] {
  const paths: string[] = [];
  const re = /!\[[^\]]*\]\((figures\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (!paths.includes(m[1])) paths.push(m[1]);
  }
  return paths;
}

async function fetchFigureBase64(sessionId: string, figurePath: string): Promise<string | null> {
  try {
    const filename = figurePath.split("/").pop();
    if (!filename) return null;
    const url = `${API_BASE}/api/session/${sessionId}/figures/${filename}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  } catch {
    return null;
  }
}

async function prefetchFigureImagesPdf(
  sessionId: string | undefined,
  sections: SectionData[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!sessionId) return map;
  const allMd = sections.map((s) => s.content).join("\n");
  const paths = collectFigurePathsPdf(allMd);
  if (paths.length === 0) return map;
  await Promise.all(
    paths.map(async (p) => {
      const b64 = await fetchFigureBase64(sessionId, p);
      if (b64) map.set(p, b64);
    }),
  );
  return map;
}

const SECTION_COLORS: Record<string, RGB> = {
  "Dédicaces":           [168, 85,  247],
  "Remerciements":       [139, 92,  246],
  "Résumé":              [99,  102, 241],
  "Introduction":        [124, 58,  237],
  "Partie I":            [37,  99,  235],
  "Partie II":           [8,   145, 178],
  "Conclusion":          [5,   150, 105],
  "Bibliographie":       [107, 114, 128],
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function getPageCount(doc: jsPDF): number {
  return (doc as unknown as { internal: { getNumberOfPages(): number } })
    .internal.getNumberOfPages();
}

function curPage(doc: jsPDF): number {
  return (doc as unknown as { internal: { getCurrentPageInfo(): { pageNumber: number } } })
    .internal.getCurrentPageInfo().pageNumber;
}

/**
 * Renders all content sections onto `doc` (each section starts on a new page).
 * Returns the collected TOC entries with page numbers relative to `doc`.
 *
 * IMPORTANT: renderSections always calls newPage() before the first section,
 * so if doc is fresh (starts on page 1) the first entry lands on page 2.
 */
function renderSections(
  doc: jsPDF,
  sections: SectionData[],
  annexeItems: AnnexeItem[],
  figureMap?: Map<string, string>,
): TocEntry[] {
  let y = MARGIN_T;
  const entries: TocEntry[] = [];

  const newPage = () => { doc.addPage(); y = MARGIN_T; };
  const checkY  = (needed: number) => { if (y + needed > PAGE_H - 20) newPage(); };

  const cleanInline = (t: string) =>
    t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");

  function renderContent(md: string, baseIndent = 0): void {
    const lines = md.split("\n");
    let buf = "";

    const flushBuf = () => {
      const trimmed = buf.trim();
      if (!trimmed) { buf = ""; return; }
      const text = cleanInline(trimmed);
      const wrapped = doc.splitTextToSize(text, USABLE_W - baseIndent);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      for (const line of wrapped) {
        checkY(6);
        doc.text(line, MARGIN_L + baseIndent, y);
        y += 6;
      }
      buf = "";
    };

    for (const raw of lines) {
      const line = raw.trimEnd();

      if (line.startsWith("### ")) {
        flushBuf();
        const heading = cleanInline(line.slice(4).trim());
        checkY(12);
        entries.push({ title: heading, level: 3, page: curPage(doc) });
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(80, 80, 110);
        const wrapped = doc.splitTextToSize(heading, USABLE_W - 8);
        doc.text(wrapped, MARGIN_L + 8, y);
        y += wrapped.length * 6.5 + 3;

      } else if (line.startsWith("## ")) {
        flushBuf();
        const heading = cleanInline(line.slice(3).trim());
        checkY(14);
        entries.push({ title: heading, level: 2, page: curPage(doc) });
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(55, 55, 110);
        const wrapped = doc.splitTextToSize(heading, USABLE_W);
        doc.text(wrapped, MARGIN_L, y);
        y += wrapped.length * 7 + 3;

      } else if (line.startsWith("# ")) {
        flushBuf();

      } else if (/^[-*]\s+/.test(line)) {
        flushBuf();
        const item = cleanInline(line.replace(/^[-*]\s+/, ""));
        const wrapped = doc.splitTextToSize(`• ${item}`, USABLE_W - 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        for (const l of wrapped) {
          checkY(6);
          doc.text(l, MARGIN_L + 5, y);
          y += 6;
        }

      } else if (/^!\[[^\]]*\]\(figures\/[^)]+\)$/.test(line)) {
        // Markdown image referencing a session figure — embed inline if available
        flushBuf();
        const imgMatch = line.match(/^!\[[^\]]*\]\((figures\/[^)]+)\)$/);
        if (imgMatch) {
          const imgPath = imgMatch[1];
          const b64 = figureMap?.get(imgPath);
          if (b64) {
            // Default display dimensions: max 130mm wide, 85mm tall (portrait A4 safe)
            const imgW = Math.min(USABLE_W - baseIndent, 130);
            const imgH = 85;
            checkY(imgH + 10);
            doc.addImage(b64, "PNG", MARGIN_L + (USABLE_W - imgW) / 2, y, imgW, imgH);
            y += imgH + 5;
          } else {
            // Image not available — render caption-style placeholder
            checkY(10);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            doc.setTextColor(140, 140, 140);
            doc.text(`[${imgPath}]`, MARGIN_L + baseIndent, y);
            y += 7;
          }
        }

      } else if (line === "") {
        flushBuf();
        y += 2;

      } else {
        buf += (buf ? " " : "") + line;
      }
    }
    flushBuf();
  }

  for (const { title, content } of sections) {
    newPage();
    const color: RGB = SECTION_COLORS[title] ?? [124, 58, 237];
    entries.push({ title, level: 1, page: curPage(doc) });

    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(MARGIN_L, y, USABLE_W, 0.5, "F");
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title.toUpperCase(), MARGIN_L, y);
    y += 9;

    renderContent(content);
  }

  for (let i = 0; i < annexeItems.length; i++) {
    const item = annexeItems[i];
    const letter = LETTERS[i] ?? String(i + 1);
    const title = item.title?.trim() || `Annexe ${letter}`;

    newPage();
    const annexeColor: RGB = [107, 114, 128];
    entries.push({ title: `Annexe ${letter} — ${title}`, level: 1, page: curPage(doc) });

    doc.setFillColor(107, 114, 128);
    doc.rect(MARGIN_L, y, USABLE_W, 0.5, "F");
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(annexeColor[0], annexeColor[1], annexeColor[2]);
    doc.text(`ANNEXE ${letter} — ${title.toUpperCase()}`, MARGIN_L, y);
    y += 9;

    if (item.content?.trim()) {
      renderContent(item.content);
    }
  }

  return entries;
}

/**
 * Renders a TOC page (or pages) onto `doc`.
 * Returns the number of pages consumed so callers can account for it.
 */
function renderTocPage(doc: jsPDF, entries: TocEntry[]): number {
  const startPage = curPage(doc);
  let y = MARGIN_T;

  doc.setFillColor(124, 58, 237);
  doc.rect(MARGIN_L, y, USABLE_W, 1, "F");
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(124, 58, 237);
  doc.text("TABLE DES MATIÈRES", MARGIN_L, y);
  y += 10;

  for (const entry of entries) {
    if (y + 8 > PAGE_H - 20) {
      doc.addPage();
      y = MARGIN_T;
    }

    const indent    = entry.level === 1 ? 0 : entry.level === 2 ? 8 : 15;
    const fontSize  = entry.level === 1 ? 11 : entry.level === 2 ? 10.5 : 10;
    const isBold    = entry.level === 1;

    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(entry.level === 1 ? 26 : entry.level === 2 ? 50 : 70, 26, 46);

    const pageStr  = String(entry.page);
    const rightX   = PAGE_W - MARGIN_R;

    const maxTitleW = USABLE_W - indent - doc.getTextWidth(pageStr) - 8;
    let titleText = entry.title;
    while (doc.getTextWidth(titleText) > maxTitleW && titleText.length > 5) {
      titleText = titleText.slice(0, -1);
    }
    if (titleText !== entry.title) titleText = titleText.trimEnd() + "…";

    const textX  = MARGIN_L + indent;
    const textW  = doc.getTextWidth(titleText);
    const lineH  = fontSize * 0.352778; // pt → mm

    doc.text(titleText, textX, y);

    // Clickable link: covers the title text
    doc.link(textX, y - lineH, textW, lineH + 1, { pageNumber: entry.page });

    // Dot leaders
    const titleEndX  = textX + textW + 2;
    const dotW       = doc.getTextWidth(".");
    const dotAreaEnd = rightX - doc.getTextWidth(pageStr) - 3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(190, 190, 210);
    let dx = titleEndX;
    while (dx + dotW < dotAreaEnd) {
      doc.text(".", dx, y);
      dx += dotW + 0.5;
    }

    // Page number (also clickable)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(124, 58, 237);
    doc.text(pageStr, rightX, y, { align: "right" });
    const pgW = doc.getTextWidth(pageStr);
    doc.link(rightX - pgW, y - lineH, pgW, lineH + 1, { pageNumber: entry.page });

    y += entry.level === 1 ? 8 : 6.5;

    if (entry.level === 1) {
      doc.setDrawColor(230, 220, 255);
      doc.setLineWidth(0.2);
      doc.line(MARGIN_L, y - 1, PAGE_W - MARGIN_R, y - 1);
    }
  }

  // Footer on the last TOC page
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 190, 220);
  doc.text("Généré avec RapportAI · rapportai.io", PAGE_W / 2, PAGE_H - 10, { align: "center" });

  return curPage(doc) - startPage + 1;
}

/**
 * Measures how many pages a TOC for `entries` would occupy without caring
 * about the actual page numbers stored in the entries (only entry count /
 * title length drives pagination).
 */
function measureTocPageCount(entries: TocEntry[]): number {
  const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  return renderTocPage(scratch, entries);
}

function renderCoverPage(doc: jsPDF, report: ReportData): void {
  let y = MARGIN_T;

  doc.setFillColor(124, 58, 237);
  doc.rect(MARGIN_L, y, USABLE_W, 1, "F");
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(124, 58, 237);
  doc.text((report.reportType ?? "RAPPORT DE STAGE").toUpperCase(), PAGE_W / 2, y, { align: "center" });
  y += 10;

  if (report.school) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(report.school, PAGE_W / 2, y, { align: "center" });
    y += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(26, 26, 46);
  const titleLines = doc.splitTextToSize(report.theme ?? "Titre du rapport", USABLE_W);
  doc.text(titleLines, PAGE_W / 2, y, { align: "center" });
  y += titleLines.length * 9 + 12;

  doc.setFillColor(245, 240, 255);
  doc.setDrawColor(220, 200, 255);
  doc.roundedRect(MARGIN_L, y, USABLE_W, 42, 3, 3, "FD");
  y += 8;

  doc.setFontSize(10.5);
  const metaLines = [
    ["Préparé par", report.studentName ?? ""],
    ["Encadrant pédagogique", report.encadrantPeda ?? ""],
    ["Encadrant professionnel", report.encadrantPro ?? ""],
    ["Entreprise", report.entreprise ?? ""],
    ["Année universitaire", report.annee ?? ""],
  ].filter(([, v]) => v) as [string, string][];

  for (const [label, value] of metaLines) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${label} :`, MARGIN_L + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(value, MARGIN_L + 55, y);
    y += 7;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(170, 170, 170);
  doc.text(
    `Généré avec RapportAI · rapportai.io · ${new Date().toLocaleDateString("fr-MA", { day: "2-digit", month: "long", year: "numeric" })}`,
    PAGE_W / 2,
    PAGE_H - 12,
    { align: "center" },
  );
}

// ─── Shared PDF builder ───────────────────────────────────────────────────────
// Single source of truth for both generatePdf and generatePdfBlobUrl.
async function buildPdfDoc(report: ReportData): Promise<jsPDF> {
  const ext = report as unknown as {
    listeDesFigures?: string;
    listeDesTableaux?: string;
    annexeItems?: AnnexeItem[];
    sessionId?: string;
  };

  const sections: SectionData[] = [
    { title: "Dédicaces",     content: report.dedicaces     ?? "" },
    { title: "Remerciements", content: report.remerciements ?? "" },
    { title: "Résumé",        content: report.resume        ?? "" },
    { title: "Introduction",  content: report.introduction  ?? "" },
    { title: "Partie I",      content: report.partieI       ?? "" },
    { title: "Partie II",     content: report.partieII      ?? "" },
    { title: "Conclusion",    content: report.conclusion    ?? "" },
  ].filter((s) => s.content.trim());

  const bibText = report.bibliographieText?.trim()
    || ((report.bibliographie ?? []).length > 0
        ? (report.bibliographie ?? [])
            .map((e) => `${e.author} (${e.year}). ${e.title}. ${e.journal}`)
            .join("\n\n")
        : "");
  if (bibText) sections.push({ title: "Références bibliographiques", content: bibText });
  if (ext.listeDesFigures?.trim())  sections.push({ title: "Liste des figures",  content: ext.listeDesFigures });
  if (ext.listeDesTableaux?.trim()) sections.push({ title: "Liste des tableaux", content: ext.listeDesTableaux });

  const annexeItems = ext.annexeItems ?? [];

  // Pass 1 — measure raw page positions (no images needed for layout measurement)
  const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const rawEntries = renderSections(scratch, sections, annexeItems);

  // Pass 2 — measure TOC page count (depends only on entry count, not page numbers)
  const tocPageCount = measureTocPageCount(rawEntries);
  const tocEntries: TocEntry[] = rawEntries.map((e) => ({ ...e, page: e.page + tocPageCount }));

  // Pass 3 — fetch images, build real PDF
  const figureMap = await prefetchFigureImagesPdf(ext.sessionId, sections);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  renderCoverPage(doc, report);
  doc.addPage();
  renderTocPage(doc, tocEntries);
  renderSections(doc, sections, annexeItems, figureMap);

  return doc;
}

export async function generatePdf(report: ReportData): Promise<void> {
  const doc = await buildPdfDoc(report);
  const filename = `${(report.theme ?? "rapport")
    .replace(/[^a-zA-Z0-9À-ɏ\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60)}_RapportAI.pdf`;
  doc.save(filename);
}

export async function generatePdfBlobUrl(report: ReportData): Promise<string> {
  const doc = await buildPdfDoc(report);
  return doc.output("bloburl") as unknown as string;
}
