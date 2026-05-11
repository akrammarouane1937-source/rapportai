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
 * If no labeled theme field was found, inject the theme into the largest blank
 * paragraph between the last "header field" (FILIERE/OPTION) and the first
 * "body field" (Réalisé par / Soutenu publiquement le).
 *
 * This handles EMSI-style templates where the theme area is a blank space with
 * no placeholder text — the student was expected to type directly.
 */
function injectThemeBetweenHeaderAndBody(xml: string, theme: string): string {
  if (!theme.trim()) return xml;

  // ── Locate boundaries ──────────────────────────────────────────────────────
  let lastHeaderEnd = -1;  // end position of the last FILIERE/OPTION paragraph
  let firstBodyStart = -1; // start position of the first Réalisé par paragraph

  const scan = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;

  while ((m = scan.exec(xml)) !== null) {
    const t = getParaText(m[0]).trim();
    if (!t) continue;

    // Header fields (FILIERE / OPTION / SPÉCIALITÉ are the last "labeled" items before the blank area)
    if (/^(fili[eè]re|option|sp[eé]cialit[eé]|formation)\s*:/i.test(t)) {
      lastHeaderEnd = m.index + m[0].length;
    }

    // Body starts at Réalisé par OR Soutenu publiquement le (whichever comes first)
    if (firstBodyStart === -1 &&
      /r[eé]alis[eé]\s*par|pr[eé]sent[eé]\s*par|soutenu\s*publiquement|par\s*:/i.test(t)) {
      firstBodyStart = m.index;
    }
  }

  if (lastHeaderEnd === -1 || firstBodyStart === -1 || lastHeaderEnd >= firstBodyStart) {
    return xml; // can't identify the blank area
  }

  // ── Find blank paragraphs in the gap ──────────────────────────────────────
  const gap = xml.slice(lastHeaderEnd, firstBodyStart);
  const blankRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let lastBlank: { match: string; offsetInGap: number } | null = null;

  while ((m = blankRe.exec(gap)) !== null) {
    if (!getParaText(m[0]).trim()) {
      lastBlank = { match: m[0], offsetInGap: m.index };
    }
  }

  if (!lastBlank) return xml; // no blank paragraphs to inject into

  // ── Inject theme into the last blank paragraph ────────────────────────────
  // Keep the paragraph's <w:pPr> (formatting), add a bold run with the theme.
  const themeRunXml = `<w:r><w:rPr><w:b/><w:color w:val="auto"/></w:rPr><w:t xml:space="preserve">${xmlEsc(theme)}</w:t></w:r>`;
  const filled = lastBlank.match.replace(/<\/w:p>$/, `${themeRunXml}</w:p>`);

  const absPos = lastHeaderEnd + lastBlank.offsetInGap;
  return xml.slice(0, absPos) + filled + xml.slice(absPos + lastBlank.match.length);
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

  // ── Pass 2: inject theme into blank area if not yet placed ────────────────
  if (!themeState.filled && d.theme) {
    console.debug("[fillDocx] theme not found in pass 1 — injecting between header and body");
    filled = injectThemeBetweenHeaderAndBody(filled, d.theme);
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

  // ── Theme — labeled with colon (e.g. "Thème : ………") ────────────────────
  if (/th[eè]me\s*:|sujet\s*:|intitul[eé]\s*:|titre\s*(du\s*)?(rapport|stage|m[eé]moire|pfe)\s*:/i.test(t)) {
    themeState.filled = true;
    return replaceParagraphValue(para, d.theme);
  }

  // ── Theme — placeholder label without colon (e.g. "INTITULÉ DU PFE") ────
  // These are standalone labels inside a box/table cell that get fully replaced.
  if (/^intitul[eé](\s+(du|de))?\s*(pfe|rapport|m[eé]moire|stage)?\s*$/i.test(t.trim()) ||
      /^th[eè]me(\s+(du|de))?\s*(pfe|rapport|m[eé]moire|stage)?\s*$/i.test(t.trim()) ||
      /^titre(\s+(du|de))?\s*(pfe|rapport|m[eé]moire|stage)?\s*$/i.test(t.trim()) ||
      /^(sujet|objet)\s+(du|de)\s*(pfe|rapport|m[eé]moire|stage)\s*$/i.test(t.trim())) {
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
