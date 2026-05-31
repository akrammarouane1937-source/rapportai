---
name: FREE_LAUNCH env var required
description: FREE_LAUNCH=true must be set as a Replit shared env var; missing it causes guardPayment to block all SDK generation requests
---

## Rule

`FREE_LAUNCH=true` must be set as a **shared** environment variable in the Replit project (not just in code comments). Without it, the `guardPayment` middleware in `plan-guard.ts` returns HTTP 402 `payment_required` for every `/api/session/:id/generate` request.

**Why:** The middleware checks `process.env.FREE_LAUNCH === "true"` at runtime. The value is in code docs and replit.md but was never actually set in the Replit secrets panel, so every generation call silently failed with `{"error":"payment_required","checkout_required":true}` — which the frontend shows as the generic "La génération n'a pas abouti" message.

**How to apply:** Set via `setEnvVars({ values: { FREE_LAUNCH: "true" }, environment: "shared" })` in the code_execution sandbox, then restart the API server workflow.
