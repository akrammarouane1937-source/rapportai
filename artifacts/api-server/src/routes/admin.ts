import { Router, type Request, type Response } from "express";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import path from "path";

const router = Router();
const SESSIONS_ROOT = process.env.SESSIONS_DIR ?? "/tmp/rapportai-sessions";

function requireAdmin(req: Request, res: Response): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true; // no token configured → open (dev mode)
  if (req.headers["x-admin-token"] !== token) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ─── GET /api/admin/reports ───────────────────────────────────────────────────
// Lists all sessions with metadata. Protected by ADMIN_TOKEN env var.

router.get("/admin/reports", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  if (!existsSync(SESSIONS_ROOT)) {
    res.json({ reports: [], total: 0 });
    return;
  }

  const sessions = readdirSync(SESSIONS_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const sessionId = d.name;
      const dir = path.join(SESSIONS_ROOT, sessionId);

      let profile: Record<string, unknown> | null = null;
      try {
        const profilePath = path.join(dir, "profile.json");
        if (existsSync(profilePath)) {
          profile = JSON.parse(readFileSync(profilePath, "utf-8")) as Record<string, unknown>;
        }
      } catch { /* corrupt session — skip */ }

      let memory: Record<string, unknown> | null = null;
      try {
        const memPath = path.join(dir, "student_memory.json");
        if (existsSync(memPath)) {
          memory = JSON.parse(readFileSync(memPath, "utf-8")) as Record<string, unknown>;
        }
      } catch { /* skip */ }

      const stat = statSync(dir);
      const sections = readdirSync(dir)
        .filter(f => f.endsWith(".md") && f !== "INSTRUCTIONS.md")
        .map(f => f.replace(".md", ""));

      return {
        sessionId,
        createdAt:  stat.birthtime,
        updatedAt:  stat.mtime,
        studentName: profile?.studentName ?? "Unknown",
        school:      profile?.school ?? "Unknown",
        theme:       profile?.theme ?? "Unknown",
        reportType:  profile?.reportType ?? "Unknown",
        sectionsGenerated: sections,
        sectionsCount: sections.length,
        planApproved: (memory?.report as Record<string, unknown>)?.plan_approved ?? false,
      };
    });

  // Sort newest first
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json({
    reports: sessions,
    total:   sessions.length,
  });
});

// ─── GET /api/admin/reports/:sessionId ───────────────────────────────────────
// Returns full profile + memory for one session.

router.get("/admin/reports/:sessionId", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { sessionId } = req.params;
  const dir = path.join(SESSIONS_ROOT, sessionId);
  if (!existsSync(dir)) { res.status(404).json({ error: "Session not found" }); return; }

  let profile = null;
  let memory  = null;
  try { profile = JSON.parse(readFileSync(path.join(dir, "profile.json"), "utf-8")); } catch { /* skip */ }
  try { memory  = JSON.parse(readFileSync(path.join(dir, "student_memory.json"), "utf-8")); } catch { /* skip */ }

  const sections: Record<string, number> = {};
  readdirSync(dir).filter(f => f.endsWith(".md") && f !== "INSTRUCTIONS.md").forEach(f => {
    const content = readFileSync(path.join(dir, f), "utf-8");
    sections[f.replace(".md", "")] = content.split(/\s+/).filter(Boolean).length;
  });

  res.json({ sessionId, profile, memory, sections });
});

export default router;
