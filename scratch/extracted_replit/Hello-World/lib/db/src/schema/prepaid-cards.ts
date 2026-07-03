import { pgTable, serial, text, varchar, numeric, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const prepaidCardStatusEnum = pgEnum("prepaid_card_status", ["active", "used", "expired"]);

export const prepaidCardsTable = pgTable("prepaid_cards", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  status: prepaidCardStatusEnum("status").notNull().default("active"),
  usedBy: integer("used_by").references(() => usersTable.id),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
