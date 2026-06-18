import { Router, type Request, type Response } from "express";
import { sendFeedbackEmail, sendErrorAlert } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/client-error — the frontend reports errors users actually see
// (e.g. "Une erreur est survenue", connection drops) so the admin gets emailed.
router.post("/client-error", async (req: Request, res: Response): Promise<void> => {
  const { message, page, userAgent, sessionId } = req.body as {
    message?: string; page?: string; userAgent?: string; sessionId?: string;
  };
  const text = (message ?? "").toString().slice(0, 1000).trim();
  if (text) {
    void sendErrorAlert({
      context: "client",
      message: text,
      url: typeof page === "string" ? page.slice(0, 200) : undefined,
      userAgent: typeof userAgent === "string" ? userAgent : undefined,
      sessionId: typeof sessionId === "string" ? sessionId.slice(0, 80) : undefined,
    });
  }
  res.json({ ok: true });
});

// POST /api/feedback — student "aide-nous à améliorer RapportAI" submissions.
// Emailed to the admin inbox (ADMIN_EMAIL). No auth required so anyone can send.
router.post("/feedback", async (req: Request, res: Response): Promise<void> => {
  const { message, email, name, page, kind, rating, school } = req.body as {
    message?: string; email?: string; name?: string; page?: string;
    kind?: "feedback" | "review"; rating?: number; school?: string;
  };

  const text = (message ?? "").trim();
  if (!text) { res.status(400).json({ error: "message requis" }); return; }
  if (text.length > 5000) { res.status(413).json({ error: "message trop long" }); return; }

  try {
    await sendFeedbackEmail({
      message: text,
      email: typeof email === "string" ? email.slice(0, 200) : undefined,
      name: typeof name === "string" ? name.slice(0, 120) : undefined,
      page: typeof page === "string" ? page.slice(0, 200) : undefined,
      kind: kind === "review" ? "review" : "feedback",
      rating: typeof rating === "number" ? rating : undefined,
      school: typeof school === "string" ? school.slice(0, 120) : undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /feedback failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
