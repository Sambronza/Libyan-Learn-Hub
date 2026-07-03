import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "profile_view", "share_click", "course_impression", "ad_click", "ad_impression"
]);

export const profileAnalyticsTable = pgTable("profile_analytics", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: analyticsEventTypeEnum("event_type").notNull(),
  referer: text("referer"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProfileAnalyticsSchema = createInsertSchema(profileAnalyticsTable).omit({ id: true, createdAt: true });
export type InsertProfileAnalytics = z.infer<typeof insertProfileAnalyticsSchema>;
export type ProfileAnalytics = typeof profileAnalyticsTable.$inferSelect;
