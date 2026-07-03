import { pgTable, serial, integer, varchar, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";
import { paymentsTable } from "./payments";

export const couponTypeEnum = pgEnum("coupon_type", ["percent", "fixed"]);

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  type: couponTypeEnum("type").notNull().default("percent"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(), // percent (1-100) or fixed LYD
  // Scope: specific course, or all courses of the creating teacher, or platform-wide (admin)
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").references(() => usersTable.id, { onDelete: "cascade" }),
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const couponRedemptionsTable = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").notNull().references(() => couponsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  paymentId: integer("payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCouponSchema = createInsertSchema(couponsTable).omit({ id: true, usedCount: true, createdAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof couponsTable.$inferSelect;
export type CouponRedemption = typeof couponRedemptionsTable.$inferSelect;
