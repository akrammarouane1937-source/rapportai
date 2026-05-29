import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db, userReportDataTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/me/report", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [row] = await db.select().from(userReportDataTable).where(eq(userReportDataTable.clerkUserId, userId));
    res.json({ reportData: row?.reportData ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /me/report failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me/report", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { reportData } = req.body as { reportData?: unknown };
  if (!reportData || typeof reportData !== "string") {
    res.status(400).json({ error: "reportData (string) required" });
    return;
  }
  if (reportData.length > 2_000_000) {
    res.status(413).json({ error: "Payload too large" });
    return;
  }

  try {
    await db.insert(userReportDataTable)
      .values({ clerkUserId: userId, reportData, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userReportDataTable.clerkUserId,
        set: { reportData, updatedAt: sql`NOW()` },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /me/report failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
