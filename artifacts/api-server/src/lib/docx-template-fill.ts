import JSZip from "jszip";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

// ─── DOCX template fill ───────────────────────────────────────────────────────
// A .docx is a ZIP whose word/document.xml holds every visible text fragment in
// <w:t> nodes. We DON'T regenerate the page de garde: we surgically replace the
// placeholder fragments (dotted lines, "INTITULÉ DU PFE", "Mme/M. …") with the
// student's data and re-zip. The output is byte-for-byte the school's template —
// fonts, colors, logo, layout untouched — with the student's info filled in.

const client = new Anthropic();

const FILLED_NAME = "page-de-garde-remplie.docx";
export const FILLED_DOCX_NAME = FILLED_NAME;

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Most recent .docx uploaded to the session workDir = the student's template. */
export function findLatestDocxTemplate(workDir: string): string | null {
  try {
    const docx = readdirSync(workDir)
      .filter((f) => f.toLowerCase().endsWith(".docx") && f !== FILLED_NAME);
    if (docx.length === 0) return null;
    docx.sort(
      (a, b) => statSync(path.join(workDir, b)).mtimeMs - statSync(path.join(workDir, a)).mtimeMs
    );
    return path.join(workDir, docx[0]);
  } catch {
    return null;
  }
}

const NODE_RE = /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g;

/**
 * Fill the uploaded template with the student's profile.
 * Returns null when there is no template or nothing could be mapped.
 */
export async function fillDocxTemplate(
  workDir: string,
  profile: Record<string, unknown>,
  conversationContext: string,
): Promise<{ filledPath: string; replaced: number } | null> {
  const templatePath = findLatestDocxTemplate(workDir);
  if (!templatePath) return null;

  const zip = await JSZip.loadAsync(readFileSync(templatePath));
  const docFile = zip.file("word/document.xml");
  if (!docFile) return null;
  let xml = await docFile.async("string");

  // 1. Collect every visible text fragment, in document order
  const texts: string[] = [];
  xml.replace(NODE_RE, (m, _open, inner: string) => {
    texts.push(xmlUnescape(inner));
    return m;
  });
  if (texts.length === 0) return null;

  const numbered = texts.map((t, i) => `[${i}] ${JSON.stringify(t)}`).join("\n");

  // 2. Claude maps placeholder fragments → student data (index-based: unambiguous)
  const system = `Tu remplis le modèle Word OFFICIEL d'une page de garde universitaire marocaine.
On te donne la liste NUMÉROTÉE de tous les fragments de texte du document, dans l'ordre exact, et le profil de l'étudiant.

À REMPLACER : les placeholders uniquement — pointillés (…………), "Mme/M. ………", "INTITULÉ DU PFE" (→ le thème), années génériques si le profil en donne une autre, champs vides après un libellé.
À NE PAS TOUCHER : les textes fixes du modèle (nom de l'école, libellés "Encadrant pédagogique :", noms déjà remplis par l'école, titres officiels).
RÈGLES :
- Quand un fragment contient libellé + pointillés (ex: "Réalisé par : Mme/M. ………"), garde le libellé et remplace seulement la partie placeholder (ex: "Réalisé par : M. Akram Marouane").
- Si une info manque dans le profil (ex: membres du jury, date de soutenance), laisse le fragment INCHANGÉ — ne l'invente jamais.
- "INTITULÉ DU PFE" ou équivalent → remplace par le thème exact du profil.
Réponds UNIQUEMENT avec ce JSON, rien d'autre :
{"replacements":[{"index":12,"new_text":"texte complet du fragment après remplacement"}]}`;

  const user = `PROFIL ÉTUDIANT :
${JSON.stringify(profile, null, 2)}
${conversationContext ? `\nINFOS DONNÉES EN CONVERSATION (prioritaires) :\n${conversationContext.slice(0, 2000)}` : ""}

FRAGMENTS DU DOCUMENT :
${numbered}`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const raw = resp.content.find((b) => b.type === "text")?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let replacements: Array<{ index: number; new_text: string }> = [];
  try {
    replacements =
      (JSON.parse(jsonMatch[0]) as { replacements?: typeof replacements }).replacements ?? [];
  } catch {
    return null;
  }
  const byIndex = new Map(
    replacements
      .filter((r) => Number.isInteger(r.index) && typeof r.new_text === "string")
      .map((r) => [r.index, r.new_text])
  );
  if (byIndex.size === 0) return null;

  // 3. Surgical replace — only the targeted <w:t> nodes change, design untouched
  let i = -1;
  xml = xml.replace(NODE_RE, (m, open: string, _inner: string, close: string) => {
    i++;
    if (!byIndex.has(i)) return m;
    const openPreserve = open.includes("xml:space")
      ? open
      : open.replace(/>$/, ' xml:space="preserve">');
    return `${openPreserve}${xmlEscape(byIndex.get(i)!)}${close}`;
  });

  zip.file("word/document.xml", xml);
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const filledPath = path.join(workDir, FILLED_NAME);
  writeFileSync(filledPath, out);
  logger.info(
    { template: path.basename(templatePath), replaced: byIndex.size },
    "docx template filled"
  );
  return { filledPath, replaced: byIndex.size };
}
