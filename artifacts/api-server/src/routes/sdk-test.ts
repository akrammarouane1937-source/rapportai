import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";

const router = Router();

// GET /api/sdk-test
// Runs a minimal Agent SDK query — verifies the SDK works on this server.
router.get("/sdk-test", async (_req: Request, res: Response) => {
  try {
    let result = "";

    for await (const message of query({
      prompt: "Say exactly: RapportAI SDK is working.",
      options: {
        maxTurns: 1,
        allowedTools: [],
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") result += block.text;
        }
      }
    }

    res.json({ ok: true, response: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
