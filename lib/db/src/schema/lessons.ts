import { pgTable, serial, text, varchar, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";

export const lessonTypeEnum = pgEnum("lesson_type", ["video", "text", "quiz"]);

export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  sectionId: integer("section_id"),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  videoUrl: text("video_url"),
  videoFilePath: text("video_file_path"),
  /** Stable Cloudinary public_id for the uploaded video — never changes on lesson rename */
  videoPublicId: text("video_public_id"),
  documentFilePath: text("document_file_path"),
  documentFileName: varchar("document_file_name", { length: 255 }),
  /** Stable Cloudinary public_id for the uploaded document — never changes on lesson rename */
  documentPublicId: text("document_public_id"),
  content: text("content"),
  contentAr: text("content_ar"),
  notes: text("notes"),
  notesAr: text("notes_ar"),
  // AES-128 HLS encryption (content protection): when hlsEncrypted, playback
  // uses the stored playlist template + a key served only via the tokenized
  // key endpoint. The key NEVER leaves the database except through that endpoint.
  hlsEncrypted: boolean("hls_encrypted").notNull().default(false),
  hlsKeyHex: varchar("hls_key_hex", { length: 64 }),
  hlsPlaylist: text("hls_playlist"), // m3u8 template with __KEY_URI__ placeholder + absolute segment URLs
  duration: integer("duration").notNull().default(0),
  order: integer("order").notNull().default(0),
  isFree: boolean("is_free").notNull().default(false),
  type: lessonTypeEnum("type").notNull().default("video"),
  // Lesson metadata for search & discovery
  bookName: varchar("book_name", { length: 255 }),
  bookNameAr: varchar("book_name_ar", { length: 255 }),
  schoolYear: varchar("school_year", { length: 50 }),
  chapter: varchar("chapter", { length: 100 }),
  pageNumber: varchar("page_number", { length: 50 }),
  subjectTags: text("subject_tags"),
  // Anti-piracy: perceptual hash for duplicate detection
  videoFingerprint: text("video_fingerprint"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLessonSchema = createInsertSchema(lessonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessonsTable.$inferSelect;
