import { pgTable, serial, integer, text, varchar, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";
import { tutoringRequestsTable } from "./tutoring-requests";
import { liveSessionCoursesTable } from "./live-session-courses";

export const paymentMethodEnum = pgEnum("payment_method", ["bank_transfer", "cash", "mobile_wallet", "wallet", "redeem_card"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded", "on_hold"]);

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  liveSessionCourseId: integer("live_session_course_id").references(() => liveSessionCoursesTable.id, { onDelete: "set null" }),
  sessionId: integer("session_id"),
  tutoringRequestId: integer("tutoring_request_id").references(() => tutoringRequestsTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  method: paymentMethodEnum("method").notNull().default("bank_transfer"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  reference: varchar("reference", { length: 100 }),
  durationMonths: integer("duration_months"), // Subscription duration purchased (1|3|6|12); null for non-subscription payments
  couponId: integer("coupon_id"), // applied coupon, if any
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }), // amount saved via coupon
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
