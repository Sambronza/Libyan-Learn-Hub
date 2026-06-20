import { pgTable, serial, integer, text, varchar, numeric, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";

export const tutoringStatusEnum = pgEnum("tutoring_status", [
  "pending", "accepted", "declined", "completed", "cancelled",
  "cancelled_no_show", "rescheduled_by_teacher", "rescheduled_by_student",
  "completed_pending_review", "approved", "rejected", "partially_approved"
]);

export const tutoringRequestsTable = pgTable("tutoring_requests", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => usersTable.id),
  teacherId: integer("teacher_id").references(() => usersTable.id),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  subject: varchar("subject", { length: 255 }).notNull(),
  topic: text("topic").notNull(),
  lecturerLevel: varchar("lecturer_level", { length: 100 }),
  isUrgent: boolean("is_urgent").notNull().default(false),
  attachmentsUrl: text("attachments_url"),
  preferredAt: timestamp("preferred_at").notNull(),
  proposedAt: timestamp("proposed_at"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  message: text("message"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  status: tutoringStatusEnum("status").notNull().default("pending"),
  meetingUrl: text("meeting_url"),
  recordingUrl: text("recording_url"),
  paymentId: integer("payment_id"),
  studentRating: integer("student_rating"),
  studentReview: text("student_review"),
  adminReview: text("admin_review"),
  // ── Server-authoritative session timer ───────────────────────────────────────
  sessionStartedAt: timestamp("session_started_at"),            // set when both participants first join
  timerPausedAt: timestamp("timer_paused_at"),                  // non-null means timer is paused (teacher left)
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0), // accumulated seconds before current pause
  teacherLeftAt: timestamp("teacher_left_at"),                  // last time teacher disconnected
  studentLeftAt: timestamp("student_left_at"),                  // last time student disconnected
  earlyTerminationFlagged: boolean("early_termination_flagged").notNull().default(false),
  // ─────────────────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TutoringRequest = typeof tutoringRequestsTable.$inferSelect;
