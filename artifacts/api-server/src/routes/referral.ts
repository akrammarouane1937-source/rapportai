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
  const { clerkId, refCode, email, name } = req.body as {
    clerkId?: string;
    refCode?:  string;
    email?:    string;
    name?:     string;
  };
  if (!clerkId) { res.status(400).json({ error: "clerkId required" }); return; }

  try {
    const user = await upsertUser(clerkId, { referredByCode: refCode, email, name });
    res.json({ referralCode: user.referralCode, balance: user.referralBalance, isFoundingUser: user.isFoundingUser });
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
      referralCode:       user.referralCode,
      referralLink:       `https://rapportai.com/signup?ref=${user.referralCode}`,
      balance:            user.referralBalance,
      balanceUsd:         (user.referralBalance / 100).toFixed(2),
      isFoundingUser:     user.isFoundingUser,
      totalReferrals:     referrals.length,
      pendingReferrals:   referrals.filter(r => r.status === "pending").length,
      completedReferrals: referrals.filter(r => r.status === "completed" || r.status === "rewarded").length,
    });
  } catch (err) {
    logger.error({ err }, "referral/me error");
    res.status(500).json({ error: "Failed to fetch referral data" });
  }
});

// ─── POST /api/referral/withdraw ──────────────────────────────────────────────
// User requests a payout (Option A — manual). We freeze the balance immediately
// so the user can't spend it twice, then queue the transfer for admin processing.
// Body: { clerkId, method: "paypal"|"stripe", payoutDetails: "email or account" }

router.post("/referral/withdraw", async (req: Request, res: Response) => {
  const { clerkId, method, payoutDetails } = req.body as {
    clerkId?:       string;
    method?:        "paypal" | "stripe";
    payoutDetails?: string;
  };

  if (!clerkId) { res.status(400).json({ error: "clerkId required" }); return; }
  if (!method || !["paypal", "stripe"].includes(method)) {
    res.status(400).json({ error: "method must be 'paypal' or 'stripe'" }); return;
  }
  if (!payoutDetails) {
    res.status(400).json({ error: "payoutDetails required (PayPal email or Stripe account)" }); return;
  }

  try {
    const user = await getUserByClerkId(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const MIN_WITHDRAWAL = 1000; // $10 in cents
    const available = user.referralBalance - (user.referralBalanceFrozen ?? 0);

    if (available < MIN_WITHDRAWAL) {
      res.status(400).json({
        error:     "insufficient_balance",
        message:   `Minimum withdrawal is $${MIN_WITHDRAWAL / 100}. Available balance: $${(available / 100).toFixed(2)}`,
        available,
      });
      return;
    }

    // Freeze available balance — keeps the book accurate until we manually transfer
    await db
      .update(usersTable)
      .set({ referralBalanceFrozen: (user.referralBalanceFrozen ?? 0) + available })
      .where(eq(usersTable.id, user.id));

    // Mark all pending rewards as "processing" and store payout metadata
    await db
      .update(referralRewardsTable)
      .set({
        status:        "processing" as "processing",
        method,
        payoutDetails,
      })
      .where(
        and(
          eq(referralRewardsTable.userId, user.id),
          eq(referralRewardsTable.status, "pending"),
        ),
      );

    // Admin notification — picked up by ops dashboard or email alert
    logger.info({
      event:          "withdrawal_requested",
      clerk_id:       clerkId,
      user_id:        user.id,
      amount_cents:   available,
      amount_usd:     (available / 100).toFixed(2),
      method,
      payout_details: payoutDetails,
      action_needed:  "MANUAL_TRANSFER_REQUIRED",
    });

    res.json({
      success: true,
      message: `Withdrawal of $${(available / 100).toFixed(2)} requested via ${method}. We'll process it within 48h.`,
      amount:  available,
    });
  } catch (err) {
    logger.error({ err }, "referral/withdraw error");
    res.status(500).json({ error: "Withdrawal request failed" });
  }
});

export default router;
