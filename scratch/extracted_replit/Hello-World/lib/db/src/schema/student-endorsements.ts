import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const studentEndorsementsTable = pgTable("student_endorsements", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  trait: varchar("trait", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentEndorsementSchema = createInsertSchema(studentEndorsementsTable).omit({ id: true, createdAt: true });
export type InsertStudentEndorsement = z.infer<typeof insertStudentEndorsementSchema>;
export type StudentEndorsement = typeof studentEndorsementsTable.$inferSelect;
