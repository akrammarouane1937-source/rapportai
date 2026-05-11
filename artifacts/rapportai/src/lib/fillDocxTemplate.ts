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

function getParaText(para: string): string {
  return (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map(h => h.replace(/<[^>]+>/g, ""))
    .join("");
}

function frDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Replaces a placeholder in a paragraph with `value`.
 * Tries 5 strategies in order — handles the common Word template patterns:
 *   1. Run containing ONLY dots / underscores / tabs
 *   2. Label + trailing dots in the SAME run (e.g. "Lieu de stage : .........")
 *   3. Date dot-pattern like ".../.../ 2025" inside a run
 *   4. Trailing underscores in the same run
 *   5. Last-resort: replace the last short/empty run in the paragraph
 */
function replacePlaceholder(para: string, value: string): string {
  if (!value) return para;
  const esc = xmlEsc(value);

  // 1 — standalone placeholder run (only dots, tabs, underscores, or date-dots)
  let r = para.replace(
    /<w:t([^>]*)>(\.{4,}|_{4,}|\t+|(?:\.+\s*\/\s*){1,3}\.{0,}|\.\s*\.\s*\.\s*\/.*?\/.*?)<\/w:t>/,
    `<w:t$1>${esc}</w:t>`
  );
  if (r !== para) return r;

  // 2 — label + trailing dots in same run: "Lieu de stage : ............"
  r = para.replace(
    /<w:t([^>]*)>([^<]*?)(\.{4,})\s*<\/w:t>/,
    `<w:t$1>$2${esc}</w:t>`
  );
  if (r !== para) return r;

  // 3 — date pattern inside a run: ".../..../ 2025" or "xx/xx/xxxx"
  r = para.replace(
    /<w:t([^>]*)>([^<]*?)((?:\.*\s*\/\s*){1,3}(?:\d{0,4}|\.*))\s*<\/w:t>/,
    `<w:t$1>$2${esc}</w:t>`
  );
  if (r !== para) return r;

  // 4 — trailing underscores in same run: "Nom : ___________"
  r = para.replace(
    /<w:t([^>]*)>([^<]*?)(_{4,})\s*<\/w:t>/,
    `<w:t$1>$2${esc}</w:t>`
  );
  if (r !== para) return r;

  // 5 — last-resort: replace content of the last run if it looks like a placeholder
  //     (short text, or only dots/spaces/tabs/slashes)
  const allRuns = [...para.matchAll(/<w:t([^>]*)>([^<]*)<\/w:t>/g)];
  if (allRuns.length >= 2) {
    const last = allRuns[allRuns.length - 1];
    if (/^[\s._/\\]+$/.test(last[2]) || last[2].length <= 15) {
      return para.replace(last[0], `<w:t${last[1]}>${esc}</w:t>`);
    }
  }

  return para;
}

// ─── Main export ─────────────────────────────────────────────────────────────

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

  // Process every <w:p> element in the document (body + text boxes + headers)
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
  const lc = text.toLowerCase();

  // Skip empty / no-placeholder paragraphs
  const hasPlaceholder =
    text.match(/\.{3,}/) ||
    text.match(/\.+\s*\/\s*\.+/) ||
    text.match(/_{4,}/) ||
    (text.includes("\t") && text.length < 200);

  if (!hasPlaceholder) return para;

  // ── Stage dates ─────────────────────────────────────────────────────────────
  if (/date\s*(du\s*)?début|début\s*(du\s*)?stage|date\s*d.entrée|du\s*:/i.test(text))
    return replacePlaceholder(para, frDate(d.dateDebut));

  if (/date\s*(de\s*(la\s*)?)?fin|fin\s*(du\s*)?stage|date\s*de\s*sortie|au\s*:/i.test(text))
    return replacePlaceholder(para, frDate(d.dateFin));

  // ── Location ─────────────────────────────────────────────────────────────────
  if (/lieu\s*(du|de)\s*stage|lieu\s*:|adresse|siège/i.test(text))
    return replacePlaceholder(para, d.ville);

  // ── Company ──────────────────────────────────────────────────────────────────
  if (/entreprise|société|organisme\s*d.accueil|structure\s*d.accueil/i.test(text))
    return replacePlaceholder(para, d.entreprise);

  // ── Supervisors — peda before general "encadrant" ────────────────────────────
  if (/encadrant\s*(pédagogique|péda|académique|de\s*l.école)|tuteur\s*(académique|pédagogique)|superviseur\s*péda/i.test(text))
    return replacePlaceholder(para, d.encPeda);

  if (/encadrant\s*(professionnel|pro\b)|maître\s*de\s*stage|tuteur\s*(professionnel|entreprise)/i.test(text))
    return replacePlaceholder(para, d.encPro);

  // ── Student name ─────────────────────────────────────────────────────────────
  if (/réalisé\s*par|présenté\s*par|par\s*:|nom\s*(et\s*)?prénom|l.étudiant|étudiant\s*:|nom\s*de\s*l./i.test(text))
    return replacePlaceholder(para, d.studentName);

  // ── Filière ──────────────────────────────────────────────────────────────────
  if (/filière\s*:|spécialité\s*:|option\s*:|formation\s*:/i.test(text))
    return replacePlaceholder(para, d.filiere);

  // ── Academic year ─────────────────────────────────────────────────────────────
  if (/année\s*(universitaire|académique)/i.test(text)) {
    // Also replace an existing year pattern like "2023-2024"
    const withYear = para.replace(
      /<w:t([^>]*)>([^<]*?)(\d{4}\s*[-–]\s*\d{4})<\/w:t>/,
      `<w:t$1>$2${xmlEsc(d.annee)}</w:t>`
    );
    if (withYear !== para) return withYear;
    return replacePlaceholder(para, d.annee);
  }

  // ── Theme / title ─────────────────────────────────────────────────────────────
  if (/thème\s*:|sujet\s*:|intitulé\s*:|titre\s*(du\s*)?(rapport|stage|mémoire|pfe)/i.test(text))
    return replacePlaceholder(para, d.theme);

  // ── Jury members — lines starting with "Pr." / "Dr." / "M." followed by dots ─
  if (/^(pr\.|dr\.|m\.|mme\.?)\s*\.{3,}/i.test(text.trim())) {
    const val = juryValues[jury.idx] ?? "";
    jury.idx++;
    return val ? replacePlaceholder(para, val) : para;
  }

  // ── Theme fallback — long standalone dot block (≥12 dots, no label text) ──────
  if (text.trim().match(/^\.{12,}$/) && d.theme)
    return replacePlaceholder(para, d.theme);

  return para;
}
