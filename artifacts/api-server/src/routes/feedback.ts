import { Router, type Request, type Response } from "express";
import { sendFeedbackEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/feedback — student "aide-nous à améliorer RapportAI" submissions.
// Emailed to the admin inbox (ADMIN_EMAIL). No auth required so anyone can send.
router.post("/feedback", async (req: Request, res: Response): Promise<void> => {
  const { message, email, name, page } = req.body as {
    message?: string; email?: string; name?: string; page?: string;
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
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /feedback failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
