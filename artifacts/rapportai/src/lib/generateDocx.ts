import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
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
import { useUserSettingsStore, type FormattingPrefs } from "./userSettingsStore";
import { API_BASE } from "./apiBase";

// ─── Constants (mutable — set from the user's mise en forme at export time) ────

let FONT       = "Times New Roman";
let BODY_PT    = 24;   // 12pt in half-points
let H1_PT      = 32;   // 16pt
let H2_PT      = 28;   // 14pt
let H3_PT      = 24;   // 12pt bold
const FOOTER_PT  = 20;   // 10pt

let MARGIN = {
  top:    convertMillimetersToTwip(25),
  bottom: convertMillimetersToTwip(25),
  left:   convertMillimetersToTwip(25),
  right:  convertMillimetersToTwip(25),
  header: convertMillimetersToTwip(10),
  footer: convertMillimetersToTwip(10),
};

let LINE_SPACING = { line: 360, lineRule: LineRuleType.AUTO };
let PARA_SPACING: { line: number; lineRule: typeof LineRuleType.AUTO; before: number; after: number } = { ...LINE_SPACING, before: 120, after: 120 };
let FIRST_LINE = convertMillimetersToTwip(12.5);
let JUSTIFY = true;

// Recompute all formatting constants from the user's mise en forme. Called at the
// top of generateDocx so every helper below picks up the chosen values.
function applyFormatting(f?: FormattingPrefs) {
  const g = f ?? ({} as FormattingPrefs);
  FONT = g.fontFamily || "Times New Roman";
  BODY_PT = Math.round((g.fontSize || 12) * 2);
  H1_PT = Math.round((g.headingSize1 || 16) * 2);
  H2_PT = Math.round((g.headingSize2 || 14) * 2);
  H3_PT = Math.round((g.headingSize3 || 12) * 2);
  const lineVal = Math.round((g.lineSpacing || 1.5) * 240);
  const spPt = g.paragraphSpacingPt ?? 6;
  LINE_SPACING = { line: lineVal, lineRule: LineRuleType.AUTO };
  PARA_SPACING = { line: lineVal, lineRule: LineRuleType.AUTO, before: spPt * 20, after: spPt * 20 };
  FIRST_LINE = convertMillimetersToTwip((g.firstLineIndentCm ?? 1) * 10);
  JUSTIFY = g.justified ?? true;
  const m = convertMillimetersToTwip((g.marginCm ?? 2.5) * 10);
  const hf = convertMillimetersToTwip((g.headerFooterMarginCm ?? 1.0) * 10);
  MARGIN = { top: m, bottom: m, left: m, right: m, header: hf, footer: hf };
  PARAGRAPH_STYLES = buildParagraphStyles();
}

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

// Numbering references — must match the config in the Document constructor below
const BULLET_LIST_REF   = "rapportai-bullet";
const NUMBERED_LIST_REF = "rapportai-numbered";

function bulletListPara(text: string, level = 0): Paragraph {
  return new Paragraph({
    numbering: { reference: BULLET_LIST_REF, level },
    spacing: { ...LINE_SPACING, before: 60, after: 60 },
    children: parseInlineRuns(text),
  });
}

function numberedListPara(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: NUMBERED_LIST_REF, level: 0 },
    spacing: { ...LINE_SPACING, before: 60, after: 60 },
    children: parseInlineRuns(text),
  });
}

function bodyPara(text: string, extra: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({
    alignment: JUSTIFY ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
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

function heading4(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 180, after: 80 },
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

// Matches markdown image lines: ![alt](path) — captures both alt text and path
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]*)\)$/;

// Extract all figures/page-N.png paths referenced in markdown text (inline, not just line-start)
function collectFigurePaths(md: string): string[] {
  const paths: string[] = [];
  const re = /!\[[^\]]*\]\((figures\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (!paths.includes(m[1])) paths.push(m[1]);
  }
  return paths;
}

// Fetch a figure image from the session API and return as Uint8Array.
// Returns null on any failure (network, 404, etc.)
async function fetchFigureImage(sessionId: string, figurePath: string, basePath: string): Promise<Uint8Array | null> {
  try {
    // figurePath is e.g. "figures/page-1.png"
    const filename = figurePath.split("/").pop();
    if (!filename) return null;
    const url = `${basePath}/api/session/${sessionId}/figures/${filename}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// Build an ImageRun paragraph from raw PNG bytes, centered, A4-safe size
function imageRunPara(data: Uint8Array, maxW = MAX_FIG_W, maxH = MAX_FIG_H): Paragraph {
  const { width, height } = scaleFigure(800, 600, maxW, maxH); // default to landscape figure size
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 60 },
    children: [
      new ImageRun({
        data,
        transformation: { width, height },
        type: "png",
      }),
    ],
  });
}

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

// imageMap: pre-fetched figure images keyed by their "figures/page-N.png" path
// ─── Markdown table helpers ───────────────────────────────────────────────────
// A markdown table is a row line ("| a | b |") immediately followed by a
// separator line ("|---|:--:|"). Without this, tables leak into the .docx as raw
// pipe text. Escaped pipes inside a cell ("\|", e.g. in the CVaR formula) are kept.

function looksLikeTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.indexOf("|", 1) > 0;
}

function isTableSeparatorLine(line: string): boolean {
  const t = line.trim();
  return t.includes("|") && t.includes("-") && /^\|?[\s:|-]+$/.test(t);
}

function splitTableCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

const TBL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 0 };
const TBL_BORDERS = {
  top: TBL_BORDER, bottom: TBL_BORDER, left: TBL_BORDER, right: TBL_BORDER,
  insideHorizontal: TBL_BORDER, insideVertical: TBL_BORDER,
};

// Inline-formatted runs for a table cell at a given font size (handles **bold**/*italic*).
function cellRuns(text: string, size: number, forceBold = false): TextRun[] {
  const clean = text.trim();
  if (forceBold) return [new TextRun({ text: clean.replace(/\*+/g, ""), font: FONT, size, bold: true })];
  const runs: TextRun[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: clean.slice(last, m.index), font: FONT, size }));
    if (m[1] !== undefined) runs.push(new TextRun({ text: m[1], font: FONT, size, bold: true }));
    else if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], font: FONT, size, italics: true }));
    last = m.index + m[0].length;
  }
  if (last < clean.length) runs.push(new TextRun({ text: clean.slice(last), font: FONT, size }));
  return runs.length > 0 ? runs : [new TextRun({ text: clean, font: FONT, size })];
}

function buildMarkdownTable(rows: string[][]): Table {
  const colCount = Math.max(...rows.map((r) => r.length));
  // Scale font down as the table widens so wide finance tables (8-11 cols) don't
  // get cramped/over-wrapped on A4 portrait. BODY_PT = 24 half-pts (12pt).
  const cellSize = colCount <= 4 ? BODY_PT - 2   // 11pt
    : colCount <= 6 ? 20                          // 10pt
    : colCount <= 8 ? 18                          // 9pt
    : 16;                                         // 8pt for 9+ columns
  const tableRows = rows.map((cells, ri) => {
    const padded = [...cells];
    while (padded.length < colCount) padded.push("");
    return new TableRow({
      tableHeader: ri === 0,
      children: padded.map((cell) =>
        new TableCell({
          borders: TBL_BORDERS,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 20, after: 20 },
            children: cellRuns(cell, cellSize, ri === 0),
          })],
        }),
      ),
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    rows: tableRows,
  });
}

function markdownToParas(md: string, imageMap?: Map<string, Uint8Array>): (Paragraph | Table)[] {
  if (!md?.trim()) return [];

  const lines = md.split("\n");
  const out: (Paragraph | Table)[] = [];
  let buf = "";

  const flushBuf = () => {
    const trimmed = buf.trim();
    if (trimmed) { out.push(bodyPara(trimmed)); }
    buf = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    // Markdown table: header row + separator row + data rows → real Word table
    if (looksLikeTableRow(line) && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      flushBuf();
      const rows: string[][] = [splitTableCells(line)];
      let j = i + 2; // skip the header line and the separator line
      while (j < lines.length && looksLikeTableRow(lines[j])) {
        rows.push(splitTableCells(lines[j]));
        j++;
      }
      out.push(buildMarkdownTable(rows));
      out.push(emptyLine());
      i = j - 1; // resume after the table (loop will ++)
      continue;
    }

    // Heading detection — tolerant of a missing space after the hashes
    // (e.g. "##Titre" as well as "## Titre") so raw "#" never leaks into the doc.
    const headingMatch = line.match(/^(#{1,4})\s*(\S.*)$/);
    if (headingMatch) {
      flushBuf();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      if (level === 4) out.push(heading4(text));
      else if (level === 3) out.push(heading3(text));
      else if (level === 2) out.push(heading2(text));
      else out.push(heading1(text, false));
    } else if (line === "") {
      flushBuf();
    } else {
      // Check for figure/table caption line (full-line italic)
      const captionMatch = line.match(CAPTION_RE);
      if (captionMatch) {
        flushBuf();
        out.push(agentCaptionPara(captionMatch[1]));
      // Check for markdown image reference
      } else if (IMAGE_RE.test(line)) {
        flushBuf();
        const imgMatch = line.match(IMAGE_RE);
        const altText = imgMatch?.[1] ?? "";
        const imgPath = imgMatch?.[2] ?? "";
        const imgData = imageMap?.get(imgPath);
        if (imgData) {
          out.push(imageRunPara(imgData));
        } else {
          out.push(imagePlaceholderPara(altText));
        }
      // Bullet list item (- text or * text, with optional leading spaces for nesting)
      } else if (/^(\s{0,4})[-*]\s+/.test(line)) {
        flushBuf();
        const indent = (line.match(/^(\s*)/)?.[1].length ?? 0);
        const level = Math.min(Math.floor(indent / 2), 1);
        const text = line.replace(/^\s*[-*]\s+/, "").trim();
        if (text) out.push(bulletListPara(text, level));
      // Numbered list item (1. text, 2. text, …)
      } else if (/^\s*\d+\.\s+/.test(line)) {
        flushBuf();
        const text = line.replace(/^\s*\d+\.\s+/, "").trim();
        if (text) out.push(numberedListPara(text));
      } else {
        buf += (buf ? " " : "") + line;
      }
    }
  }
  flushBuf();
  return out;
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

  const ACCENT = "1F3864"; // neutral dark navy — works for any school
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

function buildDedicaces(d: Report): (Paragraph | Table)[] {
  if (!d.dedicaces?.trim()) return [];
  return [
    heading1("Dédicaces"),
    emptyLine(),
    ...markdownToParas(stripDuplicateTitle(d.dedicaces, "Dédicaces")),
  ];
}

function buildRemerciements(d: Report): (Paragraph | Table)[] {
  if (!d.remerciements?.trim()) return [];
  return [
    heading1("Remerciements"),
    emptyLine(),
    ...markdownToParas(stripDuplicateTitle(d.remerciements, "Remerciements")),
  ];
}

// Strip a leading markdown heading from section content when it just repeats the
// title the builder already adds (the generators sometimes write "## Résumé" /
// "## Abstract" at the top → duplicate title in the doc). Only removes the first
// heading when it matches the given title (accent/case-insensitive); never touches
// structural headings like chapters.
function stripDuplicateTitle(md: string, title: string): string {
  const lines = md.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const m = lines[i]?.trim().match(/^#{1,3}\s+(.+)/);
  if (m) {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const a = norm(m[1]); const b = norm(title);
    if (a && b && (a.includes(b) || b.includes(a))) {
      lines.splice(0, i + 1);
      return lines.join("\n").replace(/^\n+/, "");
    }
  }
  return md;
}

function buildResume(d: Report): (Paragraph | Table)[] {
  const hasFr = !!d.resumeFr?.trim();
  const hasEn = !!d.abstractEn?.trim();
  if (!hasFr && !hasEn) return [];
  const mots = (d.motsCles || []).join(", ");
  const paras: (Paragraph | Table)[] = [];
  if (hasFr) {
    paras.push(heading1("Résumé"), emptyLine(), ...markdownToParas(stripDuplicateTitle(d.resumeFr!, "Résumé")));
    if (mots) paras.push(emptyLine(), bodyPara(`Mots-clés : ${mots}`, { indent: { firstLine: 0 } }));
  }
  if (hasEn) {
    paras.push(heading1("Abstract"), emptyLine(), ...markdownToParas(stripDuplicateTitle(d.abstractEn!, "Abstract")));
  }
  return paras;
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

// Parse sommaire markdown (#/##/###/#### headers) into a hierarchy of {level, text} entries.
// Falls back to generic structure if sommaire is empty or unparseable.
function parseSommaireMarkdown(md: string): Array<{ level: number; text: string }> {
  if (!md?.trim()) return [];
  const entries: Array<{ level: number; text: string }> = [];
  for (const raw of md.split("\n")) {
    const m = raw.match(/^(#{1,4})\s+(.+)/);
    if (m) entries.push({ level: m[1].length, text: m[2].trim() });
  }
  return entries;
}

// Sommaire — front matter overview using the AI-generated sommaire markdown.
// Returns [] if sommaire was not generated yet.
function buildSommaire(d: Report): Paragraph[] {
  const parsed = parseSommaireMarkdown(d.sommaire || "");
  if (parsed.length === 0) return [];

  const sommaireLines: Paragraph[] = [heading1("Sommaire"), emptyLine()];
  const indents = [0, 0, convertMillimetersToTwip(8), convertMillimetersToTwip(16), convertMillimetersToTwip(24)];
  for (const { level, text } of parsed) {
    const indent = indents[Math.min(level, 4)] ?? 0;
    const bold = level <= 2;
    sommaireLines.push(new Paragraph({
      indent: { left: indent, firstLine: 0 },
      spacing: { ...LINE_SPACING, before: level <= 2 ? 120 : 60, after: level <= 2 ? 60 : 30 },
      children: [new TextRun({ text, font: FONT, size: BODY_PT, bold })],
    }));
  }
  return sommaireLines;
}

function buildIntroduction(d: Report, imageMap?: Map<string, Uint8Array>): (Paragraph | Table)[] {
  if (!d.introduction?.trim()) return [];
  return [heading1("Introduction Générale"), emptyLine(), ...markdownToParas(stripDuplicateTitle(d.introduction, "Introduction"), imageMap)];
}

function buildPartieI(d: Report, imageMap?: Map<string, Uint8Array>): (Paragraph | Table)[] {
  if (!d.partieI?.trim()) return [];
  return [heading1("Partie I"), emptyLine(), ...markdownToParas(stripDuplicateTitle(d.partieI, "Partie I"), imageMap)];
}

function buildPartieII(d: Report, imageMap?: Map<string, Uint8Array>): (Paragraph | Table)[] {
  if (!d.partieII?.trim()) return [];
  return [heading1("Partie II"), emptyLine(), ...markdownToParas(stripDuplicateTitle(d.partieII, "Partie II"), imageMap)];
}

function buildConclusion(d: Report, imageMap?: Map<string, Uint8Array>): (Paragraph | Table)[] {
  if (!d.conclusion?.trim()) return [];
  return [heading1("Conclusion Générale"), emptyLine(), ...markdownToParas(stripDuplicateTitle(d.conclusion, "Conclusion"), imageMap)];
}

// Paragraph for a single bibliography entry with APA hanging indent.
// First line at left margin, continuation lines indented 12.7 mm (0.5 in).
function bibEntryPara(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { ...LINE_SPACING, before: 60, after: 60 },
    indent: { left: convertMillimetersToTwip(12.7), hanging: convertMillimetersToTwip(12.7) },
    children: parseInlineRuns(text),
  });
}

// markdownToParas variant that uses bibEntryPara for body lines (no first-line indent).
// List items (-, *, 1.) and numbered entries are emitted as individual hanging-indent
// paragraphs — never concatenated — to match APA one-entry-per-paragraph convention.
function bibMarkdownToParas(md: string): Paragraph[] {
  if (!md?.trim()) return [];
  const lines = md.split("\n");
  const paras: Paragraph[] = [];
  let buf = "";

  const flushBuf = () => {
    const trimmed = buf.trim();
    if (trimmed) paras.push(bibEntryPara(trimmed));
    buf = "";
  };

  // Detects list item prefixes: "- ", "* ", "1. ", "[1] "
  const LIST_RE = /^(?:[-*]|\d+\.|[\[\(]\d+[\]\)])\s+/;

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
    } else if (line === "" || line === "---") {
      flushBuf();
    } else if (LIST_RE.test(line)) {
      // Each list entry is its own paragraph — flush any accumulated text first
      flushBuf();
      const text = line.replace(LIST_RE, "").trim();
      if (text) paras.push(bibEntryPara(text));
    } else {
      buf += (buf ? " " : "") + line;
    }
  }
  flushBuf();
  return paras;
}

function buildBibliographie(d: Report): Paragraph[] {
  // Prefer the AI-generated markdown text; fall back to legacy string field
  const text = d.bibliographieText?.trim() || (typeof d.bibliographie === "string" ? d.bibliographie?.trim() : "");
  if (!text) return [];
  return [
    heading1("Références bibliographiques"),
    emptyLine(),
    ...bibMarkdownToParas(text),
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

function scaleFigure(w: number, h: number, maxW = MAX_FIG_W, maxH = MAX_FIG_H): { width: number; height: number } {
  const wTwip = w * 15; // rough px → twip (1px ≈ 15 twip at 96dpi)
  const hTwip = h * 15;
  const scaleW = wTwip > maxW ? maxW / wTwip : 1;
  const scaleH = hTwip > maxH ? maxH / hTwip : 1;
  const scale = Math.min(scaleW, scaleH);
  return { width: Math.round(wTwip * scale), height: Math.round(hTwip * scale) };
}

// Build the two-line Caption paragraph for a figure (Word uses "Caption" style for auto TOC)
// Line 1: bold figure title  Line 2: italic formatted source
function figureCaption(fig: ApprovedFigure): Paragraph[] {
  const titleLine = `Figure ${fig.figureNumber} — ${fig.title}`;
  const sourceLine = fig.formattedSource || (fig.source ? `Source : ${fig.source}` : "Source : [À compléter]");
  return [
    new Paragraph({
      style: "Caption",
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      children: [new TextRun({ text: titleLine, font: FONT, size: 20, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: sourceLine, font: FONT, size: 18, italics: true, color: "555555" })],
    }),
  ];
}

// Embed figures for a given placement, inline after section content
function buildFiguresSection(placement: "Partie I" | "Partie II"): Paragraph[] {
  const figs = getApprovedFigures().filter((f) => f.placement === placement);
  if (figs.length === 0) return [];

  const paras: Paragraph[] = [];

  for (const fig of figs) {
    try {
      const imgData = base64ToUint8Array(fig.pngBase64);
      const { width, height } = scaleFigure(fig.width || 600, fig.height || 400);
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 360, after: 60 },
          children: [
            new ImageRun({
              data: imgData,
              transformation: { width, height },
              type: fig.pngBase64.includes("image/png") ? "png" : "jpg",
            }),
          ],
        }),
      );
    } catch {
      paras.push(bodyPara(`[Figure ${fig.figureNumber} — image non disponible]`));
    }
    paras.push(...figureCaption(fig));
  }

  return paras;
}

// Strip a leading "## Liste des figures" / "## Liste des tableaux" heading from AI output
// so the document-level heading1 added by the builder is not duplicated.
function stripLeadingListeHeading(md: string, label: string): string {
  const lines = md.split("\n");
  const first = lines[0]?.trim().toLowerCase() ?? "";
  if (first === `## ${label}`.toLowerCase() || first === `# ${label}`.toLowerCase()) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return md;
}

// Liste des figures — uses AI-generated content if available, otherwise builds from approved figures.
function buildTableDesFigures(listeDesFigures?: string): (Paragraph | Table)[] {
  // AI-generated list takes priority (richer, includes chapter context)
  if (listeDesFigures?.trim()) {
    const content = stripLeadingListeHeading(listeDesFigures.trim(), "liste des figures");
    return [heading1("Liste des figures"), emptyLine(), ...markdownToParas(content)];
  }

  // Fallback: build from approved figures metadata
  const figs = getApprovedFigures();
  if (figs.length === 0) return [];
  const paras: Paragraph[] = [heading1("Liste des figures"), emptyLine()];

  for (const fig of figs) {
    paras.push(new Paragraph({
      spacing: { ...LINE_SPACING, before: 80, after: 20 },
      children: [
        new TextRun({ text: `Figure ${fig.figureNumber}`, font: FONT, size: BODY_PT, bold: true }),
        new TextRun({ text: ` — ${fig.title}`, font: FONT, size: BODY_PT }),
        new TextRun({ text: "  ............... ", font: FONT, size: BODY_PT, color: "AAAAAA" }),
        new TextRun({ text: "voir p. X", font: FONT, size: BODY_PT, italics: true, color: "888888" }),
      ],
    }));
    const src = fig.formattedSource || (fig.source ? `Source : ${fig.source}` : "");
    if (src) {
      paras.push(new Paragraph({
        indent: { left: convertMillimetersToTwip(8) },
        spacing: { ...LINE_SPACING, before: 0, after: 100 },
        children: [new TextRun({ text: src, font: FONT, size: 20, italics: true, color: "555555" })],
      }));
    } else {
      paras.push(emptyLine());
    }
  }

  return paras;
}

function buildListeDesTableaux(listeDesTableaux?: string): (Paragraph | Table)[] {
  if (!listeDesTableaux?.trim()) return [];
  const content = stripLeadingListeHeading(listeDesTableaux.trim(), "liste des tableaux");
  return [heading1("Liste des tableaux"), emptyLine(), ...markdownToParas(content)];
}

const ANNEXE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildAnnexes(d: Report): (Paragraph | Table)[] {
  const items = d.annexeItems ?? [];
  const legacy = d.annexes?.trim();

  if (items.length === 0 && !legacy) return [];

  const paras: (Paragraph | Table)[] = [heading1("Annexes"), emptyLine()];

  if (items.length > 0) {
    items.forEach((item, i) => {
      const letter = ANNEXE_LETTERS[i] ?? String(i + 1);
      const title = item.title?.trim() || `Annexe ${letter}`;
      paras.push(
        new Paragraph({
          text: `Annexe ${letter} — ${title}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 180 },
          keepNext: true,
        }),
      );
      if (item.content?.trim()) {
        paras.push(...markdownToParas(item.content));
      } else {
        paras.push(bodyPara("(Contenu à insérer)"));
      }
      paras.push(emptyLine());
    });
  } else if (legacy) {
    paras.push(...markdownToParas(legacy));
  }

  return paras;
}

// Table des Matières — Word TOC field with page numbers + hyperlinks.
// updateFields: true on Document forces Word to populate it automatically on open.
// The title uses a plain bold paragraph (not Heading1) so it doesn't appear inside the TOC.
function buildTableDesMatieres(): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: "Table des Matières", font: FONT, size: H1_PT, bold: true })],
    }),
    new TableOfContents("Table des Matières", {
      hyperlink:         true,
      headingStyleRange: "1-3",
    }) as unknown as Paragraph,
  ];
}

// Small instruction note placed after the front-matter TOC field.
function buildTocInstruction(): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 0 },
    children: [
      new TextRun({
        text: "Astuce Word : appuie sur Ctrl+A puis F9 pour afficher les numeros de page reels.",
        font: FONT,
        size: 18,
        italics: true,
        color: "999999",
      }),
    ],
  });
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function buildParagraphStyles() {
  return [
  {
    id: "Normal",
    name: "Normal",
    run: { font: FONT, size: BODY_PT },
    paragraph: { spacing: PARA_SPACING, alignment: JUSTIFY ? AlignmentType.JUSTIFIED : AlignmentType.LEFT },
  },
  {
    id: "Heading1",
    name: "Heading 1",
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { font: FONT, size: H1_PT, bold: true },
    paragraph: { spacing: { before: 480, after: 240 }, alignment: AlignmentType.CENTER, keepNext: true, outlineLevel: 0 },
  },
  {
    id: "Heading2",
    name: "Heading 2",
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { font: FONT, size: H2_PT, bold: true },
    paragraph: { spacing: { before: 360, after: 180 }, keepNext: true, outlineLevel: 1 },
  },
  {
    id: "Heading3",
    name: "Heading 3",
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { font: FONT, size: H3_PT, bold: true },
    paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 2 },
  },
  {
    id: "Heading4",
    name: "Heading 4",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: BODY_PT, bold: true, italics: true },
    paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 3 },
  },
  {
    id: "Caption",
    name: "Caption",
    basedOn: "Normal",
    run: { font: FONT, size: 20, italics: true },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 } },
  },
  ];
}

let PARAGRAPH_STYLES = buildParagraphStyles();

// ─── Main export ─────────────────────────────────────────────────────────────

// Pre-fetch all figures/page-N.png images referenced in the report markdown.
// Returns a Map<path, Uint8Array> used by markdownToParas to embed real images.
async function prefetchFigureImages(data: Report): Promise<Map<string, Uint8Array>> {
  const sessionId = data.sessionId;
  const imageMap = new Map<string, Uint8Array>();
  if (!sessionId) return imageMap;

  // Collect all figure paths referenced across all sections
  const allMd = [data.introduction, data.partieI, data.partieII, data.conclusion].join("\n");
  const paths = collectFigurePaths(allMd);
  if (paths.length === 0) return imageMap;

  // Fetch all in parallel — silently skip failures (images may not exist)
  await Promise.all(
    paths.map(async (p) => {
      const data2 = await fetchFigureImage(sessionId, p, API_BASE);
      if (data2) imageMap.set(p, data2);
    })
  );

  return imageMap;
}

export async function generateDocx(data: Report, formatting?: FormattingPrefs): Promise<Blob> {
  applyFormatting(formatting ?? useUserSettingsStore.getState().formatting);
  const header = buildHeader(data);
  const pageBase = { page: { margin: MARGIN } };

  // Pre-fetch figure images so they can be embedded inline in the body sections
  const imageMap = await prefetchFigureImages(data);

  const doc = new Document({
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_PT } },
      },
      paragraphStyles: PARAGRAPH_STYLES,
    },
    numbering: {
      config: [
        {
          reference: BULLET_LIST_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "◦",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
            },
          ],
        },
        {
          reference: NUMBERED_LIST_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        // Page de garde — no page number
        properties: { ...pageBase },
        children: buildPageDeGarde(data),
      },
      {
        // All content — Arabic page numbers 1, 2, 3… throughout
        properties: {
          page: {
            margin: MARGIN,
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        headers: { default: header },
        footers: { default: buildFooter() },
        children: [
          // Front matter. The derived lists (abréviations, figures, tableaux) are
          // GENERATED last in the wizard (they need the body) but PLACED here —
          // after the Résumé/Abstract, before the Introduction — per French academic
          // convention. Generation order ≠ document order; the export handles position.
          // Sommaire = short outline up front; the detailed Table des Matières goes
          // at the END (just before the bibliography).
          ...buildDedicaces(data),
          ...buildRemerciements(data),
          ...buildResume(data),
          ...buildAbreviations(data),
          ...buildTableDesFigures(data.listeDesFigures),
          ...buildListeDesTableaux(data.listeDesTableaux),
          ...buildSommaire(data),
          // Body
          ...buildIntroduction(data, imageMap),
          ...buildPartieI(data, imageMap),
          ...buildFiguresSection("Partie I"),
          ...buildPartieII(data, imageMap),
          ...buildFiguresSection("Partie II"),
          ...buildConclusion(data, imageMap),
          // Table des Matières — detailed TOC at the end, before the bibliography
          ...buildTableDesMatieres(),
          buildTocInstruction(),
          // Back-matter — only bibliography and annexes. The lists and TOC are
          // rendered above (front matter / end), so skip them here to avoid the
          // duplicate rendering that happened when they were in sectionOrder.
          ...(data.sectionOrder?.length ? data.sectionOrder : ["bibliographie", "annexes"])
            .flatMap((id) => {
              if (id === "bibliographie") return buildBibliographie(data);
              if (id === "annexes")       return buildAnnexes(data);
              return [];
            }),
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
