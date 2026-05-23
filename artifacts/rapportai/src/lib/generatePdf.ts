import type { ReportData } from "./reportStore";
import { jsPDF } from "jspdf";

function stripMd(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "  • ")
    .replace(/\r\n/g, "\n");
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

  const newPage = () => {
    doc.addPage();
    y = marginT;
  };

  const checkY = (needed: number) => {
    if (y + needed > pageH - 20) newPage();
  };

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

  doc.setFillColor(124, 58, 237, 0.15);
  doc.setDrawColor(220, 200, 255);
  doc.roundedRect(marginL, y, usableW, 42, 3, 3, "FD");
  y += 8;

  doc.setFontSize(10.5);
  const metaLines: [string, string][] = [
    ["Préparé par", report.studentName ?? ""],
    ["Encadrant pédagogique", report.encadrantPeda ?? ""],
    ["Encadrant professionnel", report.encadrantPro ?? ""],
    ["Entreprise", report.entreprise ?? ""],
    ["Année universitaire", report.annee ?? ""],
  ].filter(([, v]) => v);

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
  doc.text(`Généré avec RapportAI · rapportai.io · ${new Date().toLocaleDateString("fr-MA", { day: "2-digit", month: "long", year: "numeric" })}`, pageW / 2, pageH - 12, { align: "center" });

  // ── Content sections ──────────────────────────────────────────────────────
  const sectionColors: Record<string, [number, number, number]> = {
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
    const color = sectionColors[title] ?? [124, 58, 237];

    doc.setFillColor(...color);
    doc.rect(marginL, y, usableW, 0.5, "F");
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(title.toUpperCase(), marginL, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);

    const clean = stripMd(content);
    const lines  = doc.splitTextToSize(clean, usableW);

    for (const line of lines) {
      checkY(6);
      doc.text(line, marginL, y);
      y += 6;
    }
  }

  const filename = `${(report.theme ?? "rapport").replace(/[^a-zA-Z0-9À-ɏ\s]/g, "").trim().replace(/\s+/g, "_").slice(0, 60)}_RapportAI.pdf`;
  doc.save(filename);
}
