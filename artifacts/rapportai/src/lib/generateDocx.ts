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
  StyleLevel,
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

    if (line.startsWith("#### ")) {
      flushBuf();
      paras.push(heading4(line.slice(5).trim()));
    } else if (line.startsWith("### ")) {
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

// Sommaire — front matter only, brief overview from plan data (NO page numbers, NO TOC field)
// Shows: Introduction, Partie I (title + chapter count), Partie II, Conclusion, Bibliographie, TDM
function buildSommaire(d: Report): Paragraph[] {
  const sommaireLines: Paragraph[] = [
    heading1("Sommaire"),
    emptyLine(),
    bodyPara("Introduction Générale", { indent: { firstLine: 0 } }),
  ];

  const partieITitle  = d.partieITitle  || "Partie I : Revue de Littérature";
  const partieIITitle = d.partieIITitle || "Partie II : Étude Empirique";

  // Partie I — bold title
  sommaireLines.push(new Paragraph({
    spacing: PARA_SPACING,
    children: [new TextRun({ text: partieITitle, font: FONT, size: BODY_PT, bold: true })],
  }));
  for (let i = 1; i <= (d.partieIChapters || 2); i++) {
    sommaireLines.push(new Paragraph({
      indent: { left: convertMillimetersToTwip(12) },
      spacing: { ...LINE_SPACING, before: 60, after: 60 },
      children: [new TextRun({ text: `Chapitre ${i}`, font: FONT, size: BODY_PT })],
    }));
  }

  // Partie II — bold title
  sommaireLines.push(new Paragraph({
    spacing: PARA_SPACING,
    children: [new TextRun({ text: partieIITitle, font: FONT, size: BODY_PT, bold: true })],
  }));
  for (let i = 1; i <= (d.partieIIChapters || 2); i++) {
    sommaireLines.push(new Paragraph({
      indent: { left: convertMillimetersToTwip(12) },
      spacing: { ...LINE_SPACING, before: 60, after: 60 },
      children: [new TextRun({ text: `Chapitre ${i}`, font: FONT, size: BODY_PT })],
    }));
  }

  sommaireLines.push(bodyPara("Conclusion Générale",        { indent: { firstLine: 0 } }));
  sommaireLines.push(bodyPara("Bibliographie",              { indent: { firstLine: 0 } }));
  sommaireLines.push(bodyPara("Table des Matières",         { indent: { firstLine: 0 } }));

  return sommaireLines;
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
function bibMarkdownToParas(md: string): Paragraph[] {
  if (!md?.trim()) return [bodyPara("(Section non générée)")];
  const lines = md.split("\n");
  const paras: Paragraph[] = [];
  let buf = "";

  const flushBuf = () => {
    const trimmed = buf.trim();
    if (trimmed) paras.push(bibEntryPara(trimmed));
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
    } else if (line === "" || line === "---") {
      flushBuf();
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

function scaleFigure(w: number, h: number): { width: number; height: number } {
  const wTwip = w * 15; // rough px → twip (1px ≈ 15 twip at 96dpi)
  const hTwip = h * 15;
  const scaleW = wTwip > MAX_FIG_W ? MAX_FIG_W / wTwip : 1;
  const scaleH = hTwip > MAX_FIG_H ? MAX_FIG_H / hTwip : 1;
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

// Liste des figures — standard academic front matter page with captions and page placeholders.
// Heading "Liste des figures" (French convention). Each entry: Figure N — Titre, source, voir p. X.
function buildTableDesFigures(): Paragraph[] {
  const figs = getApprovedFigures();
  const paras: Paragraph[] = [heading1("Liste des figures"), emptyLine()];

  if (figs.length === 0) {
    paras.push(bodyPara("(Aucune figure ajoutée)"));
    return paras;
  }

  for (const fig of figs) {
    // Title line: "Figure N — Titre de la figure ............... voir p. X"
    paras.push(new Paragraph({
      spacing: { ...LINE_SPACING, before: 80, after: 20 },
      children: [
        new TextRun({ text: `Figure ${fig.figureNumber}`, font: FONT, size: BODY_PT, bold: true }),
        new TextRun({ text: ` — ${fig.title}`, font: FONT, size: BODY_PT }),
        new TextRun({ text: "  ............... ", font: FONT, size: BODY_PT, color: "AAAAAA" }),
        new TextRun({ text: "voir p. X", font: FONT, size: BODY_PT, italics: true, color: "888888" }),
      ],
    }));
    // Source line (indented, italic)
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

function buildListeDesTableaux(): Paragraph[] {
  return [
    heading1("Liste des Tableaux"),
    emptyLine(),
    bodyPara("(Les tableaux seront numérotés automatiquement lors de la mise en page finale)"),
  ];
}

const ANNEXE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildAnnexes(d: Report): Paragraph[] {
  const items = d.annexeItems ?? [];
  const legacy = d.annexes?.trim();

  if (items.length === 0 && !legacy) return [];

  const paras: Paragraph[] = [heading1("Annexes"), emptyLine()];

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

// Table des Matières — LAST PAGE — real Word TOC field with page numbers + hyperlinks.
// updateFields: true on Document forces Word to populate it automatically on open.
function buildTableDesMatieres(): Paragraph[] {
  return [
    heading1("Table des Matières"),
    emptyLine(),
    new TableOfContents("Table des Matières", {
      hyperlink:         true,
      headingStyleRange: "1-4",
      stylesWithLevels: [
        new StyleLevel("Heading1", 1),
        new StyleLevel("Heading2", 2),
        new StyleLevel("Heading3", 3),
        new StyleLevel("Heading4", 4),
      ],
    }) as unknown as Paragraph,
  ];
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
    id: "Heading4",
    name: "Heading 4",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: BODY_PT, bold: true, italics: true },
    paragraph: { spacing: { before: 180, after: 80 }, keepNext: true },
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

export async function generateDocx(data: Report, formatting?: FormattingPrefs): Promise<Blob> {
  applyFormatting(formatting ?? useUserSettingsStore.getState().formatting);
  const header = buildHeader(data);
  const pageBase = { page: { margin: MARGIN } };

  const doc = new Document({
    features: { updateFields: true },  // forces Word to update TOC on open
    styles: { paragraphStyles: PARAGRAPH_STYLES },
    sections: [
      {
        // Page de garde — no page number
        properties: { ...pageBase },
        children: buildPageDeGarde(data),
      },
      {
        // Front matter — roman numerals (i, ii, iii…)
        properties: {
          page: {
            margin: MARGIN,
            pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
          },
        },
        headers: { default: header },
        footers: { default: buildFooter() },
        children: [
          ...buildDedicaces(data),
          ...buildRemerciements(data),
          ...buildResume(data),
          ...buildAbreviations(data),
          ...buildSommaire(data),
          ...(getApprovedFigures().length > 0 ? buildTableDesFigures() : []),
        ],
      },
      {
        // Body + back matter — arabic numerals starting at 1
        properties: {
          page: {
            margin: MARGIN,
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
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
          // Back-matter in user-defined order (draggable in Mon Rapport)
          ...(data.sectionOrder?.length ? data.sectionOrder : ["bibliographie", "listeDesTableaux", "annexes", "tableDesMatieres"])
            .flatMap((id) => {
              if (id === "bibliographie")    return buildBibliographie(data);
              if (id === "tableDesFigures")  return buildTableDesFigures();
              if (id === "listeDesTableaux") return buildListeDesTableaux();
              if (id === "annexes")          return buildAnnexes(data);
              if (id === "tableDesMatieres") return buildTableDesMatieres();
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
