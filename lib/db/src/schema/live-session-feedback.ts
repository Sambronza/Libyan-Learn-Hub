import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { liveSessionsTable } from "./live-sessions";

export const liveSessionFeedbackTable = pgTable("live_session_feedback", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contentRating: integer("content_rating").notNull(),     // 1–5: quality of teaching
  technicalRating: integer("technical_rating"),            // 1–5: audio/video quality (optional)
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  // Enforce one feedback per student per session
  uniqUserSession: unique("uniq_live_feedback_user_session").on(t.sessionId, t.userId),
}));

export const insertLiveSessionFeedbackSchema = createInsertSchema(liveSessionFeedbackTable).omit({ id: true, createdAt: true });
export type InsertLiveSessionFeedback = z.infer<typeof insertLiveSessionFeedbackSchema>;
export type LiveSessionFeedback = typeof liveSessionFeedbackTable.$inferSelect;
