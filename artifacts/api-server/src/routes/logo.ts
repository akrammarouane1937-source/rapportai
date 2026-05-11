import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { resolveSchool } from "../lib/moroccan-schools";

const router = Router();

router.get("/logo", async (req: Request, res: Response) => {
  const school = ((req.query.school as string) ?? "").trim();
  if (!school) {
    res.status(400).json({ error: "school query param required" });
    return;
  }

  const claudeBinary = findClaudeBinary();
  const schoolInfo = resolveSchool(school);
  const fullName = schoolInfo.fullName;
  const abbr = school.toLowerCase().replace(/\s+/g, "");

  // Build URL candidates — use known website first if available
  const knownSite = schoolInfo.website ? [`https://${schoolInfo.website}`, `https://www.${schoolInfo.website}`] : [];
  const guessed = [
    `https://${abbr}.ac.ma`,
    `https://www.${abbr}.ac.ma`,
    `https://${abbr}.ma`,
    `https://${abbr}-casablanca.ac.ma`,
    `https://${abbr}-rabat.ac.ma`,
    `https://${abbr}-fes.ac.ma`,
  ];
  const urls = [...new Set([...knownSite, ...guessed])].join(", ");

  try {
    let fullText = "";

    for await (const message of query({
      prompt: `Find the official logo URL for this Moroccan school.
Abbreviation: "${school}"
Full name: "${fullName}"

Try these URLs in order using WebFetch until one responds: ${urls}

For each URL that responds:
- Look for <img> tags where src, alt, or class contains "logo", "brand", or the school name/abbreviation
- Also check <link rel="icon"> or <link rel="shortcut icon"> as fallback
- Prefer PNG or SVG over JPG, must be an absolute URL (starting with https://)
- If the URL is relative (starts with /), prepend the domain

Reply with ONLY this JSON (no explanation, no markdown):
{"logoUrl":"https://..."} or {"logoUrl":null}`,
      options: {
        systemPrompt: `You are a logo finder for Moroccan schools. Use WebFetch to browse school websites and extract logo URLs. Always reply with JSON only: {"logoUrl":"..."} or {"logoUrl":null}.`,
        maxTurns: 8,
        allowedTools: ["WebFetch"],
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") fullText += block.text;
        }
      }
    }

    const match = fullText.match(/\{[^}]*"logoUrl"[^}]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { logoUrl: string | null };
      res.json({ logoUrl: parsed.logoUrl ?? null });
    } else {
      res.json({ logoUrl: null });
    }
  } catch (err) {
    console.error("Logo agent error:", err);
    res.json({ logoUrl: null });
  }
});

export default router;
