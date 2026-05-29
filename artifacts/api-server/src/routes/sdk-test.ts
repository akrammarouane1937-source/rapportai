import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();

// GET /api/debug-sdk — finds claude binary in pnpm store
router.get("/debug-sdk", (_req: Request, res: Response) => {
  try {
    const run = (cmd: string) => { try { return execSync(cmd, { encoding: "utf8" }).trim(); } catch { return ""; } };

    const pnpmAnthropicPkgs = run("ls /opt/render/project/src/node_modules/.pnpm/ | grep anthropic");
    const dotBinClaude = run("ls /opt/render/project/src/node_modules/.bin/ | grep claude");
    const findClaudeBin = run("find /opt/render/project/src/node_modules -name 'claude' -type f 2>/dev/null | head -10");
    const findClaudeCode = run("find /opt/render/project/src/node_modules -path '*claude-code*' -name '*.mjs' 2>/dev/null | head -10");

    res.json({ pnpmAnthropicPkgs, dotBinClaude, findClaudeBin, findClaudeCode });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/sdk-test
// Runs a minimal Agent SDK query — verifies the SDK works on this server.
router.get("/sdk-test", async (_req: Request, res: Response) => {
  try {
    const claudeBinary = findClaudeBinary();
    let result = "";

    for await (const message of query({
      prompt: "Say exactly: RapportAI SDK is working.",
      options: {
        maxTurns: 1,
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

    res.json({ ok: true, response: result, binaryUsed: claudeBinary ?? "PATH" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
