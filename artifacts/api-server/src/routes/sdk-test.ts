import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readdirSync, existsSync } from "fs";
import { execSync } from "child_process";

const router = Router();

// GET /api/debug-sdk — finds actual node_modules location + claude binary
router.get("/debug-sdk", (_req: Request, res: Response) => {
  try {
    let cwd = "";
    try { cwd = execSync("pwd").toString().trim(); } catch { cwd = "error"; }

    let nodeModulesFind = "";
    try {
      nodeModulesFind = execSync(
        `find / -name "claude-agent-sdk" -maxdepth 10 -type d 2>/dev/null | head -5`
      ).toString().trim();
    } catch { nodeModulesFind = "error"; }

    let whichClaude = "";
    try { whichClaude = execSync("which claude 2>/dev/null || echo not-found").toString().trim(); } catch { whichClaude = "not-found"; }

    let envPath = process.env.PATH ?? "";
    let resolvedSdk = "";
    try { resolvedSdk = require.resolve("@anthropic-ai/claude-agent-sdk"); } catch (e) { resolvedSdk = String(e); }

    res.json({ cwd, nodeModulesFind, whichClaude, envPath, resolvedSdk });
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
