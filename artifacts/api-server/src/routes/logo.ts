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

    for await (const message of query({
      prompt: `Find the official logo URL for this Moroccan school: "${school}".
Steps:
1. Use WebFetch to visit their official website. Try: https://${school.toLowerCase().replace(/\s+/g, "")}.ma then https://${school.toLowerCase().replace(/\s+/g, "")}.ac.ma
2. Scan the HTML for <img> tags whose src, alt or class contains "logo"
3. Pick the best logo URL (prefer SVG or PNG, must be absolute URL)
4. Reply with ONLY valid JSON: {"logoUrl":"https://..."} or {"logoUrl":null}
No explanation, no markdown, just the JSON object.`,
      options: {
        systemPrompt: "You are a logo finder agent. Use WebFetch to browse school websites and extract logo URLs. Always reply with JSON only.",
        maxTurns: 5,
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
