import { pgTable, serial, integer, numeric, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const earningsStatusEnum = pgEnum("earnings_status", ["pending", "available", "paid"]);

export const teacherEarningsTable = pgTable("teacher_earnings", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  paymentId: integer("payment_id").notNull(),
  courseId: integer("course_id"),
  sessionId: integer("session_id"),
  tutoringRequestId: integer("tutoring_request_id"),
  grossAmount: numeric("gross_amount", { precision: 10, scale: 2 }).notNull(),
  platformFeePercent: numeric("platform_fee_percent", { precision: 5, scale: 2 }).notNull().default("20"),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  status: earningsStatusEnum("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeacherEarningSchema = createInsertSchema(teacherEarningsTable).omit({ id: true, createdAt: true });
export type InsertTeacherEarning = z.infer<typeof insertTeacherEarningSchema>;
export type TeacherEarning = typeof teacherEarningsTable.$inferSelect;
