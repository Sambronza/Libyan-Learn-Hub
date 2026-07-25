import { pgTable, serial, integer, text, varchar, bigint, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";

export const libraryResourceTypeEnum = pgEnum("library_resource_type", ["book", "article", "image", "link"]);

export const libraryResourcesTable = pgTable("library_resources", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }),
  author: varchar("author", { length: 255 }),
  description: text("description"),
  type: libraryResourceTypeEnum("type").notNull(),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  gradeLevel: varchar("grade_level", { length: 50 }),
  // File resources (book / article / image) — Cloudinary storage
  fileUrl: text("file_url"),
  filePublicId: text("file_public_id"),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: bigint("file_size", { mode: "number" }),
  // Link resources
  externalUrl: text("external_url"),
  // Engagement metric — incremented each time a resource is opened / downloaded.
  // Powers the "Most Popular" sort.
  viewCount: integer("view_count").notNull().default(0),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("library_resources_category_id_idx").on(t.categoryId),
  index("library_resources_type_idx").on(t.type),
]);

export const insertLibraryResourceSchema = createInsertSchema(libraryResourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLibraryResource = z.infer<typeof insertLibraryResourceSchema>;
export type LibraryResource = typeof libraryResourcesTable.$inferSelect;
