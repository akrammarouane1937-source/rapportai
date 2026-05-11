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

/** Concatenate all <w:t> text in a paragraph (for context detection only). */
function getParaText(para: string): string {
  return (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map(h => h.replace(/<[^>]+>/g, ""))
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

/**
 * Replace the value in a labeled paragraph.
 *
 * Strategy: find the colon (:) in the paragraph text runs.
 * Everything from the colon onwards is the placeholder.
 * We keep the label (up to and including the colon), insert the value,
 * and clear all subsequent text runs — regardless of whether the placeholder
 * is dots, date patterns, text, or invisible tab leaders.
 *
 * Fallback for no-colon paragraphs (e.g. "Pr. ......"):
 * replace prefix + dots pattern keeping the prefix.
 */
function replaceParagraphValue(para: string, value: string): string {
  if (!value) return para;
  const esc = xmlEsc(value);

  const allTextMatches = [...para.matchAll(/<w:t([^>]*)>([^<]*)<\/w:t>/g)];
  if (allTextMatches.length === 0) return para;

  // Find the run that contains the colon
  let colonRunIdx = -1;
  let colonPosInRun = -1;
  for (let i = 0; i < allTextMatches.length; i++) {
    const pos = allTextMatches[i][2].indexOf(":");
    if (pos !== -1) {
      colonRunIdx = i;
      colonPosInRun = pos;
    }
  }

  if (colonRunIdx !== -1) {
    let result = para;

    // Replace the colon run: keep label + ":" + " " + value
    const cr = allTextMatches[colonRunIdx];
    const labelPart = cr[2].substring(0, colonPosInRun + 1); // everything up to and including ":"
    result = result.replace(
      cr[0],
      `<w:t${cr[1]}>${xmlEsc(labelPart)} ${esc}</w:t>`
    );

    // Clear all text runs that came AFTER the colon run
    for (let i = colonRunIdx + 1; i < allTextMatches.length; i++) {
      const t = allTextMatches[i];
      result = result.replace(t[0], `<w:t${t[1]}></w:t>`);
    }

    return result;
  }

  // No colon — paragraph like "Pr. ........" (jury member line).
  // Keep whatever prefix exists before the dots and put value after it.
  let r = para.replace(
    /<w:t([^>]*)>([^<]*?)(\.{3,}[\s\S]*?)<\/w:t>/,
    `<w:t$1>$2${esc}</w:t>`
  );
  if (r !== para) return r;

  // Last resort: put value in the last text run
  const last = allTextMatches[allTextMatches.length - 1];
  return para.replace(last[0], `<w:t${last[1]}>${esc}</w:t>`);
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

  const filled = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) =>
    processPara(para, d, juryValues, jury)
  );

  zip.file("word/document.xml", filled);
  return zip.generateAsync({ type: "arraybuffer" });
}

function processPara(
  para: string,
  d: DocxFillData,
  juryValues: string[],
  jury: { idx: number }
): string {
  const text = getParaText(para);

  // Skip paragraphs with no meaningful content
  if (!text.trim()) return para;

  // ── Stage dates ─────────────────────────────────────────────────────────
  if (/date\s*(du\s*)?début|début\s*(du\s*)?stage|date\s*d[''']entrée/i.test(text))
    return replaceParagraphValue(para, frDate(d.dateDebut));

  if (/date\s*(de\s*(la\s*)?)?fin|fin\s*(du\s*)?stage|date\s*de\s*sortie/i.test(text))
    return replaceParagraphValue(para, frDate(d.dateFin));

  // ── Location ────────────────────────────────────────────────────────────
  if (/lieu\s*(du|de)\s*stage|lieu\s*:|adresse\s*:/i.test(text))
    return replaceParagraphValue(para, d.ville);

  // ── Company ─────────────────────────────────────────────────────────────
  if (/entreprise|société|organisme\s*d[''']accueil|structure\s*d[''']accueil/i.test(text))
    return replaceParagraphValue(para, d.entreprise);

  // ── Supervisors — pédagogique before generic encadrant ─────────────────
  if (/encadrant\s*(pédagogique|péda|académique)|tuteur\s*académique|superviseur\s*péda/i.test(text))
    return replaceParagraphValue(para, d.encPeda);

  if (/encadrant\s*(professionnel|pro\b)|maître\s*de\s*stage|tuteur\s*(professionnel|entreprise)/i.test(text))
    return replaceParagraphValue(para, d.encPro);

  // ── Student name ────────────────────────────────────────────────────────
  if (/réalisé\s*par|présenté\s*par|par\s*:|nom\s*(et\s*)?prénom|l[''']étudiant|étudiant\s*:|nom\s*de\s*l[''']|mme\/m\./i.test(text))
    return replaceParagraphValue(para, d.studentName);

  // ── Filière ─────────────────────────────────────────────────────────────
  if (/filière\s*:|spécialité\s*:|option\s*:|formation\s*:/i.test(text))
    return replaceParagraphValue(para, d.filiere);

  // ── Academic year ────────────────────────────────────────────────────────
  if (/année\s*(universitaire|académique)/i.test(text)) {
    // Try to replace an existing year like "2023-2024" first
    const withExistingYear = para.replace(
      /<w:t([^>]*)>([^<]*?\s)(\d{4}\s*[-–]\s*\d{4})(.*?)<\/w:t>/,
      `<w:t$1>$2${xmlEsc(d.annee)}$4</w:t>`
    );
    if (withExistingYear !== para) return withExistingYear;
    return replaceParagraphValue(para, d.annee);
  }

  // ── Theme / title ────────────────────────────────────────────────────────
  if (/thème\s*:|sujet\s*:|intitulé\s*:|titre\s*(du\s*)?(rapport|stage|mémoire|pfe)/i.test(text))
    return replaceParagraphValue(para, d.theme);

  // ── Jury members — "Pr. ........" lines ──────────────────────────────────
  // Must have dots (we don't replace already-filled jury names like "Pr. Mohammed FIKRI")
  if (
    /^(pr\.|dr\.|m\.|mme\.?)\s*/i.test(text.trim()) &&
    text.match(/\.{3,}/)
  ) {
    const val = juryValues[jury.idx] ?? "";
    jury.idx++;
    return val ? replaceParagraphValue(para, val) : para;
  }

  return para;
}
