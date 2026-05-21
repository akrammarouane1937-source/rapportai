import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const referralStatusEnum  = pgEnum("referral_status",  ["pending", "completed", "rewarded"]);
export const rewardStatusEnum    = pgEnum("reward_status",    ["pending", "processing", "paid"]);

// ─── Users (referral fields only — Clerk handles auth) ───────────────────────
// One row per Clerk user ID. Created on first sign-in.

export const usersTable = pgTable("users", {
  id:                     serial("id").primaryKey(),
  clerkId:                text("clerk_id").notNull().unique(),
  email:                  text("email"),
  name:                   text("name"),
  referralCode:           text("referral_code").notNull().unique(),
  referredByCode:         text("referred_by_code"),
  referralBalance:        integer("referral_balance").notNull().default(0),
  referralBalanceFrozen:  integer("referral_balance_frozen").notNull().default(0),
  isFoundingUser:         boolean("is_founding_user").notNull().default(false),
  stripeConnectId:        text("stripe_connect_id"),
  createdAt:              timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type User       = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// ─── Referrals ────────────────────────────────────────────────────────────────

export const referralsTable = pgTable("referrals", {
  id:          serial("id").primaryKey(),
  referrerId:  integer("referrer_id").notNull().references(() => usersTable.id),
  referredId:  integer("referred_id").notNull().references(() => usersTable.id),
  status:      referralStatusEnum("status").notNull().default("pending"),
  createdAt:   timestamp("created_at",   { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true, createdAt: true });
export type Referral       = typeof referralsTable.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

// ─── Referral rewards ─────────────────────────────────────────────────────────

export const referralRewardsTable = pgTable("referral_rewards", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => usersTable.id),
  amount:        integer("amount").notNull(),
  reason:        text("reason").notNull(),
  method:        text("method"),            // 'bank' | 'paypal' | 'stripe_connect'
  payoutDetails: text("payout_details"),    // JSON string — encrypted in prod
  status:        rewardStatusEnum("status").notNull().default("pending"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paidAt:        timestamp("paid_at",    { withTimezone: true }),
});

export const insertRewardSchema = createInsertSchema(referralRewardsTable).omit({ id: true, createdAt: true });
export type ReferralReward       = typeof referralRewardsTable.$inferSelect;
export type InsertReferralReward = z.infer<typeof insertRewardSchema>;
