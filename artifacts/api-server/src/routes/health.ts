import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { metrics } from "../lib/metrics";
import { execSync } from "child_process";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Diagnostic endpoint — call /api/diag from browser to see exactly what's missing
router.get("/diag", (_req, res) => {
  const binary = findClaudeBinary();

  let claudeVersion: string | null = null;
  if (binary) {
    try {
      claudeVersion = execSync(`"${binary}" --version 2>&1`, { encoding: "utf8", timeout: 5000 }).trim();
    } catch (e) {
      claudeVersion = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    rss_mb: Math.round(mem.rss / 1024 / 1024),
    heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    memory_guard_limit_mb: 380,
    claude_binary: binary ?? "NOT FOUND",
    claude_version: claudeVersion,
    anthropic_api_key: process.env.ANTHROPIC_API_KEY ? "✅ SET" : "❌ MISSING",
    free_launch: process.env.FREE_LAUNCH === "true" ? "✅ ACTIVE (no paywall)" : "❌ INACTIVE (paywall on)",
    clerk_secret: process.env.CLERK_SECRET_KEY ? "✅ SET" : "❌ MISSING",
    node_version: process.version,
    platform: process.platform,
    cwd: process.cwd(),
    sessions_dir: process.env.SESSIONS_DIR ?? "/tmp/rapportai-sessions (default)",
  });
});

// GET /api/metrics — live stats dashboard (protect with internal token in prod)
router.get("/api/metrics", (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (token && req.headers["x-metrics-token"] !== token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(metrics.getStats());
});

export default router;
