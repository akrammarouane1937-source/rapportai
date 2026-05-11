export interface DocxFillData {
  studentName: string;
  school: string;
  filiere: string;
  theme: string;
  annee: string;
  reportType: string;
  encPeda: string;
  encPro: string;
  entreprise: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  jury1: string;
  jury2: string;
  jury3: string;
}

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function getParaText(para: string): string {
  return (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map(h => decodeXmlEntities(h.replace(/<[^>]+>/g, "")))
    .join("");
}

function frDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return iso; }
}

interface TextMatch {
  index: number;
  full: string;
  attrs: string;
  text: string;
}

function extractTextRuns(para: string): TextMatch[] {
  const pattern = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
  const out: TextMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(para)) !== null) {
    out.push({ index: m.index, full: m[0], attrs: m[1], text: m[2] });
  }
  return out;
}

/**
 * Replace a field value in a paragraph using exact character-index splicing.
 * Finds the colon-bearing run, keeps its label, inserts the value, clears all
 * subsequent runs (removes trailing dots, date fragments, etc.).
 */
function replaceParagraphValue(para: string, value: string): string {
  if (!value.trim()) return para;
  const esc = xmlEsc(value);

  const runs = extractTextRuns(para);
  if (runs.length === 0) return para;

  // Find the run containing the colon
  let colonRunIdx = -1;
  let colonPos = -1;
  for (let i = 0; i < runs.length; i++) {
    const p = runs[i].text.indexOf(":");
    if (p !== -1) { colonRunIdx = i; colonPos = p; }
  }

  if (colonRunIdx !== -1) {
    const cr = runs[colonRunIdx];
    const labelText = cr.text.substring(0, colonPos + 1);
    const newRunStr = `<w:t${cr.attrs}>${xmlEsc(labelText)} ${esc}</w:t>`;

    let result = para;
    let offset = 0;

    result =
      result.slice(0, cr.index + offset) +
      newRunStr +
      result.slice(cr.index + offset + cr.full.length);
    offset += newRunStr.length - cr.full.length;

    for (let i = colonRunIdx + 1; i < runs.length; i++) {
      const tr = runs[i];
      const emptyRun = `<w:t${tr.attrs}></w:t>`;
      const pos = tr.index + offset;
      result =
        result.slice(0, pos) +
        emptyRun +
        result.slice(pos + tr.full.length);
      offset += emptyRun.length - tr.full.length;
    }

    return result;
  }

  // Fallback: replace first run's text, clear the rest
  let result = para;
  let offset = 0;
  const first = runs[0];
  const firstNew = `<w:t${first.attrs}>${esc}</w:t>`;
  result =
    result.slice(0, first.index) +
    firstNew +
    result.slice(first.index + first.full.length);
  offset += firstNew.length - first.full.length;

  for (let i = 1; i < runs.length; i++) {
    const tr = runs[i];
    const emptyRun = `<w:t${tr.attrs}></w:t>`;
    const pos = tr.index + offset;
    result =
      result.slice(0, pos) +
      emptyRun +
      result.slice(pos + tr.full.length);
    offset += emptyRun.length - tr.full.length;
  }

  return result;
}

// ─── Theme injection (two-pass) ───────────────────────────────────────────────

/**
 * If no labeled theme field was found, insert a brand-new theme paragraph
 * directly before the first "body" paragraph (Réalisé par / Encadrant…).
 *
 * Why insert rather than modify an existing blank paragraph?
 * Blank paragraphs in EMSI-style templates often carry inherited run properties
 * (white color, hidden text, zero size) that make injected text invisible in
 * docx-preview even though Word renders it. A freshly constructed paragraph
 * with explicit formatting is guaranteed to be visible everywhere.
 */
const BODY_MARKER = /r[eé]alis[eé]\s*par|pr[eé]sent[eé]\s*par|soutenu\s*publiquement|encadrant|encadreur|tuteur|ma[iî]tre\s*de\s*stage/i;

/**
 * Find the correct insertion point for the theme paragraph.
 *
 * Critical: in many templates (EMSI, etc.) the student-info section lives inside
 * a <w:tbl>.  Inserting a bare <w:p> at the position of a paragraph that is
 * INSIDE a table corrupts the OOXML structure.
 *
 * Strategy:
 *  1. Find the first paragraph that matches a body marker.
 *  2. Walk BACKWARDS from that position in the raw XML string.
 *     If we encounter a <w:tbl start before encountering a matching </w:tbl>,
 *     the paragraph is inside a table → use that <w:tbl position as the
 *     insertion point (we insert BEFORE the whole table).
 *  3. Otherwise the paragraph is a top-level paragraph → insert before it.
 */
function insertThemeBeforeBody(xml: string, theme: string): string {
  if (!theme.trim()) return xml;

  const scan = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  let bodyParaPos = -1;

  while ((m = scan.exec(xml)) !== null) {
    const t = getParaText(m[0]).trim();
    if (!t) continue;
    if (BODY_MARKER.test(t)) {
      bodyParaPos = m.index;
      break;
    }
  }

  if (bodyParaPos === -1) return xml;

  // ── Check whether bodyParaPos is inside a <w:tbl> ─────────────────────
  const before = xml.slice(0, bodyParaPos);
  const lastTblOpen  = before.lastIndexOf("<w:tbl");
  const lastTblClose = before.lastIndexOf("</w:tbl>");

  // If the most recent tbl tag is an OPEN (not a close), the paragraph is
  // inside a table — insert before the table's opening tag instead.
  const insertionPoint = (lastTblOpen > lastTblClose)
    ? lastTblOpen
    : bodyParaPos;

  const newPara =
    `<w:p>` +
      `<w:pPr>` +
        `<w:jc w:val="center"/>` +
        `<w:spacing w:before="160" w:after="160"/>` +
      `</w:pPr>` +
      `<w:r>` +
        `<w:rPr>` +
          `<w:b/>` +
          `<w:color w:val="000000"/>` +
          `<w:sz w:val="24"/>` +
          `<w:szCs w:val="24"/>` +
        `</w:rPr>` +
        `<w:t xml:space="preserve">${xmlEsc(theme)}</w:t>` +
      `</w:r>` +
    `</w:p>`;

  return xml.slice(0, insertionPoint) + newPara + xml.slice(insertionPoint);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fillDocxTemplate(
  buf: ArrayBuffer,
  d: DocxFillData
): Promise<ArrayBuffer> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);

  const docFile = zip.file("word/document.xml");
  if (!docFile) return buf;

  const xml = await docFile.async("text");

  const juryValues = [d.jury1, d.jury2, d.jury3].filter(Boolean);
  const jury = { idx: 0 };
  const themeState = { filled: false };

  // ── Pass 1: label-based replacement ───────────────────────────────────────
  let filled = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) =>
    processPara(para, d, juryValues, jury, themeState)
  );

  // ── Pass 2: insert theme before body if not yet placed by a label ────────
  if (!themeState.filled && d.theme) {
    filled = insertThemeBeforeBody(filled, d.theme);
  }

  zip.file("word/document.xml", filled);
  return zip.generateAsync({ type: "arraybuffer" });
}

// ─── Per-paragraph label detection ───────────────────────────────────────────

function processPara(
  para: string,
  d: DocxFillData,
  juryValues: string[],
  jury: { idx: number },
  themeState: { filled: boolean }
): string {
  const text = getParaText(para);
  if (!text.trim()) return para;

  const t = text;

  // ── Stage dates ──────────────────────────────────────────────────────────
  if (/date\s*(du\s*)?d[eé]but|d[eé]but\s*(du\s*)?stage|date\s*d.entr[eé]e|^du\s*:/i.test(t))
    return replaceParagraphValue(para, frDate(d.dateDebut));

  if (/date\s*(de\s*(la\s*)?)?fin|fin\s*(du\s*)?stage|date\s*de\s*sortie|^au\s*:/i.test(t))
    return replaceParagraphValue(para, frDate(d.dateFin));

  // ── Soutenance date — skip (leave as-is, student fills manually) ─────────
  if (/soutenu\s*publiquement|date\s*(de\s*)?soutenance/i.test(t))
    return para;

  // ── Location ─────────────────────────────────────────────────────────────
  if (/lieu\s*(du|de)\s*stage|lieu\s*:|adresse\s*:/i.test(t))
    return replaceParagraphValue(para, d.ville);

  // ── Company ──────────────────────────────────────────────────────────────
  if (/entreprise|soci[eé]t[eé]|organisme\s*d.accueil|structure\s*d.accueil/i.test(t))
    return replaceParagraphValue(para, d.entreprise);

  // ── Supervisors ──────────────────────────────────────────────────────────
  if (/encadrant\s*(p[eé]dagogique|p[eé]da|acad[eé]mique)|tuteur\s*acad[eé]mique/i.test(t))
    return replaceParagraphValue(para, d.encPeda);

  if (/encadrant\s*(professionnel|pro\b)|ma[iî]tre\s*de\s*stage|tuteur\s*(professionnel|entreprise)/i.test(t))
    return replaceParagraphValue(para, d.encPro);

  // ── Student name ─────────────────────────────────────────────────────────
  if (/r[eé]alis[eé]\s*par|pr[eé]sent[eé]\s*par|par\s*:|nom\s*(et\s*)?pr[eé]nom|l.[eé]tudiant|[eé]tudiant\s*:|mme\s*\/\s*m\./i.test(t))
    return replaceParagraphValue(para, d.studentName);

  // ── Filière / Option — leave as-is (already printed in template) ─────────
  if (/^(fili[eè]re|option|sp[eé]cialit[eé]|formation)\s*:/i.test(t.trim()))
    return para;

  // ── Academic year ─────────────────────────────────────────────────────────
  if (/ann[eé]e\s*(universitaire|acad[eé]mique)/i.test(t)) {
    const runs = extractTextRuns(para);
    for (const run of runs) {
      if (/\d{4}\s*[-–]\s*\d{4}/.test(run.text)) {
        const newText = run.text.replace(/\d{4}\s*[-–]\s*\d{4}/, d.annee);
        return (
          para.slice(0, run.index) +
          `<w:t${run.attrs}>${xmlEsc(newText)}</w:t>` +
          para.slice(run.index + run.full.length)
        );
      }
    }
    return replaceParagraphValue(para, d.annee);
  }

  // ── Theme — any keyword followed by colon ────────────────────────────────
  // Matches: "Thème :", "Sujet :", "Intitulé :", "Titre :", "Titre du PFE :", etc.
  if (/(th[eè]me|sujet|intitul[eé]|titre|objet)\s*:/i.test(t)) {
    themeState.filled = true;
    return replaceParagraphValue(para, d.theme);
  }

  // ── Theme — standalone label (no colon), paragraph IS the placeholder ────
  // Covers: "INTITULÉ DU PFE", "THÈME", "TITRE DU MÉMOIRE", "SUJET DU STAGE",
  //         "OBJET DU RAPPORT", etc.
  // Rule: paragraph starts with a theme keyword AND is short (≤ 8 words) AND
  //       has no colon (colon case is already handled above).
  if (
    /^(intitul[eé]|th[eè]me|titre|sujet|objet)\b/i.test(t.trim()) &&
    !t.includes(":") &&
    t.trim().split(/\s+/).length <= 8
  ) {
    themeState.filled = true;
    return replaceParagraphValue(para, d.theme);
  }

  // ── Jury members — lines starting with a title and containing dots ────────
  if (/^(pr\.|dr\.|m\.|mme\.?)\s*/i.test(t.trim()) && /\.{3,}/.test(t)) {
    const val = juryValues[jury.idx] ?? "";
    jury.idx++;
    return val ? replaceParagraphValue(para, val) : para;
  }

  return para;
}

export { extractTextRuns };
