import type { ReportData } from "./reportStore";
import { jsPDF } from "jspdf";

interface TocEntry {
  title: string;
  level: number; // 1 = main section, 2 = h2, 3 = h3
  page: number;
}

export async function generatePdf(report: ReportData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const marginL = 25;
  const marginR = 20;
  const marginT = 25;
  const pageW   = 210;
  const pageH   = 297;
  const usableW = pageW - marginL - marginR;
  let   y        = marginT;
  const tocEntries: TocEntry[] = [];

  const newPage = () => { doc.addPage(); y = marginT; };
  const checkY  = (needed: number) => { if (y + needed > pageH - 20) newPage(); };
  const curPage = (): number => (doc as unknown as { internal: { getCurrentPageInfo(): { pageNumber: number } } }).internal.getCurrentPageInfo().pageNumber;

  // ── Cover page ────────────────────────────────────────────────────────────
  doc.setFillColor(124, 58, 237);
  doc.rect(marginL, y, usableW, 1, "F");
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(124, 58, 237);
  doc.text((report.reportType ?? "RAPPORT DE STAGE").toUpperCase(), pageW / 2, y, { align: "center" });
  y += 10;

  if (report.school) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(report.school, pageW / 2, y, { align: "center" });
    y += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(26, 26, 46);
  const titleLines = doc.splitTextToSize(report.theme ?? "Titre du rapport", usableW);
  doc.text(titleLines, pageW / 2, y, { align: "center" });
  y += titleLines.length * 9 + 12;

  doc.setFillColor(245, 240, 255);
  doc.setDrawColor(220, 200, 255);
  doc.roundedRect(marginL, y, usableW, 42, 3, 3, "FD");
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
    doc.text(`${label} :`, marginL + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(value, marginL + 55, y);
    y += 7;
  }
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(170, 170, 170);
  doc.text(
    `Généré avec RapportAI · rapportai.io · ${new Date().toLocaleDateString("fr-MA", { day: "2-digit", month: "long", year: "numeric" })}`,
    pageW / 2,
    pageH - 12,
    { align: "center" },
  );

  // ── Inline content renderer with heading tracking ─────────────────────────

  function renderContent(md: string, baseIndent = 0): void {
    const lines = md.split("\n");
    let buf = "";

    const cleanInline = (t: string) =>
      t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");

    const flushBuf = () => {
      const trimmed = buf.trim();
      if (!trimmed) { buf = ""; return; }
      const text = cleanInline(trimmed);
      const wrapped = doc.splitTextToSize(text, usableW - baseIndent);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      for (const line of wrapped) {
        checkY(6);
        doc.text(line, marginL + baseIndent, y);
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
        tocEntries.push({ title: heading, level: 3, page: curPage() });
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(80, 80, 110);
        const wrapped = doc.splitTextToSize(heading, usableW - 8);
        doc.text(wrapped, marginL + 8, y);
        y += wrapped.length * 6.5 + 3;

      } else if (line.startsWith("## ")) {
        flushBuf();
        const heading = cleanInline(line.slice(3).trim());
        checkY(14);
        tocEntries.push({ title: heading, level: 2, page: curPage() });
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(55, 55, 110);
        const wrapped = doc.splitTextToSize(heading, usableW);
        doc.text(wrapped, marginL, y);
        y += wrapped.length * 7 + 3;

      } else if (line.startsWith("# ")) {
        flushBuf(); // skip duplicate H1 already rendered as section title

      } else if (/^[-*]\s+/.test(line)) {
        flushBuf();
        const item = cleanInline(line.replace(/^[-*]\s+/, ""));
        const wrapped = doc.splitTextToSize(`• ${item}`, usableW - 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        for (const l of wrapped) {
          checkY(6);
          doc.text(l, marginL + 5, y);
          y += 6;
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

  // ── Content sections ──────────────────────────────────────────────────────

  type RGB = [number, number, number];
  const sectionColors: Record<string, RGB> = {
    "Résumé":              [99,  102, 241],
    "Introduction":        [124, 58,  237],
    "Partie I":            [37,  99,  235],
    "Partie II":           [8,   145, 178],
    "Conclusion":          [5,   150, 105],
    "Apports et Limites":  [217, 119, 6  ],
    "Perspectives":        [217, 119, 6  ],
    "Bibliographie":       [107, 114, 128],
  };

  const sections: { title: string; content: string }[] = [
    { title: "Résumé",             content: report.resume        ?? "" },
    { title: "Introduction",       content: report.introduction  ?? "" },
    { title: "Partie I",           content: report.partieI       ?? "" },
    { title: "Partie II",          content: report.partieII      ?? "" },
    { title: "Conclusion",         content: report.conclusion    ?? "" },
    { title: "Apports et Limites", content: report.apports       ?? "" },
    { title: "Perspectives",       content: report.perspectives  ?? "" },
  ].filter((s) => s.content.trim());

  if ((report.bibliographie ?? []).length > 0) {
    const bibText = (report.bibliographie ?? [])
      .map((e) => `${e.author} (${e.year}). ${e.title}. ${e.journal}`)
      .join("\n\n");
    sections.push({ title: "Bibliographie", content: bibText });
  }

  for (const { title, content } of sections) {
    newPage();
    const color: RGB = sectionColors[title] ?? [124, 58, 237];
    tocEntries.push({ title, level: 1, page: curPage() });

    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(marginL, y, usableW, 0.5, "F");
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title.toUpperCase(), marginL, y);
    y += 9;

    renderContent(content);
  }

  // ── Annexes ───────────────────────────────────────────────────────────────

  const annexeItems = (report as unknown as { annexeItems?: Array<{ title: string; content: string }> }).annexeItems ?? [];
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (let i = 0; i < annexeItems.length; i++) {
    const item = annexeItems[i];
    const letter = LETTERS[i] ?? String(i + 1);
    const title = item.title?.trim() || `Annexe ${letter}`;

    newPage();
    const annexeColor: [number, number, number] = [107, 114, 128];
    tocEntries.push({ title: `Annexe ${letter} — ${title}`, level: 1, page: curPage() });

    doc.setFillColor(107, 114, 128);
    doc.rect(marginL, y, usableW, 0.5, "F");
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(annexeColor[0], annexeColor[1], annexeColor[2]);
    doc.text(`ANNEXE ${letter} — ${title.toUpperCase()}`, marginL, y);
    y += 9;

    if (item.content?.trim()) {
      renderContent(item.content);
    }
  }

  // ── Table des Matières ────────────────────────────────────────────────────

  newPage();

  // Title
  doc.setFillColor(124, 58, 237);
  doc.rect(marginL, y, usableW, 1, "F");
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(124, 58, 237);
  doc.text("TABLE DES MATIÈRES", marginL, y);
  y += 10;

  // Entries with dot leaders
  for (const entry of tocEntries) {
    checkY(8);

    const indent = entry.level === 1 ? 0 : entry.level === 2 ? 8 : 15;
    const fontSize = entry.level === 1 ? 11 : entry.level === 2 ? 10.5 : 10;
    const isBold   = entry.level === 1;

    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(entry.level === 1 ? 26 : entry.level === 2 ? 50 : 70, 26, 46);

    const pageStr = String(entry.page);
    const rightX  = pageW - marginR;

    // Truncate title if too long for available width
    const maxTitleW = usableW - indent - doc.getTextWidth(pageStr) - 8;
    let titleText = entry.title;
    while (doc.getTextWidth(titleText) > maxTitleW && titleText.length > 5) {
      titleText = titleText.slice(0, -1);
    }
    if (titleText !== entry.title) titleText = titleText.trimEnd() + "…";

    doc.text(titleText, marginL + indent, y);

    // Dot leaders
    const titleEndX = marginL + indent + doc.getTextWidth(titleText) + 2;
    const dotW      = doc.getTextWidth(".");
    const dotAreaEnd = rightX - doc.getTextWidth(pageStr) - 3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(190, 190, 210);
    let dx = titleEndX;
    while (dx + dotW < dotAreaEnd) {
      doc.text(".", dx, y);
      dx += dotW + 0.5;
    }

    // Page number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(124, 58, 237);
    doc.text(pageStr, rightX, y, { align: "right" });

    y += entry.level === 1 ? 8 : 6.5;

    // Separator after level-1 sections
    if (entry.level === 1) {
      doc.setDrawColor(230, 220, 255);
      doc.setLineWidth(0.2);
      doc.line(marginL, y - 1, pageW - marginR, y - 1);
    }
  }

  // Footer watermark
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 190, 220);
  doc.text("Généré avec RapportAI · rapportai.io", pageW / 2, pageH - 10, { align: "center" });

  const filename = `${(report.theme ?? "rapport")
    .replace(/[^a-zA-Z0-9À-ɏ\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60)}_RapportAI.pdf`;
  doc.save(filename);
}
