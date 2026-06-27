import { pgTable, serial, integer, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => usersTable.id),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: integer("target_id"),
  details: jsonb("details"),
  ip: varchar("ip", { length: 60 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
