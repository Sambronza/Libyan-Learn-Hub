import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";
import { enrollmentsTable } from "./enrollments";
import { paymentsTable } from "./payments";

export const refundRequestStatusEnum = pgEnum("refund_request_status", ["pending", "approved", "rejected"]);

export const refundRequestsTable = pgTable("refund_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  enrollmentId: integer("enrollment_id").references(() => enrollmentsTable.id, { onDelete: "set null" }),
  paymentId: integer("payment_id").notNull().references(() => paymentsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  status: refundRequestStatusEnum("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRefundRequestSchema = createInsertSchema(refundRequestsTable).omit({ id: true, createdAt: true });
export type InsertRefundRequest = z.infer<typeof insertRefundRequestSchema>;
export type RefundRequest = typeof refundRequestsTable.$inferSelect;
