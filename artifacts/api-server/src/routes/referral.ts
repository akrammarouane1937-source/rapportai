import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, referralsTable, referralRewardsTable } from "@workspace/db";
import { upsertUser, getUserByClerkId } from "../lib/referral";
import { logger } from "../lib/logger";

const router = Router();

// ─── POST /api/referral/register ──────────────────────────────────────────────
// Called on first sign-in. Body: { clerkId, refCode? }
// Creates a user row + pending referral if a refCode was supplied.

router.post("/referral/register", async (req: Request, res: Response) => {
  const { clerkId, refCode } = req.body as { clerkId?: string; refCode?: string };
  if (!clerkId) { res.status(400).json({ error: "clerkId required" }); return; }

  try {
    const user = await upsertUser(clerkId, refCode);
    res.json({ referralCode: user.referralCode, balance: user.referralBalance });
  } catch (err) {
    logger.error({ err }, "referral/register error");
    res.status(500).json({ error: "Failed to register user" });
  }
});

// ─── GET /api/referral/me?clerkId=xxx ─────────────────────────────────────────
// Returns the user's referral code, balance, and stats.

router.get("/referral/me", async (req: Request, res: Response) => {
  const clerkId = req.query.clerkId as string;
  if (!clerkId) { res.status(400).json({ error: "clerkId required" }); return; }

  try {
    const user = await getUserByClerkId(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const referrals = await db.query.referralsTable.findMany({
      where: eq(referralsTable.referrerId, user.id),
    });

    res.json({
      referralCode:  user.referralCode,
      referralLink:  `https://rapportai.com/signup?ref=${user.referralCode}`,
      balance:       user.referralBalance,         // cents
      balanceUsd:    (user.referralBalance / 100).toFixed(2),
      totalReferrals:    referrals.length,
      pendingReferrals:  referrals.filter(r => r.status === "pending").length,
      completedReferrals: referrals.filter(r => r.status === "completed" || r.status === "rewarded").length,
    });
  } catch (err) {
    logger.error({ err }, "referral/me error");
    res.status(500).json({ error: "Failed to fetch referral data" });
  }
});

// ─── POST /api/referral/withdraw ──────────────────────────────────────────────
// User requests a payout. We do NOT pay automatically — logs the request.
// In production: trigger a Stripe payout or PayPal transfer here.

router.post("/referral/withdraw", async (req: Request, res: Response) => {
  const { clerkId, method, paypalEmail } = req.body as {
    clerkId?: string;
    method?: "stripe" | "paypal";
    paypalEmail?: string;
  };

  if (!clerkId) { res.status(400).json({ error: "clerkId required" }); return; }

  try {
    const user = await getUserByClerkId(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const MIN_WITHDRAWAL = 1000; // $10 minimum
    if (user.referralBalance < MIN_WITHDRAWAL) {
      res.status(400).json({
        error:   "insufficient_balance",
        message: `Minimum withdrawal is $${MIN_WITHDRAWAL / 100}. Your balance: $${(user.referralBalance / 100).toFixed(2)}`,
      });
      return;
    }

    // Mark all pending rewards as "paid" (optimistic — real transfer queued manually)
    await db
      .update(referralRewardsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(
        and(
          eq(referralRewardsTable.userId, user.id),
          eq(referralRewardsTable.status, "pending"),
        ),
      );

    // Zero out balance
    await db
      .update(usersTable)
      .set({ referralBalance: 0 })
      .where(eq(usersTable.id, user.id));

    logger.info(
      { event: "withdrawal_requested", clerkId, amount: user.referralBalance, method, paypalEmail },
      `Withdrawal request: $${(user.referralBalance / 100).toFixed(2)}`,
    );

    res.json({
      success: true,
      message: `Withdrawal of $${(user.referralBalance / 100).toFixed(2)} requested. We'll process it within 48h.`,
      amount:  user.referralBalance,
    });
  } catch (err) {
    logger.error({ err }, "referral/withdraw error");
    res.status(500).json({ error: "Withdrawal request failed" });
  }
});

export default router;
