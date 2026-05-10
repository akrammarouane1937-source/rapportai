import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

router.get("/logo", async (req: Request, res: Response) => {
  const school = ((req.query.school as string) ?? "").trim();

  if (!school) {
    res.status(400).json({ error: "school query param required" });
    return;
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools: [
        {
          name: "fetch_url",
          description: "Fetch the content of a URL",
          input_schema: {
            type: "object" as const,
            properties: {
              url: { type: "string", description: "URL to fetch" },
            },
            required: ["url"],
          },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Find the direct URL of the official logo image for the Moroccan school: "${school}".

Steps:
1. Use fetch_url to visit the school's official website (e.g. ${school.toLowerCase()}.ma or ${school.toLowerCase()}.ac.ma)
2. Look for <img> tags with "logo" in src, alt, or class
3. Return ONLY a JSON object: {"logoUrl": "https://..."} or {"logoUrl": null} if not found.
Return only the JSON, nothing else.`,
        },
      ],
    });

    // Process tool calls if any
    let logoUrl: string | null = null;
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: `Find the direct URL of the official logo image for the Moroccan school: "${school}". Return ONLY JSON: {"logoUrl": "https://..."} or {"logoUrl": null}` },
      { role: "assistant", content: response.content },
    ];

    let current = response;
    let iterations = 0;

    while (current.stop_reason === "tool_use" && iterations < 3) {
      iterations++;
      const toolUses = current.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const tu of toolUses) {
        const { url } = tu.input as { url: string };
        let content = "";
        try {
          const r = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          });
          const html = await r.text();
          // Extract just img tags to keep it small
          const imgs = html.match(/<img[^>]+>/gi)?.slice(0, 30).join("\n") ?? "No images found";
          content = imgs.slice(0, 3000);
        } catch {
          content = "Failed to fetch URL";
        }
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content });
      }

      messages.push({ role: "user", content: toolResults });

      current = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        tools: [],
        messages,
      });

      messages.push({ role: "assistant", content: current.content });
    }

    // Extract JSON from final response
    const text = current.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text ?? "";
    const match = text.match(/\{[^}]*"logoUrl"[^}]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { logoUrl: string | null };
      logoUrl = parsed.logoUrl ?? null;
    }

    res.json({ logoUrl });
  } catch (err) {
    console.error("Logo fetch error:", err);
    res.json({ logoUrl: null });
  }
});

export default router;
