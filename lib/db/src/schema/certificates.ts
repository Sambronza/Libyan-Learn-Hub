import { pgTable, serial, integer, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

/**
 * Course completion certificates.
 * Issued only when: the course's certificateMode allows it, the teacher is
 * certificate-approved by an admin, and the student has FULLY watched every
 * video lesson (anti-skip enforced) — plus passed the final quiz when
 * certificateMode = "quiz".
 */
export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // public verification code
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  // Snapshots (so the certificate stays valid even if names change later)
  studentName: varchar("student_name", { length: 255 }).notNull(),
  studentNameAr: varchar("student_name_ar", { length: 255 }),
  courseTitle: varchar("course_title", { length: 255 }).notNull(),
  courseTitleAr: varchar("course_title_ar", { length: 255 }),
  teacherName: varchar("teacher_name", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull(), // "completion" | "quiz"
  quizScore: varchar("quiz_score", { length: 10 }), // e.g. "92.50" when mode=quiz
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({ id: true, issuedAt: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;
