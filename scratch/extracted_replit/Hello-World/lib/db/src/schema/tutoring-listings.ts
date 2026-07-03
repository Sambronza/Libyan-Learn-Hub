import { pgTable, serial, varchar, integer, text, boolean, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tutoringListingStatusEnum = pgEnum("tutoring_listing_status", ["active", "paused", "closed"]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "accepted", "declined", "cancelled"]);

export const tutoringListingsTable = pgTable("tutoring_listings", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  subjectAr: varchar("subject_ar", { length: 100 }).notNull(),
  gradeLevel: varchar("grade_level", { length: 100 }),
  gradeLevelAr: varchar("grade_level_ar", { length: 100 }),
  description: text("description"),
  descriptionAr: text("description_ar"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  maxStudents: integer("max_students").notNull().default(1),
  availableDays: text("available_days"),
  availableTimeFrom: varchar("available_time_from", { length: 10 }),
  availableTimeTo: varchar("available_time_to", { length: 10 }),
  sessionDurationMinutes: integer("session_duration_minutes").notNull().default(60),
  status: tutoringListingStatusEnum("status").notNull().default("active"),
  totalApplications: integer("total_applications").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tutoringApplicationsTable = pgTable("tutoring_applications", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => tutoringListingsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message"),
  preferredAt: timestamp("preferred_at"),
  status: applicationStatusEnum("status").notNull().default("pending"),
  teacherNote: text("teacher_note"),
  meetingUrl: text("meeting_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTutoringListingSchema = createInsertSchema(tutoringListingsTable).omit({ id: true, createdAt: true, updatedAt: true, totalApplications: true });
export const insertTutoringApplicationSchema = createInsertSchema(tutoringApplicationsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertTutoringListing = z.infer<typeof insertTutoringListingSchema>;
export type TutoringListing = typeof tutoringListingsTable.$inferSelect;
export type TutoringApplication = typeof tutoringApplicationsTable.$inferSelect;
