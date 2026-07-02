import { pgTable, serial, integer, text, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * A "Live Session Course" groups a set of scheduled live sessions under one
 * named entity created by a teacher. Each session in the group carries its
 * own `liveSessionCourseId` FK pointing here.
 */
export const liveSessionCoursesTable = pgTable("live_session_courses", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  description: text("description"),
  /** Price per individual session in the course (LYD) */
  pricePerSession: numeric("price_per_session", { precision: 10, scale: 2 }).notNull().default("0"),
  /** Total number of sessions planned */
  sessionCount: integer("session_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLiveSessionCourseSchema = createInsertSchema(liveSessionCoursesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLiveSessionCourse = z.infer<typeof insertLiveSessionCourseSchema>;
export type LiveSessionCourse = typeof liveSessionCoursesTable.$inferSelect;
