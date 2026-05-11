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
  full: string;   // the entire <w:t ...>...</w:t> string
  attrs: string;  // attributes inside <w:t ...>
  text: string;   // inner text (raw, not decoded)
}

/** Extract all <w:t> elements with their byte positions in the paragraph string. */
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
 *
 * Why index-based?  String.replace(str, repl) replaces the FIRST occurrence of
 * `str` — when several <w:t> elements share the same text (e.g. "." repeated
 * across multiple runs), repeated calls to .replace() would silently modify the
 * wrong run.  Splicing by position is unambiguous.
 *
 * Algorithm:
 *  1. Find the run that contains the field's colon separator.
 *  2. Keep the label (text up to ":"), append " " + value.
 *  3. Clear ALL subsequent <w:t> runs (removes dots, date fragments, "Mme/M.", etc.).
 *
 * Fallback (no-colon paragraphs, e.g. "Pr. ……" or all-dots theme placeholder):
 *  Replace the trailing dots while keeping any prefix ("Pr. ").
 */
function replaceParagraphValue(para: string, value: string): string {
  if (!value.trim()) return para;
  const esc = xmlEsc(value);

  const runs = extractTextRuns(para);
  if (runs.length === 0) return para;

  // ── Find the run that contains the label colon ──────────────────────────
  let colonRunIdx = -1;
  let colonPos = -1;
  for (let i = 0; i < runs.length; i++) {
    const p = runs[i].text.indexOf(":");
    if (p !== -1) { colonRunIdx = i; colonPos = p; }
  }

  if (colonRunIdx !== -1) {
    const cr = runs[colonRunIdx];
    const labelText = cr.text.substring(0, colonPos + 1); // "Label :" kept
    const newRunStr = `<w:t${cr.attrs}>${xmlEsc(labelText)} ${esc}</w:t>`;

    // Build result with index-based splicing (offset tracks string length changes)
    let result = para;
    let offset = 0;

    // Replace the colon run
    result =
      result.slice(0, cr.index + offset) +
      newRunStr +
      result.slice(cr.index + offset + cr.full.length);
    offset += newRunStr.length - cr.full.length;

    // Clear every run that comes AFTER the colon run
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

  // ── Fallback: no colon — paragraph like "Pr. ………" or all-dots theme ──
  // Keep whatever prefix precedes the dots, replace dots onward with value.
  const noColonResult = para.replace(
    /<w:t([^>]*)>([^<]*?)(\.{3,}|[…‥]+|[.…‥\s]{5,})([^<]*)<\/w:t>/,
    `<w:t$1>$2${esc}</w:t>`
  );
  if (noColonResult !== para) return noColonResult;

  // ── Replace ALL runs with the value in the first run, clear the rest ──
  if (runs.length === 1) {
    const r = runs[0];
    return (
      para.slice(0, r.index) +
      `<w:t${r.attrs}>${esc}</w:t>` +
      para.slice(r.index + r.full.length)
    );
  }

  // Multiple runs, no colon — put value in first run, clear others
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

  const filled = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) =>
    processPara(para, d, juryValues, jury, themeState)
  );

  zip.file("word/document.xml", filled);
  return zip.generateAsync({ type: "arraybuffer" });
}

// ─── Per-paragraph label detection ───────────────────────────────────────────

function isDotsOnly(text: string): boolean {
  // Paragraph made entirely of dots, ellipsis chars, underscores, dashes, spaces
  const stripped = text.replace(/[.…‥․_\s\-–—\/]/g, "");
  return stripped.length === 0 && text.replace(/\s/g, "").length >= 5;
}

function processPara(
  para: string,
  d: DocxFillData,
  juryValues: string[],
  jury: { idx: number },
  themeState: { filled: boolean }
): string {
  const text = getParaText(para);
  if (!text.trim()) return para;

  const t = text; // alias for readability

  // ── Stage dates ──────────────────────────────────────────────────────────
  if (/date\s*(du\s*)?d[eé]but|d[eé]but\s*(du\s*)?stage|date\s*d.entr[eé]e|^du\s*:/i.test(t))
    return replaceParagraphValue(para, frDate(d.dateDebut));

  if (/date\s*(de\s*(la\s*)?)?fin|fin\s*(du\s*)?stage|date\s*de\s*sortie|^au\s*:/i.test(t))
    return replaceParagraphValue(para, frDate(d.dateFin));

  // ── Location ─────────────────────────────────────────────────────────────
  if (/lieu\s*(du|de)\s*stage|lieu\s*:|adresse\s*:/i.test(t))
    return replaceParagraphValue(para, d.ville);

  // ── Company ──────────────────────────────────────────────────────────────
  if (/entreprise|soci[eé]t[eé]|organisme\s*d.accueil|structure\s*d.accueil/i.test(t))
    return replaceParagraphValue(para, d.entreprise);

  // ── Supervisors — pédagogique must come before generic ───────────────────
  if (/encadrant\s*(p[eé]dagogique|p[eé]da|acad[eé]mique)|tuteur\s*acad[eé]mique/i.test(t))
    return replaceParagraphValue(para, d.encPeda);

  if (/encadrant\s*(professionnel|pro\b)|ma[iî]tre\s*de\s*stage|tuteur\s*(professionnel|entreprise)/i.test(t))
    return replaceParagraphValue(para, d.encPro);

  // ── Student name ─────────────────────────────────────────────────────────
  if (/r[eé]alis[eé]\s*par|pr[eé]sent[eé]\s*par|par\s*:|nom\s*(et\s*)?pr[eé]nom|l.[eé]tudiant|[eé]tudiant\s*:|mme\s*\/\s*m\./i.test(t))
    return replaceParagraphValue(para, d.studentName);

  // ── Filière ──────────────────────────────────────────────────────────────
  if (/^fili[eè]re\s*:|^sp[eé]cialit[eé]\s*:|^option\s*:|^formation\s*:/i.test(t.trim()))
    return replaceParagraphValue(para, d.filiere);

  // ── Academic year ─────────────────────────────────────────────────────────
  if (/ann[eé]e\s*(universitaire|acad[eé]mique)/i.test(t)) {
    // First try replacing an already-present year like "2023-2024"
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

  // ── Theme / title — labeled ───────────────────────────────────────────────
  if (/th[eè]me\s*:|sujet\s*:|intitul[eé]\s*:|titre\s*(du\s*)?(rapport|stage|m[eé]moire|pfe)/i.test(t)) {
    themeState.filled = true;
    return replaceParagraphValue(para, d.theme);
  }

  // ── Jury members — only lines that contain dots ───────────────────────────
  if (/^(pr\.|dr\.|m\.|mme\.?)\s*/i.test(t.trim()) && /\.{3,}/.test(t)) {
    const val = juryValues[jury.idx] ?? "";
    jury.idx++;
    return val ? replaceParagraphValue(para, val) : para;
  }

  // ── Theme fallback — unlabeled all-dots paragraph (e.g. "………………………") ──
  // Only fires if no label was detected above, theme hasn't been filled yet,
  // and the paragraph is made entirely of placeholder characters.
  if (!themeState.filled && d.theme && isDotsOnly(t)) {
    themeState.filled = true;
    return replaceParagraphValue(para, d.theme);
  }

  return para;
}

// Re-export extractTextRuns so replaceParagraphValue can use it in processPara
export { extractTextRuns };
