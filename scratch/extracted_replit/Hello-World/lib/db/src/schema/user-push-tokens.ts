import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userPushTokensTable = pgTable("user_push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  deviceType: varchar("device_type", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserPushTokenSchema = createInsertSchema(userPushTokensTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserPushToken = z.infer<typeof insertUserPushTokenSchema>;
export type UserPushToken = typeof userPushTokensTable.$inferSelect;
