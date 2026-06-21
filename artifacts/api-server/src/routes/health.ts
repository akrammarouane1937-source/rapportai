import { Router, type IRouter } from "express";
import { existsSync, statSync } from "fs";
import path from "path";
import { HealthCheckResponse } from "@workspace/api-zod";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { metrics } from "../lib/metrics";
import { getUsage } from "../lib/abuse-guard";
import { execSync } from "child_process";

const router: IRouter = Router();

// Bump this every meaningful deploy. Hit /api/diag in a browser to confirm the
// running build is the latest one (no need to generate anything).
const BUILD_MARKER = "orchestrator-validated-passed 2026-06-20";

// Resolve a skills file the same way the humanizer does, so /diag reveals whether
// the humanizer will actually find its rules at runtime (the cause of un-humanized output).
function probeSkillFile(filename: string): { found: boolean; path: string | null; bytes: number } {
  const candidates = [
    path.join(process.cwd(), "src/lib/skills", filename),
    path.join(process.cwd(), "artifacts/api-server/src/lib/skills", filename),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return { found: true, path: p, bytes: statSync(p).size };
    } catch { /* try next */ }
  }
  return { found: false, path: null, bytes: 0 };
}

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
    build_marker: BUILD_MARKER,
    humanize_skills_md: probeSkillFile("humanize-skills.md"),
    humanize_system_md: probeSkillFile("humanize-system.md"),
    rss_mb: Math.round(mem.rss / 1024 / 1024),
    heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    memory_guard_limit_mb: parseInt(process.env.MEMORY_GUARD_MB ?? "1600", 10) || 1600,
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

// GET /api/usage?sessionId=… — today's revision count for the in-app counter.
// Router is mounted at /api, so the path here must be "/usage" (not "/api/usage").
router.get("/usage", (req, res) => {
  const key = (req.query.sessionId as string)
    || (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "unknown";
  res.json(getUsage(key));
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
