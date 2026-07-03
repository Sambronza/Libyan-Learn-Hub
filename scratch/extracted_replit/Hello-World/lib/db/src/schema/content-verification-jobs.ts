import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { lessonsTable } from "./lessons";

export const verificationJobTypeEnum = pgEnum("verification_job_type", ["face", "voice", "duplicate_video", "audio_moderation"]);
export const verificationJobStatusEnum = pgEnum("verification_job_status", ["pending", "processing", "matched", "no_match", "failed"]);

export const contentVerificationJobsTable = pgTable("content_verification_jobs", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").references(() => lessonsTable.id, { onDelete: "set null" }),
  jobType: verificationJobTypeEnum("job_type").notNull(),
  status: verificationJobStatusEnum("status").notNull().default("pending"),
  matchScore: numeric("match_score", { precision: 5, scale: 2 }),
  duplicateOfLessonId: integer("duplicate_of_lesson_id").references(() => lessonsTable.id, { onDelete: "set null" }),
  adminNotes: text("admin_notes"),
  reviewedByAdminId: integer("reviewed_by_admin_id").references(() => usersTable.id),
  flaggedAt: timestamp("flagged_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentVerificationJobSchema = createInsertSchema(contentVerificationJobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentVerificationJob = z.infer<typeof insertContentVerificationJobSchema>;
export type ContentVerificationJob = typeof contentVerificationJobsTable.$inferSelect;
