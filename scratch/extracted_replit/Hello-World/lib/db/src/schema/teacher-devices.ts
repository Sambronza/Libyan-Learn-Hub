import { pgTable, serial, integer, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const teacherDevicesTable = pgTable("teacher_devices", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  deviceFingerprint: varchar("device_fingerprint", { length: 255 }).notNull(),
  deviceName: varchar("device_name", { length: 255 }),
  lastIp: varchar("last_ip", { length: 45 }),
  userAgent: text("user_agent"),
  isTrusted: boolean("is_trusted").notNull().default(false),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeacherDeviceSchema = createInsertSchema(teacherDevicesTable).omit({ id: true, createdAt: true });
export type InsertTeacherDevice = z.infer<typeof insertTeacherDeviceSchema>;
export type TeacherDevice = typeof teacherDevicesTable.$inferSelect;
