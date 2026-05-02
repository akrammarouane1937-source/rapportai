import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  NumberFormat,
  Packer,
  PageBreak,
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

const FONT = "Times New Roman";
const BODY_PT = 24; // 12pt in half-points
const H1_PT = 32;  // 16pt
const H2_PT = 28;  // 14pt
const H3_PT = 24;  // 12pt bold

const MARGIN = {
  top:    convertMillimetersToTwip(25),
  bottom: convertMillimetersToTwip(25),
  left:   convertMillimetersToTwip(30),
  right:  convertMillimetersToTwip(25),
};

const SPACING_BODY = { line: 360, lineRule: LineRuleType.AUTO };
const BEFORE_HEADING = 320;
const AFTER_HEADING  = 120;

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
    spacing: { ...SPACING_BODY, after: 160 },
    children: parseInlineRuns(text),
    ...extra,
  });
}

function heading1(text: string, pageBreak = false): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: BEFORE_HEADING, after: AFTER_HEADING },
    pageBreakBefore: pageBreak,
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: BEFORE_HEADING, after: AFTER_HEADING },
  });
}

function heading3(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [new TextRun("")] });
}

function centerPara(text: string, size = BODY_PT, bold = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 120 },
    children: [new TextRun({ text, font: FONT, size, bold })],
  });
}

/** Convert raw markdown text (from streaming) into docx Paragraphs */
function markdownToParas(md: string): Paragraph[] {
  if (!md?.trim()) return [bodyPara("(Section non générée)")];
  const lines = md.split("\n");
  const paras: Paragraph[] = [];
  let buf = "";

  const flushBuf = () => {
    if (buf.trim()) { paras.push(bodyPara(buf.trim())); buf = ""; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("### ")) { flushBuf(); paras.push(heading3(line.slice(4).trim())); }
    else if (line.startsWith("## ") || line.startsWith("# ")) {
      flushBuf();
      paras.push(heading2(line.replace(/^#{1,3} /, "").trim()));
    } else if (line === "") { flushBuf(); }
    else { buf += (buf ? " " : "") + line; }
  }
  flushBuf();
  return paras;
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildPageDeGarde(d: ReportData): Paragraph[] {
  const school   = d.school   || "École";
  const filiere  = d.filiere  || "Filière";
  const annee    = d.annee    || "2024–2025";
  const type     = d.reportType?.toUpperCase() || "RAPPORT";
  const theme    = d.theme    || "Titre du rapport";
  const student  = d.studentName || "Prénom NOM";
  const encPeda  = d.encadrantPeda || "";
  const encPro   = d.encadrantPro  || "";
  const ville    = d.ville    || "Casablanca";

  return [
    centerPara(school.toUpperCase(), H1_PT, true),
    centerPara(`Filière : ${filiere}`, BODY_PT),
    emptyLine(),
    centerPara(`Année universitaire ${annee}`, BODY_PT),
    emptyLine(),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: type, font: FONT, size: H1_PT + 8, bold: true, allCaps: true })],
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
    heading1("Dédicaces", true),
    emptyLine(),
    ...markdownToParas(d.dedicaces || "À ma famille et à mes proches qui m'ont soutenu tout au long de ce parcours."),
  ];
}

function buildRemerciements(d: ReportData): Paragraph[] {
  return [
    heading1("Remerciements", true),
    emptyLine(),
    ...markdownToParas(d.remerciements || "Je tiens à remercier sincèrement mon encadrant pédagogique pour ses précieux conseils et sa disponibilité tout au long de ce travail."),
  ];
}

function buildResume(d: ReportData): Paragraph[] {
  const mots = (d.motsCles || []).join(", ");
  return [
    heading1("Résumé", true),
    emptyLine(),
    ...markdownToParas(d.resume || ""),
    ...(mots ? [emptyLine(), bodyPara(`Mots-clés : ${mots}`, { spacing: { ...SPACING_BODY, after: 0 } })] : []),
    heading1("Abstract", true),
    emptyLine(),
    ...markdownToParas(d.abstract || ""),
    ...(d.keywords?.length ? [emptyLine(), bodyPara(`Keywords: ${d.keywords.join(", ")}`)] : []),
  ];
}

function buildAbreviations(d: ReportData): Paragraph[] {
  const rows = d.abreviations || [];
  if (rows.length === 0) return [];
  return [
    heading1("Liste des abréviations", true),
    emptyLine(),
    ...rows.map(r =>
      new Paragraph({
        spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 80 },
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
    heading1("Sommaire", true),
    emptyLine(),
    new TableOfContents("Table des matières", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }) as unknown as Paragraph,
  ];
}

function buildIntroduction(d: ReportData): Paragraph[] {
  return [
    heading1("Introduction Générale", true),
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
    heading1("Partie I", true),
    emptyLine(),
    ...markdownToParas(d.partieI || ""),
    ...buildFigureImages("Partie I"),
  ];
}

function buildPartieII(d: ReportData): Paragraph[] {
  return [
    heading1("Partie II", true),
    emptyLine(),
    ...markdownToParas(d.partieII || ""),
    ...buildFigureImages("Partie II"),
  ];
}

function buildConclusion(d: ReportData): Paragraph[] {
  const paras: Paragraph[] = [heading1("Conclusion Générale", true), emptyLine()];
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

/** Format one source entry according to the chosen citation style */
function formatBibEntry(s: BibSource, style: string): TextRun[] {
  const author  = s.authors || "Auteur inconnu";
  const year    = s.year    || "s.d.";
  const title   = s.title   || "Titre inconnu";
  const journal = s.journal || "";
  const doi     = s.doi     ? ` https://doi.org/${s.doi}` : "";

  const styleKey = style.toLowerCase();

  // APA 7th (default)
  if (styleKey.includes("apa")) {
    // Author, A. A. (Year). *Title*. Journal.
    return [
      new TextRun({ text: `${author} (${year}). `, font: FONT, size: BODY_PT }),
      new TextRun({ text: title, font: FONT, size: BODY_PT, italics: true }),
      ...(journal ? [new TextRun({ text: `. ${journal}`, font: FONT, size: BODY_PT })] : []),
      new TextRun({ text: doi, font: FONT, size: BODY_PT }),
    ];
  }

  // Chicago (Author-Date)
  if (styleKey.includes("chicago")) {
    // Author. Year. "Title." Journal.
    return [
      new TextRun({ text: `${author}. ${year}. "`, font: FONT, size: BODY_PT }),
      new TextRun({ text: title, font: FONT, size: BODY_PT }),
      new TextRun({ text: `."${journal ? ` ${journal}.` : ""}${doi}`, font: FONT, size: BODY_PT }),
    ];
  }

  // Vancouver / ICMJE
  if (styleKey.includes("vancouver")) {
    // Author. Title. Journal. Year.
    return [
      new TextRun({ text: `${author}. ${title}. `, font: FONT, size: BODY_PT }),
      ...(journal ? [new TextRun({ text: `${journal}. `, font: FONT, size: BODY_PT, italics: true })] : []),
      new TextRun({ text: `${year}.${doi}`, font: FONT, size: BODY_PT }),
    ];
  }

  // IEEE
  if (styleKey.includes("ieee")) {
    // [N] A. Author, "Title," Journal, Year.
    return [
      new TextRun({ text: `${author}, "`, font: FONT, size: BODY_PT }),
      new TextRun({ text: title, font: FONT, size: BODY_PT }),
      new TextRun({ text: `,"${journal ? ` ${journal},` : ""} ${year}.${doi}`, font: FONT, size: BODY_PT }),
    ];
  }

  // Fallback — same as APA
  return [
    new TextRun({ text: `${author} (${year}). `, font: FONT, size: BODY_PT }),
    new TextRun({ text: title, font: FONT, size: BODY_PT, italics: true }),
    ...(journal ? [new TextRun({ text: `. ${journal}`, font: FONT, size: BODY_PT })] : []),
    new TextRun({ text: doi, font: FONT, size: BODY_PT }),
  ];
}

function buildBibliographie(d: ReportData): Paragraph[] {
  // Prefer live BibSources from bibliothequeStore over static report.bibliographie
  const liveSources = getBibSources();
  const style       = d.citationStyle ?? "APA 7th ed.";

  if (liveSources.length > 0) {
    // Sort alphabetically by first author last name
    const sorted = [...liveSources].sort((a, b) =>
      (a.authors.split(/[,& ]/)[0] ?? "").localeCompare(b.authors.split(/[,& ]/)[0] ?? "", "fr")
    );
    return [
      heading1("Bibliographie", true),
      emptyLine(),
      ...sorted.map((s, i) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { ...SPACING_BODY, after: 140 },
          indent: { left: 720, hanging: 720 },
          children: [
            // IEEE prefix numbering
            ...(style.toLowerCase().includes("ieee")
              ? [new TextRun({ text: `[${i + 1}] `, font: FONT, size: BODY_PT, bold: true })]
              : []),
            ...formatBibEntry(s, style),
          ],
        })
      ),
    ];
  }

  // Fallback — static entries from ReportData (legacy / Step 9 manual input)
  const entries = d.bibliographie || [];
  if (entries.length === 0) return [];
  return [
    heading1("Bibliographie", true),
    emptyLine(),
    ...entries.map(e =>
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { ...SPACING_BODY, after: 120 },
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
  // Prefer live approved figures from figureStore over static report data
  const approved = getApprovedFigures();
  const liveFigs = approved.map((f) => ({ n: f.figureNumber, title: f.title, page: "—" }));
  const figs = liveFigs.length > 0 ? liveFigs : (d.figures || []);
  if (figs.length === 0) return [];
  return [
    heading1("Liste des figures", true),
    emptyLine(),
    ...figs.map((f) => bodyPara(`Figure ${f.n} — ${f.title} .......... ${f.page}`)),
  ];
}

function buildListeTableaux(d: ReportData): Paragraph[] {
  const tabs = d.tableaux || [];
  if (tabs.length === 0) return [];
  return [
    heading1("Liste des tableaux", true),
    emptyLine(),
    ...tabs.map(t => bodyPara(`Tableau ${t.n} — ${t.title} .......... ${t.page}`)),
  ];
}

function buildAnnexes(d: ReportData): Paragraph[] {
  const anx = d.annexes || [];
  if (anx.length === 0) return [];
  return [
    heading1("Annexes", true),
    emptyLine(),
    ...anx.map((a, i) => bodyPara(`Annexe ${i + 1} — ${a}`)),
  ];
}

// ─── Footer ──────────────────────────────────────────────────────────────────

const footerWithPageNum = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: BODY_PT })],
    }),
  ],
});

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateDocx(data: ReportData): Promise<Blob> {
  const pageProps = {
    page: {
      margin: MARGIN,
    },
  };

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: FONT, size: BODY_PT },
          paragraph: {
            spacing: SPACING_BODY,
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
            spacing: { before: BEFORE_HEADING, after: AFTER_HEADING },
            alignment: AlignmentType.CENTER,
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { font: FONT, size: H2_PT, bold: true },
          paragraph: {
            spacing: { before: BEFORE_HEADING, after: AFTER_HEADING },
          },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          run: { font: FONT, size: H3_PT, bold: true, italics: true },
          paragraph: {
            spacing: { before: 200, after: 80 },
          },
        },
      ],
    },

    sections: [
      // ── Section 1: Page de garde + Dédicaces (no page numbers) ──
      {
        properties: { ...pageProps },
        children: [
          ...buildPageDeGarde(data),
          ...buildDedicaces(data),
        ],
      },

      // ── Section 2: Page 3+ (centered bottom page numbers from 3) ──
      {
        properties: {
          ...pageProps,
          page: {
            margin: MARGIN,
            pageNumbers: {
              start: 3,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        footers: {
          default: footerWithPageNum,
        },
        children: [
          ...buildRemerciements(data),
          ...buildResume(data),
          ...buildAbreviations(data),
          ...buildSommaire(),
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
export async function generatePartialDocx(sectionTitle: string, rawMarkdown: string): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: MARGIN } },
        footers: { default: footerWithPageNum },
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
