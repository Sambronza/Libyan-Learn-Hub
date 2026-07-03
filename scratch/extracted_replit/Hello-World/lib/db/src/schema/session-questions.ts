import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { liveSessionsTable } from "./live-sessions";

export const sessionQuestionsTable = pgTable("session_questions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  question: text("question").notNull(),
  answered: boolean("answered").notNull().default(false),
  upvotes: integer("upvotes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SessionQuestion = typeof sessionQuestionsTable.$inferSelect;
