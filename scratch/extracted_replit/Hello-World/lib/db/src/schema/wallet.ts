import { pgTable, serial, text, varchar, numeric, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const transactionTypeEnum = pgEnum("transaction_type", ["credit", "debit"]);

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  referenceType: varchar("reference_type", { length: 100 }), // e.g., 'prepaid_card', 'tutoring_session'
  referenceId: integer("reference_id"), // ID of the referenced entity, if any
  description: text("description"), // e.g., "Redeemed Prepaid Card #1234"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
