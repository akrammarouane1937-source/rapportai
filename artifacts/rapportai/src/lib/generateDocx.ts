import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  NumberFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TableLayoutType,
  TextRun,
  TableOfContents,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import type { Report } from "./store";
import { getApprovedFigures, type ApprovedFigure } from "./figureStore";

// ─── Constants ───────────────────────────────────────────────────────────────

const FONT       = "Times New Roman";
const BODY_PT    = 24;   // 12pt in half-points
const H1_PT      = 32;   // 16pt
const H2_PT      = 28;   // 14pt
const H3_PT      = 24;   // 12pt bold
const FOOTER_PT  = 20;   // 10pt

const MARGIN = {
  top:    convertMillimetersToTwip(25),
  bottom: convertMillimetersToTwip(25),
  left:   convertMillimetersToTwip(25),
  right:  convertMillimetersToTwip(25),
  header: convertMillimetersToTwip(10),
  footer: convertMillimetersToTwip(10),
};

const LINE_SPACING = { line: 360, lineRule: LineRuleType.AUTO };
const PARA_SPACING = { ...LINE_SPACING, before: 120, after: 120 };
const FIRST_LINE = convertMillimetersToTwip(12.5);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bodyRun(text: string, opts: { bold?: boolean; italic?: boolean } = {}): TextRun {
  return new TextRun({ text, font: FONT, size: BODY_PT, bold: opts.bold, italics: opts.italic });
}

function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(bodyRun(text.slice(last, m.index)));
    if (m[1] !== undefined) runs.push(bodyRun(m[1], { bold: true }));
    else if (m[2] !== undefined) runs.push(bodyRun(m[2], { italic: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(bodyRun(text.slice(last)));
  return runs.length > 0 ? runs : [bodyRun(text)];
}

function bodyPara(text: string, extra: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: PARA_SPACING,
    indent: { firstLine: FIRST_LINE },
    children: parseInlineRuns(text),
    ...extra,
  });
}

function heading1(text: string, pageBreak = true): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240 },
    pageBreakBefore: pageBreak,
    keepNext: true,
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 },
    keepNext: true,
  });
}

function heading3(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    keepNext: true,
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({
    children: [new TextRun("")],
    spacing: { line: 360, lineRule: LineRuleType.AUTO },
  });
}

function centerPara(text: string, size = BODY_PT, bold = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 120 },
    children: [new TextRun({ text, font: FONT, size, bold })],
  });
}

// Matches agent-written figure/table captions: *Figure N — Titre. Source: ...*
const CAPTION_RE = /^\*{1,2}((?:Figure|Tableau|Fig\.?|Tab\.?)\s+[\d.]+\s*[—–-].+)\*{1,2}$/i;

// Matches markdown image lines: ![alt](path)
const IMAGE_RE = /^!\[([^\]]*)\]\([^)]*\)$/;

function agentCaptionPara(text: string): Paragraph {
  // Strip leading/trailing asterisks already removed by regex group
  return new Paragraph({
    style: "Caption",
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200 },
    children: [new TextRun({ text: text.trim(), font: FONT, size: 20, italics: true })],
  });
}

function imagePlaceholderPara(alt: string): Paragraph {
  // Shown when agent references an image file we can't embed (server-side only)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 60 },
    border: {
      top:    { style: "single", size: 4, color: "CCCCCC", space: 4 },
      bottom: { style: "single", size: 4, color: "CCCCCC", space: 4 },
      left:   { style: "single", size: 4, color: "CCCCCC", space: 4 },
      right:  { style: "single", size: 4, color: "CCCCCC", space: 4 },
    },
    children: [
      new TextRun({ text: alt || "[Image]", font: FONT, size: BODY_PT, color: "888888", italics: true }),
    ],
  });
}

function markdownToParas(md: string): Paragraph[] {
  if (!md?.trim()) return [bodyPara("(Section non générée)")];

  const lines = md.split("\n");
  const paras: Paragraph[] = [];
  let buf = "";

  const flushBuf = () => {
    const trimmed = buf.trim();
    if (trimmed) { paras.push(bodyPara(trimmed)); }
    buf = "";
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("### ")) {
      flushBuf();
      paras.push(heading3(line.slice(4).trim()));
    } else if (line.startsWith("## ")) {
      flushBuf();
      paras.push(heading2(line.slice(3).trim()));
    } else if (line.startsWith("# ")) {
      flushBuf();
      paras.push(heading1(line.slice(2).trim(), false));
    } else if (line === "") {
      flushBuf();
    } else {
      // Check for figure/table caption line (full-line italic)
      const captionMatch = line.match(CAPTION_RE);
      if (captionMatch) {
        flushBuf();
        paras.push(agentCaptionPara(captionMatch[1]));
      // Check for markdown image reference
      } else if (IMAGE_RE.test(line)) {
        flushBuf();
        const imgMatch = line.match(IMAGE_RE);
        paras.push(imagePlaceholderPara(imgMatch?.[1] ?? ""));
      } else {
        buf += (buf ? " " : "") + line;
      }
    }
  }
  flushBuf();
  return paras;
}

// ─── Header / Footer ─────────────────────────────────────────────────────────

function buildHeader(data: Report): Header {
  const rawTitle = data.theme || "";
  const title = rawTitle.length > 40 ? rawTitle.slice(0, 37) + "…" : rawTitle;
  const author = data.studentName || "";
  const text = title && author ? `${title}     ${author}` : title || author;

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: 240, lineRule: LineRuleType.AUTO },
        children: [new TextRun({ text, font: FONT, size: FOOTER_PT })],
      }),
    ],
  });
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: FOOTER_PT })],
      }),
    ],
  });
}

// ─── Section builders ─────────────────────────────────────────────────────────

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF", space: 0 };
const CELL_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function pgRun(text: string, bold = false, size = BODY_PT, color?: string): TextRun {
  return new TextRun({ text, font: FONT, size, bold, ...(color ? { color } : {}) });
}

function pgPara(children: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, before = 0, after = 80): Paragraph {
  return new Paragraph({
    alignment: align,
    spacing: { line: 300, lineRule: LineRuleType.AUTO, before, after },
    children,
  });
}

function buildPageDeGarde(d: Report): (Paragraph | Table)[] {
  const school    = d.school      || "École";
  const filiere   = d.filiere     || "Filière";
  const type      = d.reportType  || "PFE";
  const theme     = d.theme       || "Titre du rapport";
  const student   = d.studentName || "Prénom Nom";
  const encPeda   = d.encadrantPeda  || "";
  const encPro    = d.encadrantPro   || "";
  const entreprise = d.entreprise   || "";
  const annee     = d.academicYear  || "2024–2025";
  const jury1     = d.juryMember1   || "";
  const jury2     = d.juryMember2   || "";
  const jury3     = d.juryMember3   || "";

  const ACCENT = "00467F"; // EMSI-style dark blue — works for any school
  const C = AlignmentType.CENTER;
  const L = AlignmentType.LEFT;

  const elems: (Paragraph | Table)[] = [];

  // ── Logo row (school left, company right) ─────────────────────────────────
  // Logos are server-side files — show text placeholders until image embedding is wired
  elems.push(new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [pgPara([pgRun(`[ ${school} ]`, true, 20, ACCENT)], L)],
          }),
          new TableCell({
            borders: CELL_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [pgPara([pgRun(entreprise ? `[ ${entreprise} ]` : "", true, 20, ACCENT)], AlignmentType.RIGHT)],
          }),
        ],
      }),
    ],
  }));

  elems.push(emptyLine());

  // ── School name + filière ─────────────────────────────────────────────────
  elems.push(pgPara([pgRun(school.toUpperCase(), true, H1_PT, ACCENT)], C, 120, 40));
  elems.push(pgPara([pgRun(`Filière : ${filiere}`, false, BODY_PT)], C, 0, 200));

  elems.push(emptyLine());
  elems.push(emptyLine());

  // ── Type ──────────────────────────────────────────────────────────────────
  elems.push(pgPara([pgRun(type.toUpperCase(), true, H2_PT)], C, 0, 80));
  elems.push(pgPara([pgRun(`Pour l'obtention du diplôme de ${filiere}`, false, BODY_PT)], C, 0, 200));

  elems.push(emptyLine());

  // ── Bordered theme title box ──────────────────────────────────────────────
  elems.push(new Paragraph({
    alignment: C,
    border: {
      top:    { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
      left:   { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
      right:  { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
    },
    spacing: { line: 420, lineRule: LineRuleType.AUTO, before: 160, after: 160 },
    indent: { left: convertMillimetersToTwip(12), right: convertMillimetersToTwip(12) },
    children: [new TextRun({ text: theme, font: FONT, size: H2_PT, bold: true, color: ACCENT })],
  }));

  elems.push(emptyLine());
  elems.push(emptyLine());

  // ── Two-column table: Réalisé par | Encadrants ────────────────────────────
  const leftCellParas: Paragraph[] = [
    pgPara([pgRun("Réalisé par :", true, BODY_PT)], L),
    pgPara([pgRun(`M. ${student}`, false, BODY_PT)], L),
    pgPara([pgRun(""), ], L, 60),
    pgPara([pgRun("Soutenu publiquement le : ………………", false, BODY_PT)], L),
  ];

  const rightCellParas: Paragraph[] = [];
  if (encPeda) {
    rightCellParas.push(pgPara([pgRun("Encadrant pédagogique :", true, BODY_PT)], L));
    rightCellParas.push(pgPara([pgRun(encPeda, false, BODY_PT)], L, 0, 80));
  }
  if (encPro) {
    rightCellParas.push(pgPara([pgRun("Encadrant professionnel :", true, BODY_PT)], L, 60));
    rightCellParas.push(pgPara([pgRun(encPro, false, BODY_PT)], L));
    if (entreprise) rightCellParas.push(pgPara([pgRun(entreprise, false, BODY_PT)], L));
  }

  elems.push(new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: leftCellParas.length ? leftCellParas : [pgPara([pgRun("")], L)],
          }),
          new TableCell({
            borders: CELL_BORDERS,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: rightCellParas.length ? rightCellParas : [pgPara([pgRun("")], L)],
          }),
        ],
      }),
    ],
  }));

  // ── Jury ──────────────────────────────────────────────────────────────────
  if (jury1 || jury2 || jury3) {
    elems.push(emptyLine());
    elems.push(pgPara([pgRun("Membres du jury :", true, BODY_PT)], L, 120, 60));
    if (jury1) elems.push(pgPara([pgRun(`• ${jury1}`, false, BODY_PT)], L));
    if (jury2) elems.push(pgPara([pgRun(`• ${jury2}`, false, BODY_PT)], L));
    if (jury3) elems.push(pgPara([pgRun(`• ${jury3}`, false, BODY_PT)], L));
  }

  // ── Année académique ──────────────────────────────────────────────────────
  elems.push(emptyLine());
  elems.push(new Paragraph({
    alignment: C,
    spacing: { line: 280, lineRule: LineRuleType.AUTO, before: 240, after: 0 },
    children: [new TextRun({ text: `Année universitaire : ${annee}`, font: FONT, size: BODY_PT, bold: true })],
  }));

  return elems;
}

function buildDedicaces(d: Report): Paragraph[] {
  return [
    heading1("Dédicaces"),
    emptyLine(),
    ...markdownToParas(d.dedicaces || "À ma famille et à mes proches."),
  ];
}

function buildRemerciements(d: Report): Paragraph[] {
  return [
    heading1("Remerciements"),
    emptyLine(),
    ...markdownToParas(d.remerciements || ""),
  ];
}

function buildResume(d: Report): Paragraph[] {
  const mots = (d.motsCles || []).join(", ");
  return [
    heading1("Résumé"),
    emptyLine(),
    ...markdownToParas(d.resumeFr || ""),
    ...(mots ? [emptyLine(), bodyPara(`Mots-clés : ${mots}`, { indent: { firstLine: 0 } })] : []),
    heading1("Abstract"),
    emptyLine(),
    ...markdownToParas(d.abstractEn || ""),
  ];
}

function buildAbreviations(d: Report): Paragraph[] {
  const rows = d.abreviations || [];
  if (rows.length === 0) return [];
  return [
    heading1("Liste des abréviations"),
    emptyLine(),
    ...rows.map((r) =>
      new Paragraph({
        spacing: PARA_SPACING,
        children: [
          new TextRun({ text: r.abbr, font: FONT, size: BODY_PT, bold: true }),
          new TextRun({ text: ` — ${r.sig}`, font: FONT, size: BODY_PT }),
        ],
      })
    ),
  ];
}

function buildSommaire(): Paragraph[] {
  return [
    heading1("Sommaire"),
    emptyLine(),
    new TableOfContents("Table des matières", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }) as unknown as Paragraph,
  ];
}

function buildIntroduction(d: Report): Paragraph[] {
  return [
    heading1("Introduction Générale"),
    emptyLine(),
    ...markdownToParas(d.introduction || ""),
  ];
}

function buildPartieI(d: Report): Paragraph[] {
  return [
    heading1("Partie I"),
    emptyLine(),
    ...markdownToParas(d.partieI || ""),
  ];
}

function buildPartieII(d: Report): Paragraph[] {
  return [
    heading1("Partie II"),
    emptyLine(),
    ...markdownToParas(d.partieII || ""),
  ];
}

function buildConclusion(d: Report): Paragraph[] {
  return [
    heading1("Conclusion Générale"),
    emptyLine(),
    ...markdownToParas(d.conclusion || ""),
  ];
}

function buildBibliographie(d: Report): Paragraph[] {
  if (!d.bibliographie?.trim()) return [];
  return [
    heading1("Bibliographie et Webographie"),
    emptyLine(),
    ...markdownToParas(d.bibliographie),
  ];
}

// Decode base64 image string to Uint8Array for docx ImageRun
function base64ToUint8Array(b64: string): Uint8Array {
  const stripped = b64.includes(",") ? b64.split(",")[1] : b64;
  const binary = atob(stripped);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// Max display size for embedded figures (fits within A4 margins ~160mm wide)
const MAX_FIG_W = convertMillimetersToTwip(155);
const MAX_FIG_H = convertMillimetersToTwip(100);

function scaleFigure(w: number, h: number): { width: number; height: number } {
  const wTwip = w * 15; // rough px → twip (1px ≈ 15 twip at 96dpi)
  const hTwip = h * 15;
  const scaleW = wTwip > MAX_FIG_W ? MAX_FIG_W / wTwip : 1;
  const scaleH = hTwip > MAX_FIG_H ? MAX_FIG_H / hTwip : 1;
  const scale = Math.min(scaleW, scaleH);
  return { width: Math.round(wTwip * scale), height: Math.round(hTwip * scale) };
}

// Build the "Caption" style paragraph for a figure — Word uses this for auto TOC
function figureCaption(fig: ApprovedFigure): Paragraph {
  const sourceNote = fig.source ? ` — Source : ${fig.source}${fig.author ? `, ${fig.author}` : ""}` : "";
  return new Paragraph({
    style: "Caption",
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 200 },
    children: [
      new TextRun({
        text: `Figure ${fig.figureNumber} — ${fig.title}${sourceNote}`,
        font: FONT,
        size: 20, // 10pt
        italics: true,
      }),
    ],
  });
}

// Embed all figures for a given partie in the document body
function buildFiguresSection(placement: "Partie I" | "Partie II"): Paragraph[] {
  const figs = getApprovedFigures().filter((f) => f.placement === placement);
  if (figs.length === 0) return [];

  const paras: Paragraph[] = [
    new Paragraph({
      text: `Figures — ${placement}`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 480, after: 240 },
      keepNext: true,
      pageBreakBefore: true,
    }),
  ];

  for (const fig of figs) {
    try {
      const imgData = base64ToUint8Array(fig.pngBase64);
      const { width, height } = scaleFigure(fig.width || 600, fig.height || 400);
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 60 },
          children: [
            new ImageRun({
              data: imgData,
              transformation: { width, height },
              type: fig.pngBase64.includes("image/png") ? "png" : "jpg",
            }),
          ],
        })
      );
    } catch {
      // If image fails to embed, insert placeholder text
      paras.push(bodyPara(`[Figure ${fig.figureNumber} — image non disponible]`));
    }
    paras.push(figureCaption(fig));
  }

  return paras;
}

// Liste des figures — static numbered list with source/author, plus Word TOC field
function buildTableDesFigures(): Paragraph[] {
  const figs = getApprovedFigures();
  const paras: Paragraph[] = [
    heading1("Liste des figures"),
    emptyLine(),
  ];

  if (figs.length === 0) {
    paras.push(bodyPara("(Aucune figure ajoutée)"));
    return paras;
  }

  // Word TOC field — auto-updates page numbers from Caption-styled paragraphs
  paras.push(
    new TableOfContents("Liste des figures", {
      hyperlink: true,
      captionLabel: "Figure",
    }) as unknown as Paragraph
  );

  return paras;
}

function buildListeDesTableaux(): Paragraph[] {
  return [
    heading1("Liste des tableaux"),
    emptyLine(),
    new TableOfContents("Liste des tableaux", {
      hyperlink: true,
      captionLabel: "Tableau",
    }) as unknown as Paragraph,
  ];
}

function buildAnnexes(d: Report): Paragraph[] {
  const content = d.annexes?.trim();
  return [
    heading1("Annexes"),
    emptyLine(),
    ...(content
      ? markdownToParas(content)
      : [bodyPara("(Insérez ici vos annexes : questionnaires, tableaux de données, captures d'écran, etc.)")]),
  ];
}

function buildTableDesMatieres(): Paragraph[] {
  return [
    heading1("Table des matières"),
    emptyLine(),
    new TableOfContents("Table des matières", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }) as unknown as Paragraph,
  ];
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const PARAGRAPH_STYLES = [
  {
    id: "Normal",
    name: "Normal",
    run: { font: FONT, size: BODY_PT },
    paragraph: { spacing: PARA_SPACING, alignment: AlignmentType.JUSTIFIED },
  },
  {
    id: "Heading1",
    name: "Heading 1",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: H1_PT, bold: true },
    paragraph: { spacing: { before: 480, after: 240 }, alignment: AlignmentType.CENTER, keepNext: true },
  },
  {
    id: "Heading2",
    name: "Heading 2",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: H2_PT, bold: true },
    paragraph: { spacing: { before: 360, after: 180 }, keepNext: true },
  },
  {
    id: "Heading3",
    name: "Heading 3",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: H3_PT, bold: true },
    paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
  },
  {
    id: "Caption",
    name: "Caption",
    basedOn: "Normal",
    run: { font: FONT, size: 20, italics: true },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 } },
  },
];

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateDocx(data: Report): Promise<Blob> {
  const header = buildHeader(data);
  const pageBase = { page: { margin: MARGIN } };

  const doc = new Document({
    styles: { paragraphStyles: PARAGRAPH_STYLES },
    sections: [
      {
        properties: { ...pageBase },
        children: buildPageDeGarde(data),
      },
      {
        properties: {
          page: {
            margin: MARGIN,
            pageNumbers: { start: 2, formatType: NumberFormat.DECIMAL },
          },
        },
        headers: { default: header },
        footers: { default: buildFooter() },
        children: [
          ...buildDedicaces(data),
          ...buildRemerciements(data),
          ...buildResume(data),
          ...buildAbreviations(data),
          ...buildSommaire(),
        ],
      },
      {
        properties: {
          page: {
            margin: MARGIN,
            pageNumbers: { formatType: NumberFormat.DECIMAL },
          },
        },
        headers: { default: header },
        footers: { default: buildFooter() },
        children: [
          ...buildIntroduction(data),
          ...buildPartieI(data),
          ...buildFiguresSection("Partie I"),
          ...buildPartieII(data),
          ...buildFiguresSection("Partie II"),
          ...buildConclusion(data),
          ...buildBibliographie(data),
          ...buildTableDesFigures(),
          ...buildListeDesTableaux(),
          ...buildAnnexes(data),
          ...buildTableDesMatieres(),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
