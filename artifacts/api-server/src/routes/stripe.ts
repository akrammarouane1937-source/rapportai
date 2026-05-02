import { Router, type Request, type Response } from "express";
import Stripe from "stripe";

const router = Router();

const PLAN_PRICES: Record<string, number> = {
  essentiel: 14900,
  pro:       44900,
  premium:   74900,
};

const PLAN_NAMES: Record<string, string> = {
  essentiel: "RapportAI Essentiel",
  pro:       "RapportAI Pro",
  premium:   "RapportAI Premium",
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-04-30" });
}

/** POST /api/stripe/create-checkout
 * Body: { planId, successUrl, cancelUrl }
 * Returns: { url }
 */
router.post("/stripe/create-checkout", async (req: Request, res: Response) => {
  const { planId, successUrl, cancelUrl } = req.body as {
    planId: string;
    successUrl: string;
    cancelUrl: string;
  };

  if (!planId || !PLAN_PRICES[planId]) {
    res.status(400).json({ error: "Invalid planId" });
    return;
  }
  if (!successUrl || !cancelUrl) {
    res.status(400).json({ error: "successUrl and cancelUrl are required" });
    return;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "mad",
            unit_amount: PLAN_PRICES[planId],
            product_data: {
              name: PLAN_NAMES[planId],
              description: `Accès complet au plan ${planId} — paiement unique`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { planId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    res.status(500).json({ error: message });
  }
});

/** GET /api/stripe/verify?session_id=xxx
 * Returns: { paid, planId, email }
 */
router.get("/stripe/verify", async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;

  if (!sessionId) {
    res.status(400).json({ error: "session_id is required" });
    return;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid   = session.payment_status === "paid";
    const planId = session.metadata?.planId ?? null;
    const email  = session.customer_details?.email ?? null;

    res.json({ paid, planId, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    res.status(500).json({ error: message });
  }
});

export default router;
