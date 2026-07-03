import { pgTable, serial, integer, text, varchar, timestamp, numeric, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

export const sessionStatusEnum = pgEnum("session_status", ["scheduled", "live", "ended", "cancelled"]);

export const liveSessionsTable = pgTable("live_sessions", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  maxParticipants: integer("max_participants").notNull().default(100),
  meetingUrl: text("meeting_url"),
  recordingUrl: text("recording_url"),
  status: sessionStatusEnum("status").notNull().default("scheduled"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  cancellationReason: text("cancellation_reason"),
  notificationSent: boolean("notification_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLiveSessionSchema = createInsertSchema(liveSessionsTable).omit({ id: true, createdAt: true });
export type InsertLiveSession = z.infer<typeof insertLiveSessionSchema>;
export type LiveSession = typeof liveSessionsTable.$inferSelect;
