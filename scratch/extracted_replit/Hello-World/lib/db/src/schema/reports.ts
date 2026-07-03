import { pgTable, serial, integer, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const reportTypeEnum = pgEnum("report_type", ["lesson", "session", "teacher", "course"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "under_review", "resolved", "dismissed"]);
export const reportReasonEnum = pgEnum("report_reason", [
  "wrong_content", "offensive", "technical_issue", "no_show",
  "inappropriate_behavior", "copyright", "spam",
  "stolen_identity", "stolen_material", "other"
]);

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id),
  reportedUserId: integer("reported_user_id").references(() => usersTable.id),
  type: reportTypeEnum("type").notNull(),
  reason: reportReasonEnum("reason").notNull(),
  description: text("description"),
  targetId: integer("target_id"),
  status: reportStatusEnum("status").notNull().default("open"),
  adminNote: text("admin_note"),
  resolvedById: integer("resolved_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;
