import { pgTable, serial, integer, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const studentDeviceStatusEnum = pgEnum("student_device_status", ["trusted", "blocked"]);

export const studentDevicesTable = pgTable("student_devices", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  deviceFingerprint: varchar("device_fingerprint", { length: 255 }).notNull(),
  deviceName: varchar("device_name", { length: 255 }),
  platform: varchar("platform", { length: 20 }), // "web" | "ios" | "android"
  lastIp: varchar("last_ip", { length: 45 }),
  userAgent: text("user_agent"),
  // Only one "trusted" row per student (enforced in application code)
  status: studentDeviceStatusEnum("status").notNull().default("trusted"),
  trustedAt: timestamp("trusted_at"),
  blockedAt: timestamp("blocked_at"),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentDeviceSchema = createInsertSchema(studentDevicesTable).omit({ id: true, createdAt: true });
export type InsertStudentDevice = z.infer<typeof insertStudentDeviceSchema>;
export type StudentDevice = typeof studentDevicesTable.$inferSelect;
