import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lessonsTable } from "./lessons";

export const slidesTable = pgTable("slides", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessonsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }),
  content: text("content"),
  contentAr: text("content_ar"),
  imageUrl: text("image_url"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSlideSchema = createInsertSchema(slidesTable).omit({ id: true, createdAt: true });
export type InsertSlide = z.infer<typeof insertSlideSchema>;
export type Slide = typeof slidesTable.$inferSelect;
