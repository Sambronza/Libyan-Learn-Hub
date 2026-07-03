import { pgTable, serial, integer, text, varchar, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "hosting", "domain", "marketing", "salary", "tools", "other"
]);

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  category: expenseCategoryEnum("category").notNull().default("other"),
  notes: text("notes"),
  expenseDate: timestamp("expense_date").notNull().defaultNow(),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Expense = typeof expensesTable.$inferSelect;
