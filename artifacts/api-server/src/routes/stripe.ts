import { Router, type Request, type Response, type NextFunction } from "express";
import express from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, reportsTable, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getUserByClerkId, consumeReferralCredit, onReferredUserPaid } from "../lib/referral";

// Smallest charge Stripe accepts (USD). We always leave at least this much to
// pay so a fully-covering referral credit can't produce a zero-total checkout.
const MIN_CHARGE_CENTS = 50;

const router = Router();

// ─── Plan catalogue ───────────────────────────────────────────────────────────
// Prices charged in USD (Stripe doesn't support MAD).
// Display prices on the frontend are in MAD (377 / 677 MAD ≈ $37 / $67 USD).

const PRICES: Record<string, {
  amountUsd:    number;   // cents
  priceMad:     number;   // display only
  anchorMad:    number;   // crossed-out anchor price
  label:        string;
  stripePriceId: string;
}> = {
  basique: {
    amountUsd:    1500,
    priceMad:     147,
    anchorMad:    350,
    label:        "RapportAI Basique",
    stripePriceId: "price_1ThvLn003Ts2AXbay1naFpjd",
  },
  starter: {
    amountUsd:    3700,
    priceMad:     377,
    anchorMad:    1000,
    label:        "RapportAI Essentiel",
    stripePriceId: "price_1TdDGG003Ts2AXbaNkwwT03b",
  },
  pro: {
    amountUsd:    6700,
    priceMad:     677,
    anchorMad:    1500,
    label:        "RapportAI Pro",
    stripePriceId: "price_1TdDGO003Ts2AXbac5dyihpl",
  },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

// ─── POST /api/payments/checkout ─────────────────────────────────────────────

router.post("/payments/checkout", async (req: Request, res: Response) => {
  const { plan, report_id, user_email } = req.body as {
    plan: string;
    report_id: string;
    user_email?: string;
  };

  if (!plan || !PRICES[plan]) {
    res.status(400).json({ error: "Invalid plan. Use 'basique', 'starter' or 'pro'." });
    return;
  }
  if (!report_id) {
    res.status(400).json({ error: "report_id is required" });
    return;
  }

  const appUrl  = process.env.APP_URL ?? "http://localhost:3000";
  const price   = PRICES[plan];
  const clerkId = req.headers["x-clerk-id"] as string | undefined;

  try {
    const stripe  = getStripe();

    // ── Auto-apply referral credit (in-app credit model) ──────────────────────
    // Pull the buyer's accrued referral balance (USD cents) and apply up to it as
    // a one-off Stripe coupon, always leaving at least MIN_CHARGE_CENTS to pay.
    // The applied amount is recorded in metadata and deducted in the webhook once
    // payment actually succeeds.
    let creditAppliedCents = 0;
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

    if (clerkId) {
      const user      = await getUserByClerkId(clerkId);
      const available = user?.referralBalance ?? 0;
      const maxUsable = Math.max(0, price.amountUsd - MIN_CHARGE_CENTS);
      creditAppliedCents = Math.min(available, maxUsable);

      if (creditAppliedCents > 0) {
        const coupon = await stripe.coupons.create({
          amount_off:      creditAppliedCents,
          currency:        "usd",
          duration:        "once",
          max_redemptions: 1,
          name:            "Crédit parrainage RapportAI",
        });
        discounts.push({ coupon: coupon.id });
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode:                 "payment",
      line_items: [{
        price:    price.stripePriceId,
        quantity: 1,
      }],
      metadata: {
        clerk_id:             clerkId ?? "",
        report_id,
        plan,
        credit_applied_cents: String(creditAppliedCents),
      },
      ...(discounts.length ? { discounts } : {}),
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/pricing?payment=cancelled`,
      ...(user_email ? { customer_email: user_email } : {}),
    });

    logger.info({ event: "checkout_created", report_id, plan, session_id: session.id });
    res.json({ checkout_url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    logger.error({ event: "checkout_error", report_id, plan, error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/webhooks/stripe ────────────────────────────────────────────────

export function stripeWebhookHandler(req: Request, res: Response, _next: NextFunction): void {
  const sig    = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    res.status(400).json({ error: "Missing signature or webhook secret" });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    logger.error({ event: "webhook_invalid_signature", error: msg });
    res.status(400).send("Invalid signature");
    return;
  }

  void handleWebhookEvent(event);
  res.json({ received: true });
}

async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== "checkout.session.completed") return;

  const session                   = event.data.object as Stripe.Checkout.Session;
  const { clerk_id, report_id, plan, credit_applied_cents } = session.metadata ?? {};

  if (!report_id) {
    logger.warn({ event: "webhook_missing_metadata", session_id: session.id });
    return;
  }

  try {
    await db
      .insert(reportsTable)
      .values({
        id:              report_id,
        plan:            plan ?? null,
        paymentStatus:   "paid",
        stripeSessionId: session.id,
        paidAt:          new Date(),
      })
      .onConflictDoUpdate({
        target: reportsTable.id,
        set: { plan, paymentStatus: "paid", stripeSessionId: session.id, paidAt: new Date() },
      });

    if (clerk_id) {
      await db
        .update(usersTable)
        .set({ plan } as Partial<typeof usersTable.$inferSelect>)
        .where(eq(usersTable.clerkId, clerk_id));

      // Deduct any referral credit that was applied to this checkout.
      const applied = parseInt(credit_applied_cents ?? "0", 10);
      if (applied > 0) await consumeReferralCredit(clerk_id, applied);

      // Convert the referral if this buyer was referred and paid Essentiel/Pro.
      await onReferredUserPaid(clerk_id, plan);
    }

    logger.info({
      event:      "payment_completed",
      report_id,
      plan,
      clerk_id,
      amount:     session.amount_total,
      session_id: session.id,
    });
  } catch (err) {
    logger.error({ event: "webhook_db_error", session_id: session.id, error: String(err) });
  }
}

// ─── GET /api/payments/verify?session_id=xxx ─────────────────────────────────

router.get("/payments/verify", async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  if (!sessionId) { res.status(400).json({ error: "session_id required" }); return; }

  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid    = session.payment_status === "paid";
    const plan    = session.metadata?.plan ?? null;
    const email   = session.customer_details?.email ?? null;

    res.json({ paid, plan, email, report_id: session.metadata?.report_id ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    res.status(500).json({ error: msg });
  }
});

export default router;
