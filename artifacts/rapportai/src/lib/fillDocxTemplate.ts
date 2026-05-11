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
  const hits = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
  return hits.map(h => h.replace(/<[^>]+>/g, "")).join("");
}

// Replaces the first <w:t> containing a dot-placeholder (4+ dots or date dots like .../.../)
function replaceDotRun(para: string, value: string): string {
  return para.replace(
    /<w:t([^>]*)>(\.{4,}|(?:\.+\s*\/\s*){1,}\.{0,})<\/w:t>/,
    `<w:t$1>${xmlEsc(value)}</w:t>`
  );
}

function frDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Fills placeholder dots in a .docx template with real student data.
 * Works on the raw word/document.xml — finds each paragraph, detects its
 * label context (French keywords), and replaces the first dot-sequence run.
 */
export async function fillDocxTemplate(
  buf: ArrayBuffer,
  d: DocxFillData
): Promise<ArrayBuffer> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);

  const docFile = zip.file("word/document.xml");
  if (!docFile) return buf;

  const xml = await docFile.async("text");

  let juryIdx = 0;
  const juryValues = [d.jury1, d.jury2, d.jury3].filter(Boolean);

  const filled = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
    const text = getParaText(para);
    const lc = text.toLowerCase();

    // Skip paragraphs with no placeholder dots
    const hasDots = text.match(/\.{4,}/) || text.match(/\.+\s*\/\s*\.+/);
    if (!hasDots) return para;

    // Stage location
    if (/lieu\s*(du|de)\s*stage/.test(lc) || (/lieu/.test(lc) && /stage/.test(lc)))
      return replaceDotRun(para, d.ville);

    // Stage dates
    if (/date\s*(du\s*)?début|début\s*(du\s*)?stage/.test(lc))
      return replaceDotRun(para, frDate(d.dateDebut));

    if (/date\s*(de\s*(la\s*)?)?fin|fin\s*(du\s*)?stage/.test(lc))
      return replaceDotRun(para, frDate(d.dateFin));

    // Pedagogical supervisor (check before generic "encadrant")
    if (/encadrant\s*(pédagogique|péda|académique|de\s*l.école)/i.test(text))
      return replaceDotRun(para, d.encPeda);

    // Professional supervisor
    if (/encadrant\s*(professionnel|pro\b)/i.test(text))
      return replaceDotRun(para, d.encPro);

    // Company
    if (/entreprise|société|organisme\s*d.accueil|structure\s*d.accueil/.test(lc))
      return replaceDotRun(para, d.entreprise);

    // Student name
    if (/réalisé\s*par|nom\s*(et\s*)?prénom|l.étudiant|par\s*:/i.test(text))
      return replaceDotRun(para, d.studentName);

    // Filière
    if (/filière|spécialité|option\s*:/.test(lc))
      return replaceDotRun(para, d.filiere);

    // Academic year
    if (/année\s*universitaire/.test(lc)) {
      const replaced = para.replace(
        /<w:t([^>]*)>(\.{4,}|\d{4}[-–]\d{4})<\/w:t>/,
        `<w:t$1>${xmlEsc(d.annee)}</w:t>`
      );
      return replaced !== para ? replaced : replaceDotRun(para, d.annee);
    }

    // Theme / Sujet — labeled lines
    if (/thème|sujet|intitulé|titre\s*(du\s*rapport|de\s*l)/.test(lc))
      return replaceDotRun(para, d.theme);

    // Jury members — lines starting with "Pr." / "Dr." / "M." / "Mme." then dots
    if (/^(pr\.|dr\.|m\.|mme\.?)\s*\.{4,}/i.test(text.trim())) {
      const val = juryValues[juryIdx] ?? "";
      juryIdx++;
      return val ? replaceDotRun(para, val) : para;
    }

    // Theme fallback — long standalone dot block (10+ dots, no other text)
    if (text.trim().match(/^\.{10,}$/) && d.theme)
      return replaceDotRun(para, d.theme);

    return para;
  });

  zip.file("word/document.xml", filled);
  return zip.generateAsync({ type: "arraybuffer" });
}
