import { eq, and, count, sql } from "drizzle-orm";
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
      referral_code:    referralCode,
    });
  }

  return created;
}

// ─── Get user by Clerk ID ─────────────────────────────────────────────────────

export async function getUserByClerkId(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

// ─── Called after a report is fully assembled ─────────────────────────────────
// $10 cashback unlocks after the referrer has 2 completed referrals.

const CASHBACK_THRESHOLD = 2;    // referrals needed
const CASHBACK_AMOUNT    = 1000; // $10 in cents

export async function onReportCompleted(
  clerkId: string,
  reportMeta?: { reportId?: string; subject?: string; wordCount?: number; sectionsCount?: number },
) {
  const user = await getUserByClerkId(clerkId);
  if (!user) return;

  // Send report_ready email — non-blocking
  if (user.email) {
    void sendEmail(user.email, "report_ready", {
      name:           user.name || user.email.split("@")[0],
      report_subject: reportMeta?.subject ?? "Rapport académique",
      report_id:      reportMeta?.reportId ?? "",
      word_count:     reportMeta?.wordCount ?? 0,
      sections_count: reportMeta?.sectionsCount ?? 0,
    });
  }

  // Find a pending referral where this user is the referred party
  const referral = await db.query.referralsTable.findFirst({
    where: and(
      eq(referralsTable.referredId, user.id),
      eq(referralsTable.status, "pending"),
    ),
  });
  if (!referral) return; // organic user, nothing to do

  // Mark referral completed
  await db
    .update(referralsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(referralsTable.id, referral.id));

  // Count all completed referrals for the referrer
  const [{ value: completedCount }] = await db
    .select({ value: count() })
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.referrerId, referral.referrerId),
        eq(referralsTable.status, "completed"),
      ),
    );

  if (Number(completedCount) >= CASHBACK_THRESHOLD) {
    // Give $10 cashback to referrer
    await db
      .update(usersTable)
      .set({ referralBalance: sql`${usersTable.referralBalance} + ${CASHBACK_AMOUNT}` })
      .where(eq(usersTable.id, referral.referrerId));

    await db.insert(referralRewardsTable).values({
      userId: referral.referrerId,
      amount: CASHBACK_AMOUNT,
      reason: "referral_cashback",
      status: "pending",
    });

    // Mark referral as rewarded so it doesn't trigger again
    await db
      .update(referralsTable)
      .set({ status: "rewarded" })
      .where(eq(referralsTable.id, referral.id));

    logger.info(
      { event: "referral_rewarded", referrerId: referral.referrerId, amount: CASHBACK_AMOUNT },
      `$${CASHBACK_AMOUNT / 100} cashback granted`,
    );
  }
}
