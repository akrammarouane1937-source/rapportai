---
name: Stripe pricing model
description: Stripe doesn't support MAD; charges in USD but displays MAD on frontend
---

**Rule:** Stripe charges in USD. MAD (Moroccan Dirham) is not in Stripe's supported currency list.

**Current prices:**
- Essentiel: $37 USD displayed as 377 MAD, anchor 1000 MAD. Price ID: `price_1TdDGG003Ts2AXbaNkwwT03b`
- Pro: $67 USD displayed as 677 MAD, anchor 1500 MAD. Price ID: `price_1TdDGO003Ts2AXbac5dyihpl`
- Products: Essentiel `prod_UcSAWCTOSm3zVx`, Pro `prod_UcSANDvRgWav5w`

**Why:** Stripe doesn't support MAD. Frontend shows MAD for local relevance; Stripe checkout shows USD.

**How to apply:** Never attempt to create Stripe prices in MAD. Always use USD. Update price IDs in `stripe.ts` PRICES object and in `userPlan.ts` PLAN_LIMITS stripePriceId.
