import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";

const client = new Anthropic();

// Every content section is humanized — no exceptions
const HUMANIZE_SECTIONS = new Set([
  "introduction", "partie-i", "partie-ii", "conclusion",
  "resume", "dedicaces", "remerciements", "bibliographie",
  "section",
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
          content: `Humanise ce texte académique (section: ${sectionType}) pour éliminer les marqueurs d'écriture IA. RÈGLE ABSOLUE : conserve 100% du contenu, chaque paragraphe, chaque argument — ne supprime, ne résume et ne condense rien. Le texte de sortie doit faire au minimum 95% des mots du texte d'entrée. Retourne UNIQUEMENT le texte humanisé complet, même structure Markdown, aucun commentaire :\n\n${chunk}`,
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
  if (!HUMANIZE_SECTIONS.has(sectionType)) return rawText;
  if (!rawText.trim()) return rawText;

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  if (wordCount <= CHUNK_MAX_WORDS) {
    return humanizeChunk(rawText, sectionType);
  }

  const chunks = splitIntoChunks(rawText);
  const humanizedChunks = await Promise.all(
    chunks.map((chunk) => humanizeChunk(chunk, sectionType)),
  );

  return humanizedChunks.join("\n\n");
}
