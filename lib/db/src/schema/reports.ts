import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./referrals";

export const reportsTable = pgTable("reports", {
  id:              text("id").primaryKey(),            // UUID from session
  userId:          integer("user_id").references(() => usersTable.id),
  plan:            text("plan"),                        // 'starter' | 'pro'
  paymentStatus:   text("payment_status").notNull().default("unpaid"),
  stripeSessionId: text("stripe_session_id"),
  paidAt:          timestamp("paid_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ createdAt: true });
export type Report       = typeof reportsTable.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
