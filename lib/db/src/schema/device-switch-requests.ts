import { pgTable, serial, integer, text, varchar, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { studentDevicesTable } from "./student-devices";

export const deviceSwitchRequestStatusEnum = pgEnum("device_switch_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const deviceSwitchRequestsTable = pgTable("device_switch_requests", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  oldDeviceId: integer("old_device_id").references(() => studentDevicesTable.id, { onDelete: "set null" }),
  newFingerprint: varchar("new_fingerprint", { length: 255 }).notNull(),
  newDeviceName: varchar("new_device_name", { length: 255 }),
  newUserAgent: text("new_user_agent"),
  newIp: varchar("new_ip", { length: 45 }),
  newPlatform: varchar("new_platform", { length: 20 }),
  // Face evidence for admin review
  originalFaceSnapshotUrl: text("original_face_snapshot_url"), // signup face photo
  attemptFaceSnapshotUrl: text("attempt_face_snapshot_url"), // live capture from the failed attempt
  attemptDescriptor: text("attempt_descriptor"), // JSON array of the computed descriptor
  distance: numeric("distance", { precision: 6, scale: 4 }), // best euclidean distance vs stored descriptors
  status: deviceSwitchRequestStatusEnum("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeviceSwitchRequestSchema = createInsertSchema(deviceSwitchRequestsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDeviceSwitchRequest = z.infer<typeof insertDeviceSwitchRequestSchema>;
export type DeviceSwitchRequest = typeof deviceSwitchRequestsTable.$inferSelect;
