import { pgTable, serial, integer, text, timestamp, unique, boolean, type AnyPgColumn } from "drizzle-orm/pg-core";
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
  // Post owner can switch off the comment section per post
  commentsEnabled: boolean("comments_enabled").notNull().default(true),
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

// ── Comments on posts (one level of replies) ─────────────────────────────────
export const postCommentsTable = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => teacherPostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // One-level threading: replies reference a top-level comment
  parentId: integer("parent_id").references((): AnyPgColumn => postCommentsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPostCommentSchema = createInsertSchema(postCommentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type PostComment = typeof postCommentsTable.$inferSelect;

// ── Likes ─────────────────────────────────────────────────────────────────────
export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => teacherPostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("post_likes_post_user_unique").on(t.postId, t.userId),
]);

export type PostLike = typeof postLikesTable.$inferSelect;

export const commentLikesTable = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => postCommentsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("comment_likes_comment_user_unique").on(t.commentId, t.userId),
]);

export type CommentLike = typeof commentLikesTable.$inferSelect;
