import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "./find-claude-binary";

// Only humanize real content sections — skip utility/helper sections
const HUMANIZE_SECTIONS = new Set([
  "introduction", "partie-i", "partie-ii", "conclusion",
  "resume", "dedicaces", "remerciements", "bibliographie",
]);

// Skip humanize for very large texts to avoid timeout (page-by-page will handle those)
const MAX_WORDS_FOR_INLINE_HUMANIZE = 1200;

export async function runInternalHumanize(
  rawText: string,
  sectionType: string,
): Promise<string> {
  if (!HUMANIZE_SECTIONS.has(sectionType)) return rawText;
  if (!rawText.trim()) return rawText;

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_WORDS_FOR_INLINE_HUMANIZE) return rawText;

  const systemPath = path.join(process.cwd(), "src/lib/skills/humanize-system.md");
  const systemPrompt = existsSync(systemPath)
    ? readFileSync(systemPath, "utf-8")
    : `Tu es un expert en humanisation de texte académique marocain. Réécris le texte fourni en deux passes pour qu'il soit indétectable par GPTZero et Turnitin. Retourne UNIQUEMENT le texte final, même structure Markdown.`;

  const claudeBinary = findClaudeBinary();
  let result = "";

  try {
    for await (const message of query({
      prompt: `Applique les 26 techniques de transformation sur ce texte académique (section: ${sectionType}). Deux passes obligatoires — retourne UNIQUEMENT le texte final :\n\n${rawText}`,
      options: {
        systemPrompt,
        maxTurns: 2,
        allowedTools: [],
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") result += block.text;
        }
      }
    }
  } catch {
    // Humanize failed — return original text, never break the pipeline
    return rawText;
  }

  return result.trim() || rawText;
}
