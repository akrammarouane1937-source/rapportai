import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { logger } from "./logger";

const client = new Anthropic();

// Every prose content section is humanized — no exceptions.
// "abstract" and "sommaire" are intentionally included.
// "page-de-garde" (HTML layout), "abbreviations" (JSON), "keywords", "problematique",
// "contexte" are excluded — they are structured/short data, not prose.
const HUMANIZE_SECTIONS = new Set([
  "introduction", "partie-i", "partie-ii", "conclusion",
  "resume", "abstract", "dedicaces", "remerciements",
  "bibliographie", "sommaire", "section",
]);

// Max words per chunk — Haiku handles 2000 words comfortably in one shot
const CHUNK_MAX_WORDS = 2000;

// ─── Load system prompt once at startup ──────────────────────────────────────

const systemPath = path.join(process.cwd(), "src/lib/skills/humanize-system.md");
const SYSTEM_PROMPT = existsSync(systemPath)
  ? readFileSync(systemPath, "utf-8")
  : "Tu es un expert en humanisation de texte académique marocain. Réécris le texte fourni pour qu'il soit indétectable par GPTZero et Turnitin. Retourne UNIQUEMENT le texte final, même structure Markdown, sans rien supprimer ni résumer.";

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

MISSION : Transforme ce texte académique marocain pour le rendre indétectable par GPTZero.

PRIORITÉS ANTI-DÉTECTION (dans l'ordre d'impact) :
1. BURSTINESS — Facteur #1 de détection. Alterne IMPÉRATIVEMENT phrases très courtes (5-8 mots) et longues (25-35 mots). Si 3 phrases consécutives ont la même longueur approximative, casse le rythme immédiatement.
2. VOCABULAIRE IA À ÉLIMINER SYSTÉMATIQUEMENT : "notamment", "davantage", "particulièrement", "systématiquement", "cruciale/crucial", "fondamentale/fondamental", "ainsi", "toutefois", "néanmoins", "en effet", "précisément", "incontestablement", "indéniablement", "effectivement", "clairement"
3. CONNECTEURS NATURELS FRANÇAIS À UTILISER : "par ailleurs", "à cet égard", "force est de constater que", "il convient de souligner", "on observe que", "dans cette perspective", "il ressort que", "à ce titre", "en l'occurrence", "sur ce point"
4. STRUCTURES À BRISER : listes à puces trop propres → prose coulante ; parallélismes parfaits (X et Y de même Z) → asymétrie naturelle ; toutes les phrases débutant par "La/Le/Les/L'" → varier les ouvertures
5. IMPERFECTIONS HUMAINES À INJECTER : une phrase qui commence directement par un verbe, une légère digression parenthétique, une reformulation non-symétrique, une transition abrupte entre deux idées

RÈGLE ABSOLUE : conserve 100% du contenu, chaque paragraphe, chaque argument — ne supprime, ne résume et ne condense rien. Le texte de sortie doit faire au minimum 95% des mots du texte d'entrée.

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
