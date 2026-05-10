import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();

router.get("/logo", async (req: Request, res: Response) => {
  const school = ((req.query.school as string) ?? "").trim();
  if (!school) {
    res.status(400).json({ error: "school query param required" });
    return;
  }

  const claudeBinary = findClaudeBinary();

  try {
    let fullText = "";

    const abbr = school.toLowerCase().replace(/\s+/g, "");
    const urls = [
      `https://${abbr}.ac.ma`,
      `https://www.${abbr}.ac.ma`,
      `https://${abbr}.ma`,
      `https://www.${abbr}.ma`,
      `https://${abbr}-casablanca.ac.ma`,
      `https://${abbr}-rabat.ac.ma`,
    ].join(", ");

    for await (const message of query({
      prompt: `Find the official logo URL for this Moroccan school: "${school}".

Try these URLs in order using WebFetch until one works: ${urls}

For each URL that responds:
- Look in the HTML for <img> tags where src, alt, or class contains "logo", "brand", or the school abbreviation
- Also check <link rel="icon"> for favicon as fallback
- Prefer PNG or SVG, must be an absolute URL (starting with https://)

Reply with ONLY this JSON (no explanation, no markdown):
{"logoUrl":"https://..."} or {"logoUrl":null}`,
      options: {
        systemPrompt: "You are a logo finder. Use WebFetch to browse Moroccan school websites and find their logo image URL. Always reply with JSON only: {\"logoUrl\":\"...\"} or {\"logoUrl\":null}.",
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
