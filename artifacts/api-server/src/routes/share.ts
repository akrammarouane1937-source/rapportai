import { Router, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";

const router = Router();

interface ShareEntry {
  data: unknown;
  createdAt: number;
}

const shares = new Map<string, ShareEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Prune entries older than TTL */
function prune() {
  const now = Date.now();
  for (const [id, entry] of shares) {
    if (now - entry.createdAt > TTL_MS) shares.delete(id);
  }
}

/** POST /api/share — store report data, return share ID */
router.post("/share", (req: Request, res: Response) => {
  prune();
  if (Object.keys(req.body as object).length === 0) {
    res.status(400).json({ error: "Empty report data" });
    return;
  }
  const id = randomBytes(6).toString("hex"); // 12-char e.g. "a3f8b2c9d1e4"
  shares.set(id, { data: req.body, createdAt: Date.now() });
  res.json({ id });
});

/** GET /api/share/:id — retrieve stored report data */
router.get("/share/:id", (req: Request, res: Response) => {
  const entry = shares.get(req.params.id);
  if (!entry || Date.now() - entry.createdAt > TTL_MS) {
    res.status(404).json({ error: "Lien expiré ou introuvable." });
    return;
  }
  res.json(entry.data);
});

export default router;
