// ─── /api/orchestrator/:sessionId ────────────────────────────────────────────
// Agentic entry point (Phase 1). NEW endpoint — does not replace the existing flow.
// The frontend can opt into it; the old step-coordinator routes keep working until the
// orchestrator is proven on every section.

import { Router, type Request, type Response } from "express";
import { sessionStore } from "../lib/session-store";
import { SDKReportAgent } from "../lib/sdk-agent";
import { runOrchestrator } from "../lib/orchestrator/orchestrator";
import { logger } from "../lib/logger";

const router = Router();

router.post("/orchestrator/:sessionId", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { message, history, images } = req.body as { message?: string; history?: Array<{ role: "user" | "assistant"; content: unknown }>; images?: string[] };

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY missing" });
    return;
  }

  // Find the session — or create one on the fly. Render redeploys wipe in-memory sessions
  // AND /tmp files, so a session can vanish between requests. The orchestrator can start
  // from scratch, so we just make a fresh agent instead of 404-ing.
  let agent = (sessionStore.get(sessionId) as SDKReportAgent | undefined)
    ?? SDKReportAgent.reviveFromDisk(sessionId) ?? undefined;
  if (!agent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = ((req.body as Record<string, unknown>).profile ?? {}) as any;
    agent = new SDKReportAgent(sessionId, profile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionStore.set(agent as any);
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.socket?.setNoDelay(true);

  const emit = (ev: { type: string; [k: string]: unknown }) => {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch { /* closed */ }
  };
  // Heartbeat: write_section / humanize_section can run for minutes with no events.
  const hb = setInterval(() => { try { res.write(`: working\n\n`); } catch { /* closed */ } }, 15000);

  try {
    const result = await runOrchestrator({ sessionId, agent, userMessage: message, history, images, apiKey, emit });
    emit({ type: "reply", content: result.reply, ...(result.askUser ? { askUser: result.askUser } : {}) });
    emit({ type: "done" });
  } catch (err) {
    logger.error({ err, sessionId }, "orchestrator route failed");
    emit({ type: "error", message: "Une erreur est survenue." });
  } finally {
    clearInterval(hb);
    res.end();
  }
});

export default router;
