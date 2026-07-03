import { pgTable, serial, integer, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { lessonsTable } from "./lessons";

export const complaintStatusEnum = pgEnum("complaint_status", ["open", "investigating", "resolved", "dismissed"]);

export const copyrightComplaintsTable = pgTable("copyright_complaints", {
  id: serial("id").primaryKey(),
  reporterName: varchar("reporter_name", { length: 255 }).notNull(),
  reporterEmail: varchar("reporter_email", { length: 255 }).notNull(),
  reporterUserId: integer("reporter_user_id").references(() => usersTable.id),
  reportedTeacherId: integer("reported_teacher_id").notNull().references(() => usersTable.id),
  reportedLessonId: integer("reported_lesson_id").references(() => lessonsTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  proofUrl: text("proof_url"),
  status: complaintStatusEnum("status").notNull().default("open"),
  adminNotes: text("admin_notes"),
  resolvedById: integer("resolved_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCopyrightComplaintSchema = createInsertSchema(copyrightComplaintsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCopyrightComplaint = z.infer<typeof insertCopyrightComplaintSchema>;
export type CopyrightComplaint = typeof copyrightComplaintsTable.$inferSelect;
