import { pgTable, serial, text, varchar, integer, numeric, boolean, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// ─── Enums ────────────────────────────────────────────────────

export const academyProgramTypeEnum = pgEnum("academy_program_type", [
  "primary",         // Grades 1-6
  "preparatory",     // Grades 7-9
  "secondary_scientific", // Grades 10-12 Scientific
  "secondary_literary",   // Grades 10-12 Literary
]);

export const academyApplicationStatusEnum = pgEnum("academy_application_status", [
  "pending",
  "approved",
  "rejected",
  "waitlisted",
]);

export const academyEnrollmentStatusEnum = pgEnum("academy_enrollment_status", [
  "active",
  "suspended",
  "completed",
  "withdrawn",
]);

export const academyRegistrationStatusEnum = pgEnum("academy_registration_status", [
  "registered",
  "in_progress",
  "completed",
  "failed",
  "dropped",
]);

export const parentRelationshipEnum = pgEnum("parent_relationship", [
  "parent",
  "guardian",
  "learning_coach",
]);

// ─── Programs ─────────────────────────────────────────────────

export const academyProgramsTable = pgTable("academy_programs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  type: academyProgramTypeEnum("type").notNull(),
  gradeLevel: varchar("grade_level", { length: 50 }).notNull(), // e.g. "10", "7-9", "1-6"
  durationYears: integer("duration_years").notNull().default(1),
  tuitionPerSemester: numeric("tuition_per_semester", { precision: 10, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Semesters ────────────────────────────────────────────────

export const academySemestersTable = pgTable("academy_semesters", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  programId: integer("program_id").notNull().references(() => academyProgramsTable.id, { onDelete: "cascade" }),
  academicYear: varchar("academic_year", { length: 20 }).notNull(), // e.g. "2026-2027"
  semesterNumber: integer("semester_number").notNull().default(1), // 1 = Fall, 2 = Spring
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Subjects ─────────────────────────────────────────────────

export const academySubjectsTable = pgTable("academy_subjects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  programId: integer("program_id").notNull().references(() => academyProgramsTable.id, { onDelete: "cascade" }),
  gradeLevel: varchar("grade_level", { length: 50 }).notNull(),
  semesterNumber: integer("semester_number").notNull().default(1),
  creditHours: integer("credit_hours").notNull().default(3),
  prerequisiteSubjectId: integer("prerequisite_subject_id"), // self-reference, nullable
  teacherId: integer("teacher_id").references(() => usersTable.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Applications ─────────────────────────────────────────────

export const academyApplicationsTable = pgTable("academy_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").notNull().references(() => academyProgramsTable.id),
  status: academyApplicationStatusEnum("status").notNull().default("pending"),
  gradeLevel: varchar("grade_level", { length: 50 }).notNull(),
  previousSchool: varchar("previous_school", { length: 255 }),
  previousSchoolAr: varchar("previous_school_ar", { length: 255 }),
  documentsUrl: text("documents_url"), // uploaded transcripts/ID
  parentName: varchar("parent_name", { length: 255 }),
  parentNameAr: varchar("parent_name_ar", { length: 255 }),
  parentPhone: varchar("parent_phone", { length: 20 }),
  parentEmail: varchar("parent_email", { length: 255 }),
  notes: text("notes"), // student's notes
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewNotes: text("review_notes"),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Enrollments (student in a program for a semester) ────────

export const academyEnrollmentsTable = pgTable("academy_enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  programId: integer("program_id").notNull().references(() => academyProgramsTable.id),
  semesterId: integer("semester_id").notNull().references(() => academySemestersTable.id),
  applicationId: integer("application_id").references(() => academyApplicationsTable.id),
  status: academyEnrollmentStatusEnum("status").notNull().default("active"),
  currentGradeLevel: varchar("current_grade_level", { length: 50 }).notNull(),
  gpa: numeric("gpa", { precision: 4, scale: 2 }),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Registrations (student ↔ subject per semester) ───────────

export const academyRegistrationsTable = pgTable("academy_registrations", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => academyEnrollmentsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => academySubjectsTable.id),
  semesterId: integer("semester_id").notNull().references(() => academySemestersTable.id),
  grade: numeric("grade", { precision: 5, scale: 2 }), // nullable until graded
  status: academyRegistrationStatusEnum("status").notNull().default("registered"),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Parent / Learning Coach Links ────────────────────────────

export const academyParentLinksTable = pgTable("academy_parent_links", {
  id: serial("id").primaryKey(),
  parentUserId: integer("parent_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  studentUserId: integer("student_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  relationship: parentRelationshipEnum("relationship").notNull().default("parent"),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Insert Schemas & Types ───────────────────────────────────

export const insertAcademyProgramSchema = createInsertSchema(academyProgramsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAcademySemesterSchema = createInsertSchema(academySemestersTable).omit({ id: true, createdAt: true });
export const insertAcademySubjectSchema = createInsertSchema(academySubjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAcademyApplicationSchema = createInsertSchema(academyApplicationsTable).omit({ id: true, appliedAt: true, reviewedAt: true, updatedAt: true });
export const insertAcademyEnrollmentSchema = createInsertSchema(academyEnrollmentsTable).omit({ id: true, enrolledAt: true, completedAt: true, updatedAt: true });
export const insertAcademyRegistrationSchema = createInsertSchema(academyRegistrationsTable).omit({ id: true, registeredAt: true, updatedAt: true });
export const insertAcademyParentLinkSchema = createInsertSchema(academyParentLinksTable).omit({ id: true, createdAt: true });

export type AcademyProgram = typeof academyProgramsTable.$inferSelect;
export type AcademySemester = typeof academySemestersTable.$inferSelect;
export type AcademySubject = typeof academySubjectsTable.$inferSelect;
export type AcademyApplication = typeof academyApplicationsTable.$inferSelect;
export type AcademyEnrollment = typeof academyEnrollmentsTable.$inferSelect;
export type AcademyRegistration = typeof academyRegistrationsTable.$inferSelect;
export type AcademyParentLink = typeof academyParentLinksTable.$inferSelect;

export type InsertAcademyProgram = z.infer<typeof insertAcademyProgramSchema>;
export type InsertAcademySemester = z.infer<typeof insertAcademySemesterSchema>;
export type InsertAcademySubject = z.infer<typeof insertAcademySubjectSchema>;
export type InsertAcademyApplication = z.infer<typeof insertAcademyApplicationSchema>;
export type InsertAcademyEnrollment = z.infer<typeof insertAcademyEnrollmentSchema>;
export type InsertAcademyRegistration = z.infer<typeof insertAcademyRegistrationSchema>;
export type InsertAcademyParentLink = z.infer<typeof insertAcademyParentLinkSchema>;
