import { pgTable, serial, integer, text, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const withdrawalRequestsTable = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull().default("bank_transfer"), // 'bank_transfer', 'mobile_money', 'cash'
  details: text("details"), // freetext: account number, phone, etc.
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'approved', 'rejected', 'paid'
  adminNotes: text("admin_notes"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WithdrawalRequest = typeof withdrawalRequestsTable.$inferSelect;
export type InsertWithdrawal = typeof withdrawalRequestsTable.$inferInsert;
