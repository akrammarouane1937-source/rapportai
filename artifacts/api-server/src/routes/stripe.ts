import { Router, type Request, type Response, type NextFunction } from "express";
import express from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  getUserByClerkId, onReferredUserPaid,
  getPendingPayoutCentimes, getReferrerLatestPaidSession, markReferralRewardsPaid,
} from "../lib/referral";

const router = Router();

// ─── Plan catalogue ───────────────────────────────────────────────────────────
// Charged in MAD (dirhams) so students pay the exact advertised price with no
// bank-FX surprise. Stripe settles to the account's USD balance with a small
// currency-conversion fee. Amounts are in MAD centimes (147 MAD = 14700).

const PRICES: Record<string, {
  amountMad:    number;   // MAD centimes (the actual charge)
  priceMad:     number;   // display only (whole dirhams)
  anchorMad:    number;   // crossed-out anchor price
  label:        string;
  stripePriceId: string;
}> = {
  basique: {
    amountMad:    24900,
    priceMad:     249,
    anchorMad:    500,
    label:        "RapportAI Basique",
    stripePriceId: "price_1Tmu9a003Ts2AXbaW9fDdNGq",
  },
  starter: {
    amountMad:    37700,
    priceMad:     377,
    anchorMad:    1000,
    label:        "RapportAI Essentiel",
    stripePriceId: "price_1ThvTt003Ts2AXbae7IRuMOC",
  },
  pro: {
    amountMad:    67700,
    priceMad:     677,
    anchorMad:    1500,
    label:        "RapportAI Pro",
    stripePriceId: "price_1ThvTw003Ts2AXbaFgqC5P87",
  },
};

const PLAN_RANK: Record<string, number> = { free: 0, basique: 1, starter: 2, pro: 3 };

function planLabelFr(p: string): string {
  return p === "basique" ? "Basique" : p === "starter" ? "Essentiel" : p === "pro" ? "Pro" : "Gratuit";
}

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
  const target  = PRICES[plan];
  const clerkId = req.headers["x-clerk-id"] as string | undefined;

  try {
    const stripe  = getStripe();

    // ── Determine the plan already paid for THIS report (server-authoritative) ──
    // An upgrade charges only the price difference. We trust the report row, not
    // the client, so nobody can pay a small "difference" without the lower plan.
    let currentPlan = "free";
    try {
      const existing = await db.query.reportsTable.findFirst({
        where: eq(reportsTable.id, report_id),
      });
      if (existing?.paymentStatus === "paid" && existing.plan && PLAN_RANK[existing.plan] !== undefined) {
        currentPlan = existing.plan;
      }
    } catch {
      // DB hiccup → treat as a fresh purchase (charges full price, never under-charges)
    }

    // Reject buying a plan you already own (or a downgrade).
    if (PLAN_RANK[plan] <= PLAN_RANK[currentPlan]) {
      res.status(400).json({
        error:   "already_owned",
        message: `Tu as déjà le plan ${planLabelFr(currentPlan)}.`,
      });
      return;
    }

    // Fresh purchase → full fixed price. Upgrade from a paid plan → only the delta.
    let chargeAmountMad: number;
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    if (currentPlan === "free") {
      chargeAmountMad = target.amountMad;
      lineItem = { price: target.stripePriceId, quantity: 1 };
    } else {
      chargeAmountMad = target.amountMad - PRICES[currentPlan].amountMad;
      lineItem = {
        quantity: 1,
        price_data: {
          currency:     "mad",
          unit_amount:  chargeAmountMad,
          product_data: { name: `Mise à niveau ${planLabelFr(currentPlan)} → ${planLabelFr(plan)}` },
        },
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode:                 "payment",
      line_items:           [lineItem],
      metadata: {
        clerk_id: clerkId ?? "",
        report_id,
        plan,
      },
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/pricing?payment=cancelled`,
      ...(user_email ? { customer_email: user_email } : {}),
    });

    logger.info({
      event:      "checkout_created",
      report_id,
      plan,
      from:       currentPlan,
      charge_mad: chargeAmountMad,
      session_id: session.id,
    });
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
  const { clerk_id, report_id, plan } = session.metadata ?? {};

  if (!report_id) {
    logger.warn({ event: "webhook_missing_metadata", session_id: session.id });
    return;
  }

  try {
    // Link the report to the user so we can later find their card to refund.
    const buyer = clerk_id ? await getUserByClerkId(clerk_id) : null;

    await db
      .insert(reportsTable)
      .values({
        id:              report_id,
        userId:          buyer?.id ?? null,
        plan:            plan ?? null,
        paymentStatus:   "paid",
        stripeSessionId: session.id,
        paidAt:          new Date(),
      })
      .onConflictDoUpdate({
        target: reportsTable.id,
        set: { userId: buyer?.id ?? null, plan, paymentStatus: "paid", stripeSessionId: session.id, paidAt: new Date() },
      });

    if (clerk_id) {
      // Per-report plan lives on reportsTable (set above) — usersTable has no
      // plan column, so we don't write one here.

      // Convert the referral if this buyer was referred and paid Essentiel/Pro.
      // Returns the referrer's id when a new 100 MAD reward was earned.
      const referrerId = await onReferredUserPaid(clerk_id, plan);
      if (referrerId !== null) {
        await payReferrerRefund(getStripe(), referrerId);
      }
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

// ─── Referral cash payout (Stripe partial refund to the referrer's card) ─────
// The reward is paid by refunding the referrer's OWN payment — which means the
// referrer must themselves be on a paid Essentiel/Pro plan (we only refund
// against such a charge). Free/Basique referrers can't be cashed out until they
// upgrade; their reward stays pending. Failures are non-fatal and retried on the
// referrer's next earned reward.
async function payReferrerRefund(stripe: Stripe, referrerId: number): Promise<void> {
  try {
    const owed = await getPendingPayoutCentimes(referrerId);
    if (owed <= 0) return;

    const sessionId = await getReferrerLatestPaidSession(referrerId);
    if (!sessionId) {
      logger.warn(
        { event: "referral_payout_pending", referrerId, owed },
        "Referrer earned a reward but isn't on Essentiel/Pro yet — payout held",
      );
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const pi = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (!pi) {
      logger.warn({ event: "referral_payout_no_pi", referrerId, sessionId }, "No payment_intent to refund");
      return;
    }

    const refund = await stripe.refunds.create({ payment_intent: pi, amount: owed });
    await markReferralRewardsPaid(referrerId, refund.id);

    logger.info(
      { event: "referral_refunded", referrerId, amount_mad: owed / 100, refund_id: refund.id },
      `Refunded ${owed / 100} MAD to referrer's card`,
    );
  } catch (err) {
    logger.error(
      { event: "referral_refund_error", referrerId, error: String(err) },
      "Referral cash refund failed — reward stays pending, retried next time",
    );
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
