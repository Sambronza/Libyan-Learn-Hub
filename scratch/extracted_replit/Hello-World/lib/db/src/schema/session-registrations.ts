import { pgTable, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { liveSessionsTable } from "./live-sessions";

export const sessionRegistrationsTable = pgTable("session_registrations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SessionRegistration = typeof sessionRegistrationsTable.$inferSelect;
