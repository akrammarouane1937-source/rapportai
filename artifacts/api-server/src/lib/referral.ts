import { eq, and, or, count, sql } from "drizzle-orm";
import { db, usersTable, referralsTable, referralRewardsTable } from "@workspace/db";
import { logger } from "./logger";
import { sendEmail } from "./email";

// ─── Code generation ──────────────────────────────────────────────────────────

const ADJECTIVES = ["SMART", "FAST", "BOLD", "COOL", "STAR", "ACE", "TOP"];

export function generateReferralCode(clerkId: string): string {
  // Take last 4 chars of clerkId as a stable suffix
  const suffix = clerkId.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  return `${adj}-${suffix}`;
}

// ─── Upsert user row ──────────────────────────────────────────────────────────
// Called on every authenticated request if needed — idempotent.

const FOUNDING_LIMIT = 20;

export async function upsertUser(
  clerkId: string,
  opts?: { referredByCode?: string; email?: string; name?: string },
) {
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkId),
  });
  if (existing) return existing;

  const referralCode = generateReferralCode(clerkId);
  const { referredByCode, email, name } = opts ?? {};

  // First 20 users get founding status — free forever
  const [{ value: totalUsers }] = await db.select({ value: count() }).from(usersTable);
  const isFoundingUser = Number(totalUsers) < FOUNDING_LIMIT;

  // Find referrer if a code was supplied
  let referrerId: number | null = null;
  if (referredByCode) {
    const referrer = await db.query.usersTable.findFirst({
      where: eq(usersTable.referralCode, referredByCode),
    });
    if (referrer) referrerId = referrer.id;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      clerkId,
      email:          email ?? null,
      name:           name  ?? null,
      referralCode,
      referredByCode: referredByCode ?? null,
      isFoundingUser,
    })
    .returning();

  // Create a pending referral row if this user was referred
  if (referrerId && created) {
    await db.insert(referralsTable).values({
      referrerId,
      referredId: created.id,
      status: "pending",
    });
  }

  logger.info(
    { event: "user_created", clerkId, referralCode, referredByCode, isFoundingUser },
    isFoundingUser ? "New FOUNDING user" : "New user",
  );

  // Fire welcome email — non-blocking, never throws
  if (email) {
    void sendEmail(email, "welcome", {
      name:             name || email.split("@")[0],
      is_founding_user: isFoundingUser,
    });
  }

  return created;
}

// ─── Get user by Clerk ID ─────────────────────────────────────────────────────

export async function getUserByClerkId(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

// ─── Report-ready email (no referral logic) ───────────────────────────────────
// Referral conversion is now driven by the Stripe webhook (onReferredUserPaid),
// NOT by report completion — a referral only counts when the friend actually
// PAYS for Essentiel or Pro. This function is kept solely for the email.

export async function onReportCompleted(
  clerkId: string,
  reportMeta?: { reportId?: string; subject?: string; wordCount?: number; sectionsCount?: number },
) {
  const user = await getUserByClerkId(clerkId);
  if (!user?.email) return;

  void sendEmail(user.email, "report_ready", {
    name:           user.name || user.email.split("@")[0],
    report_subject: reportMeta?.subject ?? "Rapport académique",
    report_id:      reportMeta?.reportId ?? "",
    word_count:     reportMeta?.wordCount ?? 0,
    sections_count: reportMeta?.sectionsCount ?? 0,
  });
}

// ─── Referral reward economics ─────────────────────────────────────────────────
// 100 MAD of in-app credit per 2 converted referrals. A referral "converts" when
// the referred friend pays for Essentiel or Pro (handled in the Stripe webhook).
//
// The reward is delivered as account credit (stored in `referralBalance`, in MAD
// centimes) that is auto-applied as a discount at the referrer's next checkout.
// Morocco isn't a supported Stripe Connect payout destination, so we credit
// instead of cashing out.
//
// Balance is stored in MAD centimes (the charge currency): 10000 = 100 MAD.
// Display divides by 100. Keep this in sync with stripe.ts.

const CASHBACK_THRESHOLD = 2;     // converted referrals per reward
const CASHBACK_AMOUNT    = 10000; // 100 MAD, stored as centimes (display = / 100)

const QUALIFYING_PLANS = new Set(["starter", "pro"]);

/**
 * Called from the Stripe webhook when a user pays. If that user was referred and
 * the plan is Essentiel/Pro, mark the referral converted and top up the referrer's
 * credit so they always hold floor(conversions / 2) × 100 MAD. Idempotent: it
 * never grants more rewards than the conversion count deserves, fixing the old
 * over-pay bug where referral #1 paired with every later referral.
 */
export async function onReferredUserPaid(clerkId: string, plan: string | null | undefined) {
  if (!plan || !QUALIFYING_PLANS.has(plan)) return;

  const user = await getUserByClerkId(clerkId);
  if (!user) return;

  const referral = await db.query.referralsTable.findFirst({
    where: and(
      eq(referralsTable.referredId, user.id),
      eq(referralsTable.status, "pending"),
    ),
  });
  if (!referral) return; // organic user, or already converted

  await db
    .update(referralsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(referralsTable.id, referral.id));

  await grantDueRewards(referral.referrerId);
}

/** Grant any referral credit the referrer has earned but not yet received. */
async function grantDueRewards(referrerId: number): Promise<void> {
  // Converted referrals (completed or rewarded — both count toward pairs)
  const [{ value: convertedCount }] = await db
    .select({ value: count() })
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.referrerId, referrerId),
        or(
          eq(referralsTable.status, "completed"),
          eq(referralsTable.status, "rewarded"),
        ),
      ),
    );

  // Rewards already granted to this referrer
  const [{ value: grantedCount }] = await db
    .select({ value: count() })
    .from(referralRewardsTable)
    .where(
      and(
        eq(referralRewardsTable.userId, referrerId),
        eq(referralRewardsTable.reason, "referral_cashback"),
      ),
    );

  const deserved = Math.floor(Number(convertedCount) / CASHBACK_THRESHOLD);
  const missing  = deserved - Number(grantedCount);
  if (missing <= 0) return;

  await db
    .update(usersTable)
    .set({ referralBalance: sql`${usersTable.referralBalance} + ${CASHBACK_AMOUNT * missing}` })
    .where(eq(usersTable.id, referrerId));

  for (let i = 0; i < missing; i++) {
    await db.insert(referralRewardsTable).values({
      userId: referrerId,
      amount: CASHBACK_AMOUNT,
      reason: "referral_cashback",
      status: "paid",            // credit delivered to balance immediately
      paidAt: new Date(),
    });
  }

  logger.info(
    { event: "referral_rewarded", referrerId, rewards: missing, amountCentimes: CASHBACK_AMOUNT * missing },
    `Granted ${missing} × 100 MAD referral credit`,
  );
}

/**
 * Deduct in-app credit that was applied at checkout. Called from the Stripe
 * webhook after a successful payment, using the amount recorded in session
 * metadata. Clamped at 0 so concurrent charges can never drive it negative.
 */
export async function consumeReferralCredit(clerkId: string, cents: number): Promise<void> {
  if (!Number.isFinite(cents) || cents <= 0) return;

  const user = await getUserByClerkId(clerkId);
  if (!user) return;

  const newBalance = Math.max(0, user.referralBalance - cents);
  await db
    .update(usersTable)
    .set({ referralBalance: newBalance })
    .where(eq(usersTable.id, user.id));

  logger.info(
    { event: "referral_credit_consumed", clerkId, cents, newBalance },
    "Referral credit applied at checkout",
  );
}
