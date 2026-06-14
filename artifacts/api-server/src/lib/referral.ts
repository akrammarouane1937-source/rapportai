import { eq, and, or, count, sql, desc } from "drizzle-orm";
import { db, usersTable, referralsTable, referralRewardsTable, reportsTable } from "@workspace/db";
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
// 100 MAD per 2 converted referrals, paid as a CASH refund to the referrer's own
// card (Stripe partial refund against their original payment). The product is a
// one-time purchase, so account credit would be worthless — cash back is the real
// incentive. A referral "converts" when the referred friend pays Essentiel/Pro.
//
// referralBalance = lifetime MAD earned (centimes, 10000 = 100 MAD), for display.
// Each 100 MAD reward is a referralRewardsTable row: "pending" until the cash
// refund lands, then "paid". The Stripe refund itself happens in stripe.ts (it
// needs the Stripe client); these helpers are the DB side.

export const CASHBACK_AMOUNT = 10000; // 100 MAD in centimes
const CASHBACK_THRESHOLD      = 2;     // converted referrals per reward

const QUALIFYING_PLANS = new Set(["starter", "pro"]);

/**
 * Mark a referral converted when the referred friend pays Essentiel/Pro, and
 * accrue any newly-earned rewards (status "pending"). Returns the referrer's id
 * when a new reward was created — so the caller issues the cash refund — else
 * null. Idempotent: never grants more than floor(conversions / 2).
 */
export async function onReferredUserPaid(
  clerkId: string,
  plan: string | null | undefined,
): Promise<number | null> {
  if (!plan || !QUALIFYING_PLANS.has(plan)) return null;

  const user = await getUserByClerkId(clerkId);
  if (!user) return null;

  const referral = await db.query.referralsTable.findFirst({
    where: and(
      eq(referralsTable.referredId, user.id),
      eq(referralsTable.status, "pending"),
    ),
  });
  if (!referral) return null; // organic user, or already converted

  await db
    .update(referralsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(referralsTable.id, referral.id));

  const created = await accrueDueRewards(referral.referrerId);
  return created > 0 ? referral.referrerId : null;
}

/** Insert any owed reward rows (status "pending") + bump lifetime earned. */
async function accrueDueRewards(referrerId: number): Promise<number> {
  const [{ value: convertedCount }] = await db
    .select({ value: count() })
    .from(referralsTable)
    .where(and(
      eq(referralsTable.referrerId, referrerId),
      or(eq(referralsTable.status, "completed"), eq(referralsTable.status, "rewarded")),
    ));

  const [{ value: grantedCount }] = await db
    .select({ value: count() })
    .from(referralRewardsTable)
    .where(and(
      eq(referralRewardsTable.userId, referrerId),
      eq(referralRewardsTable.reason, "referral_cashback"),
    ));

  const deserved = Math.floor(Number(convertedCount) / CASHBACK_THRESHOLD);
  const missing  = deserved - Number(grantedCount);
  if (missing <= 0) return 0;

  await db
    .update(usersTable)
    .set({ referralBalance: sql`${usersTable.referralBalance} + ${CASHBACK_AMOUNT * missing}` })
    .where(eq(usersTable.id, referrerId));

  for (let i = 0; i < missing; i++) {
    await db.insert(referralRewardsTable).values({
      userId: referrerId,
      amount: CASHBACK_AMOUNT,
      reason: "referral_cashback",
      status: "pending",   // awaiting cash refund to the referrer's card
    });
  }

  logger.info(
    { event: "referral_earned", referrerId, rewards: missing, amountCentimes: CASHBACK_AMOUNT * missing },
    `Referrer earned ${missing} × 100 MAD (pending refund)`,
  );
  return missing;
}

/** Total unpaid reward owed to a referrer, in MAD centimes. */
export async function getPendingPayoutCentimes(referrerId: number): Promise<number> {
  const rows = await db
    .select({ amount: referralRewardsTable.amount })
    .from(referralRewardsTable)
    .where(and(
      eq(referralRewardsTable.userId, referrerId),
      eq(referralRewardsTable.reason, "referral_cashback"),
      eq(referralRewardsTable.status, "pending"),
    ));
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0);
}

/**
 * The referrer's most recent paid Essentiel/Pro checkout session id, to refund
 * against. Only Essentiel/Pro charges qualify — so a referrer must be on a paid
 * upper tier to be cashed out (Basique/free referrers stay pending until they
 * upgrade, à la Replit's "upgrade to claim").
 */
export async function getReferrerLatestPaidSession(referrerId: number): Promise<string | null> {
  const report = await db.query.reportsTable.findFirst({
    where: and(
      eq(reportsTable.userId, referrerId),
      eq(reportsTable.paymentStatus, "paid"),
      or(eq(reportsTable.plan, "starter"), eq(reportsTable.plan, "pro")),
    ),
    orderBy: desc(reportsTable.paidAt),
  });
  return report?.stripeSessionId ?? null;
}

/** Mark a referrer's pending rewards paid, recording the Stripe refund id. */
export async function markReferralRewardsPaid(referrerId: number, refundId: string): Promise<void> {
  await db
    .update(referralRewardsTable)
    .set({ status: "paid", method: "stripe_refund", payoutDetails: refundId, paidAt: new Date() })
    .where(and(
      eq(referralRewardsTable.userId, referrerId),
      eq(referralRewardsTable.reason, "referral_cashback"),
      eq(referralRewardsTable.status, "pending"),
    ));
}
