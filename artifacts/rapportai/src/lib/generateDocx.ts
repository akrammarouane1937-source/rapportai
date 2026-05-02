import {
  AlignmentType,
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
  TableOfContents,
  TextRun,
  convertMillimetersToTwip,
} from "docx";
import type { ReportData } from "./reportStore";
import { getApprovedFigures } from "./figureStore";
import { getBibSources, type BibSource } from "./bibliothequeStore";

// ─── Constants ───────────────────────────────────────────────────────────────

const FONT       = "Times New Roman";
const BODY_PT    = 24;   // 12pt in half-points
const H1_PT      = 32;   // 16pt
const H2_PT      = 28;   // 14pt
const H3_PT      = 24;   // 12pt bold
const FOOTER_PT  = 20;   // 10pt

// All margins 2.5 cm; header/footer gutter 1 cm
const MARGIN = {
  top:    convertMillimetersToTwip(25),
  bottom: convertMillimetersToTwip(25),
  left:   convertMillimetersToTwip(25),
  right:  convertMillimetersToTwip(25),
  header: convertMillimetersToTwip(10),
  footer: convertMillimetersToTwip(10),
};

// 1.5 line spacing (360 twips AUTO)
const LINE_SPACING = { line: 360, lineRule: LineRuleType.AUTO };

// 6 pt before / 6 pt after (1 pt = 20 twips → 6 pt = 120 twips)
const PARA_SPACING = { ...LINE_SPACING, before: 120, after: 120 };

// First-line indent: 1 cm
const FIRST_LINE = convertMillimetersToTwip(10);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bodyRun(text: string, opts: { bold?: boolean; italic?: boolean } = {}): TextRun {
  return new TextRun({ text, font: FONT, size: BODY_PT, bold: opts.bold, italics: opts.italic });
}

/** Parse **bold** and *italic* inline markers into TextRuns. Never produces underline. */
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

/** Body paragraph: Times New Roman 12pt, justified, 1.5 spacing, 1cm first-line indent, 6pt before/after, no hyphenation */
function bodyPara(text: string, extra: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: PARA_SPACING,
    indent: { firstLine: FIRST_LINE },
    children: parseInlineRuns(text),
    ...extra,
  });
}

/** Heading 1 — 16pt bold, centered, always starts on new page */
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

/** Heading 2 — 14pt bold, kept with next paragraph */
function heading2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 },
    keepNext: true,
  });
}

/** Heading 3 — 12pt bold (no italic, no underline), kept with next paragraph */
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

/** Convert raw markdown text (from Claude streaming) into docx Paragraphs.
 *  Rules:
 *  - ### line → Heading 3
 *  - ## line  → Heading 2
 *  - # line   → Heading 1
 *  - blank line → flush current buffer as a body paragraph
 *  - other line → accumulated into current paragraph buffer
 *  Each buffer flush produces exactly ONE Paragraph object — never a wall of text.
 */
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
      // Accumulate within the same paragraph (word-wrap)
      buf += (buf ? " " : "") + line;
    }
  }
  flushBuf();
  return paras;
}

// ─── Header / Footer builders ─────────────────────────────────────────────────

function buildHeader(data: ReportData): Header {
  const rawTitle = data.theme || "";
  const title    = rawTitle.length > 40 ? rawTitle.slice(0, 37) + "…" : rawTitle;
  const author   = data.studentName || "";
  const text     = title && author ? `${title}     ${author}` : title || author;

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: 240, lineRule: LineRuleType.AUTO },
        children: [
          new TextRun({ text, font: FONT, size: FOOTER_PT }),
        ],
      }),
    ],
  });
}

function buildFooterRoman(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: FOOTER_PT })],
      }),
    ],
  });
}

function buildFooterArabic(): Footer {
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

function buildPageDeGarde(d: ReportData): Paragraph[] {
  const school   = d.school      || "École";
  const filiere  = d.filiere     || "Filière";
  const annee    = d.annee       || "2024–2025";
  const type     = d.reportType  || "Rapport";
  const theme    = d.theme       || "Titre du rapport";
  const student  = d.studentName || "Prénom Nom";
  const encPeda  = d.encadrantPeda || "";
  const encPro   = d.encadrantPro  || "";
  const ville    = d.ville       || "Casablanca";

  return [
    centerPara(school, H1_PT, true),
    centerPara(`Filière : ${filiere}`, BODY_PT),
    emptyLine(),
    centerPara(`Année universitaire ${annee}`, BODY_PT),
    emptyLine(),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: type, font: FONT, size: H1_PT + 8, bold: true })],
      spacing: { before: 720, after: 240 },
    }),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: "single", size: 6, color: "7c3aed" } },
      spacing: { after: 480 },
      children: [new TextRun({ text: theme, font: FONT, size: H2_PT + 2, bold: true })],
    }),
    emptyLine(),
    centerPara(`Réalisé par : ${student}`, BODY_PT),
    ...(encPeda ? [centerPara(`Encadrant pédagogique : ${encPeda}`, BODY_PT)] : []),
    ...(encPro  ? [centerPara(`Encadrant professionnel : ${encPro}`, BODY_PT)] : []),
    ...(d.entreprise ? [centerPara(`Entreprise d'accueil : ${d.entreprise}`, BODY_PT)] : []),
    emptyLine(),
    centerPara(`${ville} — ${annee}`, BODY_PT),
  ];
}

function buildDedicaces(d: ReportData): Paragraph[] {
  return [
    heading1("Dédicaces"),
    emptyLine(),
    ...markdownToParas(d.dedicaces || "À ma famille et à mes proches qui m'ont soutenu tout au long de ce parcours."),
  ];
}

function buildRemerciements(d: ReportData): Paragraph[] {
  return [
    heading1("Remerciements"),
    emptyLine(),
    ...markdownToParas(d.remerciements || "Je tiens à remercier sincèrement mon encadrant pédagogique pour ses précieux conseils et sa disponibilité tout au long de ce travail."),
  ];
}

function buildResume(d: ReportData): Paragraph[] {
  const mots = (d.motsCles || []).join(", ");
  return [
    heading1("Résumé"),
    emptyLine(),
    ...markdownToParas(d.resume || ""),
    ...(mots ? [emptyLine(), bodyPara(`Mots-clés : ${mots}`, { indent: { firstLine: 0 } })] : []),
    heading1("Abstract"),
    emptyLine(),
    ...markdownToParas(d.abstract || ""),
    ...(d.keywords?.length ? [emptyLine(), bodyPara(`Keywords: ${d.keywords.join(", ")}`, { indent: { firstLine: 0 } })] : []),
  ];
}

function buildAbreviations(d: ReportData): Paragraph[] {
  const rows = d.abreviations || [];
  if (rows.length === 0) return [];
  return [
    heading1("Liste des abréviations"),
    emptyLine(),
    ...rows.map(r =>
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

function buildIntroduction(d: ReportData): Paragraph[] {
  return [
    heading1("Introduction Générale"),
    emptyLine(),
    ...markdownToParas(d.introduction || ""),
  ];
}

// ─── Figure image helpers ─────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  const stripped = base64.replace(/^data:image\/\w+;base64,/, "");
  const raw = atob(stripped);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function buildFigureImages(placement: "Partie I" | "Partie II"): Paragraph[] {
  const figures = getApprovedFigures().filter((f) => f.placement === placement);
  if (figures.length === 0) return [];

  const paras: Paragraph[] = [heading2("Figures et illustrations"), emptyLine()];
  for (const fig of figures) {
    try {
      const data = base64ToUint8Array(fig.pngBase64);
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 280, after: 120 },
          children: [
            new ImageRun({
              type: "png",
              data,
              transformation: { width: fig.width ?? 500, height: fig.height ?? 280 },
            }),
          ],
        }),
        centerPara(fig.caption, BODY_PT, true),
        bodyPara(fig.description),
        emptyLine(),
      );
    } catch {
      // skip malformed figure
    }
  }
  return paras;
}

function buildPartieI(d: ReportData): Paragraph[] {
  return [
    heading1("Partie I"),
    emptyLine(),
    ...markdownToParas(d.partieI || ""),
    ...buildFigureImages("Partie I"),
  ];
}

function buildPartieII(d: ReportData): Paragraph[] {
  return [
    heading1("Partie II"),
    emptyLine(),
    ...markdownToParas(d.partieII || ""),
    ...buildFigureImages("Partie II"),
  ];
}

function buildConclusion(d: ReportData): Paragraph[] {
  const paras: Paragraph[] = [heading1("Conclusion Générale"), emptyLine()];
  if (d.conclusion) paras.push(...markdownToParas(d.conclusion));
  if (d.apports) {
    paras.push(heading2("Apports et limites"), ...markdownToParas(d.apports));
  }
  if (d.perspectives) {
    paras.push(heading2("Perspectives futures"), ...markdownToParas(d.perspectives));
  }
  return paras;
}

// ─── Citation formatters ──────────────────────────────────────────────────────

function formatBibEntry(s: BibSource, style: string): TextRun[] {
  const author  = s.authors || "Auteur inconnu";
  const year    = s.year    || "s.d.";
  const title   = s.title   || "Titre inconnu";
  const journal = s.journal || "";
  const doi     = s.doi     ? ` https://doi.org/${s.doi}` : "";
  const styleKey = style.toLowerCase();

  if (styleKey.includes("apa")) {
    return [
      new TextRun({ text: `${author} (${year}). `, font: FONT, size: BODY_PT }),
      new TextRun({ text: title, font: FONT, size: BODY_PT, italics: true }),
      ...(journal ? [new TextRun({ text: `. ${journal}`, font: FONT, size: BODY_PT })] : []),
      new TextRun({ text: doi, font: FONT, size: BODY_PT }),
    ];
  }
  if (styleKey.includes("chicago")) {
    return [
      new TextRun({ text: `${author}. ${year}. "`, font: FONT, size: BODY_PT }),
      new TextRun({ text: title, font: FONT, size: BODY_PT }),
      new TextRun({ text: `."${journal ? ` ${journal}.` : ""}${doi}`, font: FONT, size: BODY_PT }),
    ];
  }
  if (styleKey.includes("vancouver")) {
    return [
      new TextRun({ text: `${author}. ${title}. `, font: FONT, size: BODY_PT }),
      ...(journal ? [new TextRun({ text: `${journal}. `, font: FONT, size: BODY_PT, italics: true })] : []),
      new TextRun({ text: `${year}.${doi}`, font: FONT, size: BODY_PT }),
    ];
  }
  if (styleKey.includes("ieee")) {
    return [
      new TextRun({ text: `${author}, "`, font: FONT, size: BODY_PT }),
      new TextRun({ text: title, font: FONT, size: BODY_PT }),
      new TextRun({ text: `,"${journal ? ` ${journal},` : ""} ${year}.${doi}`, font: FONT, size: BODY_PT }),
    ];
  }
  // Fallback — APA
  return [
    new TextRun({ text: `${author} (${year}). `, font: FONT, size: BODY_PT }),
    new TextRun({ text: title, font: FONT, size: BODY_PT, italics: true }),
    ...(journal ? [new TextRun({ text: `. ${journal}`, font: FONT, size: BODY_PT })] : []),
    new TextRun({ text: doi, font: FONT, size: BODY_PT }),
  ];
}

function buildBibliographie(d: ReportData): Paragraph[] {
  const liveSources = getBibSources();
  const style       = d.citationStyle ?? "APA 7th ed.";

  if (liveSources.length > 0) {
    const sorted = [...liveSources].sort((a, b) =>
      (a.authors.split(/[,& ]/)[0] ?? "").localeCompare(b.authors.split(/[,& ]/)[0] ?? "", "fr")
    );
    return [
      heading1("Bibliographie"),
      emptyLine(),
      ...sorted.map((s, i) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: PARA_SPACING,
          indent: { left: 720, hanging: 720 },
          children: [
            ...(style.toLowerCase().includes("ieee")
              ? [new TextRun({ text: `[${i + 1}] `, font: FONT, size: BODY_PT, bold: true })]
              : []),
            ...formatBibEntry(s, style),
          ],
        })
      ),
    ];
  }

  const entries = d.bibliographie || [];
  if (entries.length === 0) return [];
  return [
    heading1("Bibliographie"),
    emptyLine(),
    ...entries.map(e =>
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: PARA_SPACING,
        indent: { left: 720, hanging: 720 },
        children: [
          new TextRun({ text: `${e.author} (${e.year}). `, font: FONT, size: BODY_PT }),
          new TextRun({ text: e.title, font: FONT, size: BODY_PT, italics: true }),
          new TextRun({ text: `. ${e.journal}`, font: FONT, size: BODY_PT }),
        ],
      })
    ),
  ];
}

function buildTableFigures(d: ReportData): Paragraph[] {
  const approved = getApprovedFigures();
  const liveFigs = approved.map((f) => ({ n: f.figureNumber, title: f.title, page: "—" }));
  const figs = liveFigs.length > 0 ? liveFigs : (d.figures || []);
  if (figs.length === 0) return [];
  return [
    heading1("Liste des figures"),
    emptyLine(),
    ...figs.map((f) => bodyPara(`Figure ${f.n} — ${f.title} .......... ${f.page}`)),
  ];
}

function buildListeTableaux(d: ReportData): Paragraph[] {
  const tabs = d.tableaux || [];
  if (tabs.length === 0) return [];
  return [
    heading1("Liste des tableaux"),
    emptyLine(),
    ...tabs.map(t => bodyPara(`Tableau ${t.n} — ${t.title} .......... ${t.page}`)),
  ];
}

function buildAnnexes(d: ReportData): Paragraph[] {
  const anx = d.annexes || [];
  if (anx.length === 0) return [];
  return [
    heading1("Annexes"),
    emptyLine(),
    ...anx.map((a, i) => bodyPara(`Annexe ${i + 1} — ${a}`)),
  ];
}

// ─── Paragraph styles ─────────────────────────────────────────────────────────

const PARAGRAPH_STYLES = [
  {
    id: "Normal",
    name: "Normal",
    run: { font: FONT, size: BODY_PT },
    paragraph: {
      spacing: PARA_SPACING,
      alignment: AlignmentType.JUSTIFIED,
    },
  },
  {
    id: "Heading1",
    name: "Heading 1",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: H1_PT, bold: true },
    paragraph: {
      spacing: { before: 480, after: 240 },
      alignment: AlignmentType.CENTER,
      keepNext: true,
    },
  },
  {
    id: "Heading2",
    name: "Heading 2",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: H2_PT, bold: true },
    paragraph: {
      spacing: { before: 360, after: 180 },
      keepNext: true,
    },
  },
  {
    id: "Heading3",
    name: "Heading 3",
    basedOn: "Normal",
    next: "Normal",
    run: { font: FONT, size: H3_PT, bold: true },
    paragraph: {
      spacing: { before: 240, after: 120 },
      keepNext: true,
    },
  },
];

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateDocx(data: ReportData): Promise<Blob> {
  const header = buildHeader(data);

  const pageBase = {
    page: { margin: MARGIN },
  };

  const doc = new Document({
    styles: { paragraphStyles: PARAGRAPH_STYLES },

    sections: [
      // ── Section 1: Page de garde — no page numbers, no header/footer ──
      {
        properties: { ...pageBase },
        children: buildPageDeGarde(data),
      },

      // ── Section 2: Preliminary pages — Roman numerals (I, II, III…) ──
      {
        properties: {
          page: {
            margin: MARGIN,
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.UPPER_ROMAN,
            },
          },
        },
        headers: { default: header },
        footers: { default: buildFooterRoman() },
        children: [
          ...buildDedicaces(data),
          ...buildRemerciements(data),
          ...buildResume(data),
          ...buildAbreviations(data),
          ...buildSommaire(),
        ],
      },

      // ── Section 3: Body — Arabic numerals starting at 1 ──
      {
        properties: {
          page: {
            margin: MARGIN,
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        headers: { default: header },
        footers: { default: buildFooterArabic() },
        children: [
          ...buildIntroduction(data),
          ...buildPartieI(data),
          ...buildPartieII(data),
          ...buildConclusion(data),
          ...buildBibliographie(data),
          ...buildTableFigures(data),
          ...buildListeTableaux(data),
          ...buildAnnexes(data),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

/** Quick export of a single section for the WordPreview header button */
export async function generatePartialDocx(sectionTitle: string, rawMarkdown: string, data?: ReportData): Promise<Blob> {
  const header = data ? buildHeader(data) : undefined;
  const doc = new Document({
    styles: { paragraphStyles: PARAGRAPH_STYLES },
    sections: [
      {
        properties: { page: { margin: MARGIN } },
        ...(header ? { headers: { default: header } } : {}),
        footers: { default: buildFooterArabic() },
        children: [
          heading1(sectionTitle),
          emptyLine(),
          ...markdownToParas(rawMarkdown),
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
