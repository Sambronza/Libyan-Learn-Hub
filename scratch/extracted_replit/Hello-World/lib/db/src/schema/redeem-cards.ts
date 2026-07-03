import { pgTable, serial, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const redeemCardsTable = pgTable("redeem_cards", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'active', 'redeemed', 'deactivated'
  redeemedBy: integer("redeemed_by").references(() => usersTable.id),
  redeemedAt: timestamp("redeemed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deactivatedAt: timestamp("deactivated_at"),
});
