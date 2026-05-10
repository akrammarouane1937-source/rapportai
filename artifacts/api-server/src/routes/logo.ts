import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { AgentSession } from "../lib/agent-session";

const router = Router();

const FETCH_URL_TOOL: import("@anthropic-ai/sdk").Tool = {
  name: "fetch_url",
  description: "Fetch the HTML content of a URL",
  input_schema: {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL to fetch" },
    },
    required: ["url"],
  },
};

class LogoAgent extends AgentSession {
  constructor() {
    super(
      randomUUID(),
      `You are a logo finder. Given a Moroccan school name or abbreviation:
1. Use fetch_url to visit their official website (try <abbr>.ma then <abbr>.ac.ma)
2. Scan the HTML for <img> tags whose src, alt or class contains "logo"
3. Pick the best logo URL (prefer SVG or PNG, absolute URL)
4. Reply with ONLY valid JSON: {"logoUrl":"https://..."} or {"logoUrl":null}
No explanation, no markdown, just the JSON object.`,
      [FETCH_URL_TOOL]
    );
  }

  protected override async handleTool(name: string, input: unknown): Promise<string> {
    if (name === "fetch_url") {
      const { url } = input as { url: string };
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RapportAI/1.0)" },
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) return `HTTP ${r.status}`;
        const html = await r.text();
        // Return only img tags + head meta to keep token count low
        const imgs = (html.match(/<img[^>]{0,300}>/gi) ?? []).slice(0, 40).join("\n");
        const head = html.slice(0, 2000);
        return `HEAD:\n${head}\n\nIMGS:\n${imgs}`.slice(0, 4000);
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    return "Unknown tool";
  }
}

router.get("/logo", async (req: Request, res: Response) => {
  const school = ((req.query.school as string) ?? "").trim();
  if (!school) {
    res.status(400).json({ error: "school query param required" });
    return;
  }

  try {
    const agent = new LogoAgent();
    let text = "";

    for await (const event of agent.stream(`Find the official logo for this Moroccan school: "${school}"`)) {
      if (event.type === "text") text += event.content;
    }

    // Extract JSON from response
    const match = text.match(/\{[^}]*"logoUrl"[^}]*\}/);
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
