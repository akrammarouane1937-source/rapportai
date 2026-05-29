import { Router, type Request, type Response, type NextFunction } from "express";
import express from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, reportsTable, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

const PRICES: Record<string, { amount: number; label: string }> = {
  starter: { amount: 3700, label: "RapportAI Starter — 1 rapport" },
  pro:     { amount: 6700, label: "RapportAI Pro — 1 rapport"     },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

// ─── POST /api/payments/checkout ─────────────────────────────────────────────
// Creates a Stripe Checkout session. Body: { plan, report_id, user_email? }

router.post("/payments/checkout", async (req: Request, res: Response) => {
  const { plan, report_id, user_email } = req.body as {
    plan: string;
    report_id: string;
    user_email?: string;
  };

  if (!plan || !PRICES[plan]) {
    res.status(400).json({ error: "Invalid plan. Use 'starter' or 'pro'." });
    return;
  }
  if (!report_id) {
    res.status(400).json({ error: "report_id is required" });
    return;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  try {
    const stripe  = getStripe();
    const price   = PRICES[plan];
    const clerkId = req.headers["x-clerk-id"] as string | undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode:                 "payment",
      line_items: [{
        price_data: {
          currency:     "usd",
          product_data: { name: price.label },
          unit_amount:  price.amount,
        },
        quantity: 1,
      }],
      metadata:      { clerk_id: clerkId ?? "", report_id, plan },
      success_url:   `${appUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:    `${appUrl}/pricing?payment=cancelled`,
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
// IMPORTANT: registered BEFORE express.json() in app.ts — raw body required.
// Verifies Stripe signature, then unlocks the report for generation.

export function stripeWebhookHandler(req: Request, res: Response, _next: NextFunction): void {
  const sig = req.headers["stripe-signature"];
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

  // Handle asynchronously — respond immediately to avoid Stripe timeout
  void handleWebhookEvent(event);
  res.json({ received: true });
}

async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== "checkout.session.completed") return;

  const session  = event.data.object as Stripe.Checkout.Session;
  const { clerk_id, report_id, plan } = session.metadata ?? {};

  if (!report_id) {
    logger.warn({ event: "webhook_missing_metadata", session_id: session.id });
    return;
  }

  try {
    // Mark report as paid
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

    // Update user's plan if we have their Clerk ID
    if (clerk_id) {
      await db
        .update(usersTable)
        .set({ plan } as Partial<typeof usersTable.$inferSelect>)
        .where(eq(usersTable.clerkId, clerk_id));
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
// Frontend calls this on success_url landing to confirm payment.

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
