import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readdirSync, existsSync } from "fs";
import { execSync } from "child_process";

const router = Router();

// GET /api/debug-sdk — lists installed @anthropic-ai packages + finds claude binary
router.get("/debug-sdk", (_req: Request, res: Response) => {
  try {
    const base = "/opt/render/project/src/node_modules/@anthropic-ai";
    const packages = existsSync(base) ? readdirSync(base) : ["(dir not found)"];

    let whichClaude = "";
    try { whichClaude = execSync("which claude || echo not-found").toString().trim(); } catch { whichClaude = "error"; }

    let findBin = "";
    try {
      findBin = execSync(
        `find /opt/render/project/src/node_modules/@anthropic-ai -name "claude*" -type f 2>/dev/null | head -20`
      ).toString().trim();
    } catch { findBin = "error"; }

    res.json({ packages, whichClaude, findBin });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

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
