# Post-Launch Priority List

## 1. Per-user plan enforcement (PRIORITY #1)
**What:** Plan limits are currently stored in `localStorage` — per browser, not per account.
**Why it matters:** A user can clear localStorage or switch browsers to bypass the limit.
**Fix:** Once Clerk auth is active, replace `getMyPlan()` in `artifacts/rapportai/src/lib/userPlan.ts` with a read from Clerk user metadata. Replace the `x-plan-id` header read in `artifacts/api-server/src/lib/plan-guard.ts` with `clerkClient.users.getUser(userId)`.
**Effort:** ~2-3 hours once Clerk is wired.

---

## 2. Stripe payment integration
**What:** Plan upgrade buttons on PaywallModal redirect to `/pricing` but no actual payment flow exists.
**Fix:** Integrate Stripe Checkout. On success, write `planId` to Clerk user metadata → plan guard reads it automatically.

---

## 3. Backend plan enforcement
**What:** `guardSectionLimit` and `guardRevisionLimit` trust the `x-sections-generated` / `x-revision-count` headers sent by the frontend — easily spoofed.
**Fix:** Store section/revision counts server-side (DB or Clerk metadata) and check there instead.

---

## 4. Wire referral system into frontend
**What:** Backend referral API is fully built but not connected to the frontend yet.
**Three things to do:**

1. **On signup** — read `?ref=` from the URL and send it to `POST /api/referral/register` with the user's Clerk ID. Store the ref code in the URL before Clerk redirects so it's not lost.

2. **On export/download** — call `POST /api/session/:id/complete` with `x-clerk-id` header. This is what triggers the referral cashback. Safe by design: only paid users can export, so no free user can accidentally fire it.

3. **Referral dashboard page** — add a page (e.g. `/referral`) showing:
   - The user's unique referral link (`rapportai.com/signup?ref=CODE`)
   - Copy-to-clipboard button
   - Current balance + number of referrals (call `GET /api/referral/me`)
   - Withdraw button → `POST /api/referral/withdraw` (minimum $10, paid within 48h)

**DB migration:** Run `drizzle-kit push` once `DATABASE_URL` is set on Render to create the 3 referral tables.

---

## 5. Activate email system (Resend)
**What:** Welcome + report_ready emails are built and wired — just need the API key and domain.
**Three steps:**

1. **Add env var** — `RESEND_API_KEY=re_...` on Render (free account at resend.com, 3 000 emails/month free)
2. **Verify domain** — Add rapportai.ma in Resend dashboard → adds 2 DNS records → takes ~10 min
3. **Wire frontend signup** — On Clerk sign-in callback, call `POST /api/referral/register` with `{ clerkId, email, name, refCode? }`. The `email` and `name` come from `useUser()` (Clerk). This fires the welcome email automatically.

**Also update export:** When calling `POST /api/session/:id/complete`, pass `{ subject, word_count, sections_count }` in the body to populate the report_ready email content.

**Note:** Password reset is handled by Clerk — no action needed there.

---

## 6. Turn off FREE_LAUNCH
**What:** `FREE_LAUNCH=true` on Render bypasses all plan limits.
**When to flip:** After Stripe + Clerk metadata are wired and tested.
**Action:** Set `FREE_LAUNCH=false` on Render — no redeploy needed, takes effect immediately.
