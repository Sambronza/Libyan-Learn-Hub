import { pgTable, serial, integer, text, varchar, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const adTypeEnum = pgEnum("ad_type", ["homepage_banner", "search_boost"]);
export const adStatusEnum = pgEnum("ad_status", ["pending", "active", "expired", "cancelled"]);

export const advertisementsTable = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  adType: adTypeEnum("ad_type").notNull(),
  status: adStatusEnum("status").notNull().default("pending"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  budgetPaid: numeric("budget_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  isActive: boolean("is_active").notNull().default(false),
  paymentId: integer("payment_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdvertisementSchema = createInsertSchema(advertisementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdvertisement = z.infer<typeof insertAdvertisementSchema>;
export type Advertisement = typeof advertisementsTable.$inferSelect;
