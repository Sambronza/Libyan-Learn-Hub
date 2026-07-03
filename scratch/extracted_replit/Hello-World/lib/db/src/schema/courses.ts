import { pgTable, serial, text, varchar, integer, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";

export const levelEnum = pgEnum("level", ["beginner", "intermediate", "advanced"]);
export const courseStatusEnum = pgEnum("course_status", ["draft", "pending_review", "published", "rejected"]);

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("LYD"),
  level: levelEnum("level").notNull().default("beginner"),
  language: varchar("language", { length: 5 }).notNull().default("ar"),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  isPublished: boolean("is_published").notNull().default(false), // Kept for backwards compatibility
  status: courseStatusEnum("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;
