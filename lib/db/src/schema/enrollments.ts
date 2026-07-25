import { pgTable, serial, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";
import { usersTable } from "./users";
import { paymentsTable } from "./payments";

export const enrollmentsTable = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  progress: numeric("progress", { precision: 5, scale: 2 }).notNull().default("0"),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  // Subscription fields (null subscriptionMonths/expiresAt = permanent access, e.g. free courses)
  subscriptionMonths: integer("subscription_months"), // 1 | 3 | 6 | 12
  startedAt: timestamp("started_at"),
  expiresAt: timestamp("expires_at"),
  lastPaymentId: integer("last_payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
  renewalCount: integer("renewal_count").notNull().default(0),
  // Scheduler idempotency stamps
  expiryNotifiedAt: timestamp("expiry_notified_at"),
  expiredNotifiedAt: timestamp("expired_notified_at"),
}, (t) => [
  index("enrollments_user_id_idx").on(t.userId),
  index("enrollments_course_id_idx").on(t.courseId),
]);

export const insertEnrollmentSchema = createInsertSchema(enrollmentsTable).omit({ id: true, enrolledAt: true });
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollmentsTable.$inferSelect;
