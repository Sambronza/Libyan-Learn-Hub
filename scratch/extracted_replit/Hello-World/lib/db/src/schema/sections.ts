import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";

export const sectionsTable = pgTable("sections", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSectionSchema = createInsertSchema(sectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type Section = typeof sectionsTable.$inferSelect;
