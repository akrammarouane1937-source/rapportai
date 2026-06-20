import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { logger } from "./logger";
import humanizeSkillsMd from "./skills/humanize-skills.md";
import humanizeSystemMd from "./skills/humanize-system.md";
import { regexHumanizeFR } from "./regex-humanize-fr";

const client = new Anthropic();

// Structured sections that must NOT be humanized — rewriting them breaks their format or data.
// Everything else (all prose) is humanized. Exported so the agentic-loop path
// (session.ts → humanizeSection) skips the same sections this direct-API path does.
export const SKIP_HUMANIZE = new Set([
  "page-de-garde",    // student name, school, dates — must stay exact
  "sommaire",          // ##/### structure parsed by downstream agents + export TOC
  "bibliographie",     // citations (author, year, DOI) must stay exact
  "abbreviations",     // structured list
  "liste-figures",     // structured list
  "liste-tableaux",    // structured list
  "keywords",          // utility metadata
  "problematique",     // utility metadata
  "contexte",          // utility metadata
  // abstract is English — the humanizer skill is French (INTERDIT terms, French
  // phrasing rules) and would inject French words / corrupt it.
  "abstract",
]);

// Max words per chunk — Haiku handles 2000 words comfortably in one shot
const CHUNK_MAX_WORDS = 2000;

// ─── Load system + skills files once at startup ──────────────────────────────
// humanize-skills.md is the primary skill file with the 37 rules — it becomes
// the system prompt so Claude treats it as authoritative instructions.
// humanize-system.md contains domain-specific overrides (INTERDIT terms, etc.)
// and is appended after the skill file in the system prompt.

// Try multiple runtime paths (process.cwd() resolves differently on Render than
// locally), then fall back to the esbuild-bundled copies which are ALWAYS present.
// Without the bundled fallback this silently degraded to a weak one-line prompt on
// Render, leaving generated text un-humanized.
function loadHumanizeFile(filename: string, bundled: string): string {
  const candidates = [
    path.join(__dirname, "..", "src", "lib", "skills", filename), // dist/../src (Render esbuild layout)
    path.join(process.cwd(), "src/lib/skills", filename),         // local dev
    path.join(process.cwd(), "artifacts/api-server/src/lib/skills", filename), // from repo root
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return readFileSync(p, "utf-8");
    } catch { /* try next */ }
  }
  logger.warn({ filename }, "humanize-util: skill file not found at runtime — using bundled copy");
  return bundled;
}

const SKILLS_CONTENT = loadHumanizeFile("humanize-skills.md", humanizeSkillsMd);
const SYSTEM_OVERRIDES = loadHumanizeFile("humanize-system.md", humanizeSystemMd);
const PLAGIAT_CONTENT = loadHumanizeFile("plagiat-skills.md", "");

// Combine: humanize skills + domain overrides + anti-plagiat skill, so revisions also
// pass Turnitin/Compilatio (deep paraphrasing) on top of AI-detection humanization.
const SYSTEM_PROMPT = [SKILLS_CONTENT, SYSTEM_OVERRIDES, PLAGIAT_CONTENT].filter(Boolean).join("\n\n---\n\n")
  || "Tu es un expert en humanisation de texte académique marocain. Réécris le texte fourni pour qu'il soit indétectable par GPTZero et Turnitin. Retourne UNIQUEMENT le texte final, même structure Markdown, sans rien supprimer ni résumer.";

// Audit pass: same rules, framed as "already humanized once — fix what still looks
// like AI." Matches the iterative loop that scores ~25% vs ~50%+ for a single pass.
const AUDIT_PROMPT = `${SYSTEM_PROMPT}

---

MODE AUDIT : le texte ci-dessous a DÉJÀ été humanisé une fois. Il sera testé par ZeroGPT/Turnitin et doit scorer sous 20% IA. Traque ce qui le fait ENCORE détecter comme IA et corrige-le : phrases de longueur uniforme (insère des phrases courtes de 5-10 mots), tirets cadratins (—) restants, mots lisses restants (systématiquement, cruciale, notamment, néanmoins, "il convient de", "s'inscrit dans", "joue un rôle"), structures parallèles parfaites, transitions suréxpliquées, débuts de paragraphes répétitifs.
Conserve TOUT le contenu (≥95% des mots, structure Markdown, formules/citations/chiffres intacts). Retourne UNIQUEMENT le texte final, sans commentaire.`;

// Agent loop: up to 5 passes (1 humanize + up to 4 audits), re-checking all 37 rules
// each audit pass; stop early when a pass keeps ≥95% words identical (converged = all
// rules applied). Cap of 5 is the safety guardrail; revisions converge in 2-3 passes.
const MAX_PASSES = 5;
const CONVERGE_RATIO = 0.95;

function wordSimilarity(a: string, b: string): number {
  const wa = a.split(/\s+/).filter(Boolean);
  const wb = b.split(/\s+/).filter(Boolean);
  const max = Math.max(wa.length, wb.length);
  if (max === 0) return 1;
  const min = Math.min(wa.length, wb.length);
  let same = 0;
  for (let i = 0; i < min; i++) if (wa[i] === wb[i]) same++;
  return same / max;
}

// ─── Split markdown text into chunks on ## / ### headings ────────────────────

function splitIntoChunks(text: string): string[] {
  const parts = text.split(/(?=\n#{2,3} )/);
  const chunks: string[] = [];
  let buffer = "";

  for (const part of parts) {
    const partWords = part.split(/\s+/).filter(Boolean).length;
    const bufferWords = buffer.split(/\s+/).filter(Boolean).length;

    if (bufferWords + partWords > CHUNK_MAX_WORDS && buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = part;
    } else {
      buffer += part;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ─── Humanize a single chunk via Haiku direct API ────────────────────────────

// One humanize/audit API call. Returns trimmed text or null on failure.
async function humanizeCall(content: string, system: string, sectionType: string): Promise<string | null> {
  try {
    const response = await client.messages.create({
      // Sonnet, not Haiku: Haiku over-rewrites and mangles domain terms
      // (IA → "agent informatisé", mots-clés → "Vocables-clés"). Sonnet follows
      // the "preserve terminology" rules and keeps the text natural.
      // Sonnet by default — same as the generation humanizer. The model isn't the lever;
      // applying all the rules methodically is. Override with HUMANIZE_MODEL.
      model: process.env.HUMANIZE_MODEL || "claude-sonnet-4-5",
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: `SECTION : ${sectionType}
OBJECTIF : un texte qui se lit comme écrit par un bon étudiant marocain — naturel et académique d'ABORD, peu détectable ensuite. Ne JAMAIS sacrifier le sens ou la terminologie pour baisser un score.

Retourne UNIQUEMENT le texte humanisé complet, même structure Markdown, aucun commentaire :

${content}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return text.trim() || null;
  } catch {
    return null;
  }
}

// Multi-pass: humanize, then audit-fix up to 2 more times, stopping on convergence.
async function humanizeChunk(chunk: string, sectionType: string): Promise<string> {
  let working = chunk;
  let anySuccess = false;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const isAudit = pass > 0;
    const out = await humanizeCall(working, isAudit ? AUDIT_PROMPT : SYSTEM_PROMPT, sectionType);
    if (!out) break;

    const ratio = wordSimilarity(out, working);
    working = out;
    anySuccess = true;

    if (isAudit && ratio >= CONVERGE_RATIO) break; // converged — no more changes needed
  }

  return anySuccess ? working : chunk;
}

// ─── Post-processing — applied after LLM rewrite, guaranteed ─────────────────
// Deterministic regex pass that strips the mechanical AI tells (em-dashes, AI vocab,
// over-explained transitions, signposting, authority tropes) the direct-API LLM keeps
// leaving in. This is the bulk of the ZeroGPT win on this pipeline — it runs every
// time regardless of how thorough the LLM pass was. <1ms, no cost, no timeout risk.

function postProcess(text: string): string {
  return regexHumanizeFR(text);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runInternalHumanize(
  rawText: string,
  sectionType: string,
): Promise<string> {
  if (SKIP_HUMANIZE.has(sectionType)) {
    logger.info({ section: sectionType }, "humanize: skipped (structured section)");
    return rawText;
  }
  if (!rawText.trim()) {
    logger.info({ section: sectionType }, "humanize: skipped (empty content)");
    return rawText;
  }

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  logger.info({ section: sectionType, wordCount }, "humanize: starting");

  let result: string;
  if (wordCount <= CHUNK_MAX_WORDS) {
    result = postProcess(await humanizeChunk(rawText, sectionType));
  } else {
    const chunks = splitIntoChunks(rawText);
    logger.info({ section: sectionType, chunks: chunks.length }, "humanize: multi-chunk");
    const humanizedChunks = await Promise.all(
      chunks.map((chunk) => humanizeChunk(chunk, sectionType)),
    );
    result = postProcess(humanizedChunks.join("\n\n"));
  }

  const outWords = result.split(/\s+/).filter(Boolean).length;
  logger.info({ section: sectionType, inWords: wordCount, outWords }, "humanize: done");
  return result;
}

/**
 * Streaming variant — calls `onChunk` for each humanized chunk as soon as it's
 * ready, so the caller can forward partial results to the client without waiting
 * for the entire text to be processed.
 *
 * For non-prose sections (skipped), `onChunk` is still called once with the
 * raw text so the caller doesn't need a separate branch.
 *
 * Returns the full humanized text (all chunks joined with "\n\n").
 */
export async function streamingHumanize(
  rawText: string,
  sectionType: string,
  onChunk: (chunk: string, isFirst: boolean) => void,
): Promise<string> {
  if (SKIP_HUMANIZE.has(sectionType) || !rawText.trim()) {
    logger.info({ section: sectionType }, "humanize: skipped (structured or empty) — streaming as-is");
    onChunk(rawText, true);
    return rawText;
  }

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  logger.info({ section: sectionType, wordCount }, "humanize: streaming start");

  if (wordCount <= CHUNK_MAX_WORDS) {
    const result = postProcess(await humanizeChunk(rawText, sectionType));
    onChunk(result, true);
    logger.info({ section: sectionType, outWords: result.split(/\s+/).filter(Boolean).length }, "humanize: streaming done (single chunk)");
    return result;
  }

  const chunks = splitIntoChunks(rawText);
  logger.info({ section: sectionType, chunks: chunks.length }, "humanize: streaming multi-chunk");

  const results: string[] = [];
  for (const chunk of chunks) {
    const humanized = postProcess(await humanizeChunk(chunk, sectionType));
    results.push(humanized);
    onChunk(humanized, results.length === 1);
  }

  const result = results.join("\n\n");
  logger.info({ section: sectionType, inWords: wordCount, outWords: result.split(/\s+/).filter(Boolean).length }, "humanize: streaming done (multi-chunk)");
  return result;
}
