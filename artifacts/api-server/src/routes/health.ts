import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { execSync } from "child_process";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Diagnostic endpoint — call /api/diag from browser to see exactly what's missing
router.get("/api/diag", (_req, res) => {
  const binary = findClaudeBinary();

  let claudeVersion: string | null = null;
  if (binary) {
    try {
      claudeVersion = execSync(`"${binary}" --version 2>&1`, { encoding: "utf8", timeout: 5000 }).trim();
    } catch (e) {
      claudeVersion = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  res.json({
    status: "ok",
    claude_binary: binary ?? "NOT FOUND",
    claude_version: claudeVersion,
    anthropic_api_key: process.env.ANTHROPIC_API_KEY ? "✅ SET" : "❌ MISSING",
    node_version: process.version,
    platform: process.platform,
    cwd: process.cwd(),
    sessions_dir: process.env.SESSIONS_DIR ?? "/tmp/rapportai-sessions (default)",
  });
});

export default router;
