import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userReportDataTable = pgTable("user_report_data", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  reportData:  text("report_data").notNull(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
