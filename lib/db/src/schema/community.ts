import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

// ── Teacher posts (public announcements / study tips / updates) ──────────────
export const teacherPostsTable = pgTable("teacher_posts", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  imagePublicId: text("image_public_id"),
  linkUrl: text("link_url"),
  // Optional reference to one of the teacher's courses ("I just published…")
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTeacherPostSchema = createInsertSchema(teacherPostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeacherPost = z.infer<typeof insertTeacherPostSchema>;
export type TeacherPost = typeof teacherPostsTable.$inferSelect;

// ── Follows (students following teachers) ────────────────────────────────────
export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("follows_follower_teacher_unique").on(t.followerId, t.teacherId),
]);

export const insertFollowSchema = createInsertSchema(followsTable).omit({ id: true, createdAt: true });
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;
