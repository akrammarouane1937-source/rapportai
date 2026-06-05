import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { logger } from "./logger";

const client = new Anthropic();

// Every content section is humanized — no exceptions.
// "abbreviations" (JSON array) and "keywords", "problematique", "contexte"
// (short utility outputs) are excluded — they are structured/non-prose data.
const HUMANIZE_SECTIONS = new Set([
  "introduction", "partie-i", "partie-ii", "conclusion",
  "resume", "abstract", "dedicaces", "remerciements",
  "bibliographie", "sommaire", "page-de-garde", "section",
]);

// Max words per chunk — Haiku handles 2000 words comfortably in one shot
const CHUNK_MAX_WORDS = 2000;

// ─── Load system + skills files once at startup ──────────────────────────────

const systemPath = path.join(process.cwd(), "src/lib/skills/humanize-system.md");
const SYSTEM_PROMPT = existsSync(systemPath)
  ? readFileSync(systemPath, "utf-8")
  : "Tu es un expert en humanisation de texte académique marocain. Réécris le texte fourni pour qu'il soit indétectable par GPTZero et Turnitin. Retourne UNIQUEMENT le texte final, même structure Markdown, sans rien supprimer ni résumer.";

const skillsPath = path.join(process.cwd(), "src/lib/skills/humanize-skills.md");
const SKILLS_PROMPT = existsSync(skillsPath)
  ? readFileSync(skillsPath, "utf-8")
  : "";

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

async function humanizeChunk(chunk: string, sectionType: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `SECTION : ${sectionType} | CIBLE : score GPTZero < 20%
${SKILLS_PROMPT ? `\n${SKILLS_PROMPT}\n` : ""}
Retourne UNIQUEMENT le texte humanisé complet, même structure Markdown, aucun commentaire :

${chunk}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return text.trim() || chunk;
  } catch {
    return chunk;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runInternalHumanize(
  rawText: string,
  sectionType: string,
): Promise<string> {
  if (!HUMANIZE_SECTIONS.has(sectionType)) {
    logger.info({ section: sectionType }, "humanize: skipped (not a prose section)");
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
    result = await humanizeChunk(rawText, sectionType);
  } else {
    const chunks = splitIntoChunks(rawText);
    logger.info({ section: sectionType, chunks: chunks.length }, "humanize: multi-chunk");
    const humanizedChunks = await Promise.all(
      chunks.map((chunk) => humanizeChunk(chunk, sectionType)),
    );
    result = humanizedChunks.join("\n\n");
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
  if (!HUMANIZE_SECTIONS.has(sectionType) || !rawText.trim()) {
    logger.info({ section: sectionType }, "humanize: skipped (non-prose or empty) — streaming as-is");
    onChunk(rawText, true);
    return rawText;
  }

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  logger.info({ section: sectionType, wordCount }, "humanize: streaming start");

  if (wordCount <= CHUNK_MAX_WORDS) {
    const result = await humanizeChunk(rawText, sectionType);
    onChunk(result, true);
    logger.info({ section: sectionType, outWords: result.split(/\s+/).filter(Boolean).length }, "humanize: streaming done (single chunk)");
    return result;
  }

  const chunks = splitIntoChunks(rawText);
  logger.info({ section: sectionType, chunks: chunks.length }, "humanize: streaming multi-chunk");

  const results: string[] = [];
  for (const chunk of chunks) {
    const humanized = await humanizeChunk(chunk, sectionType);
    results.push(humanized);
    onChunk(humanized, results.length === 1);
  }

  const result = results.join("\n\n");
  logger.info({ section: sectionType, inWords: wordCount, outWords: result.split(/\s+/).filter(Boolean).length }, "humanize: streaming done (multi-chunk)");
  return result;
}
