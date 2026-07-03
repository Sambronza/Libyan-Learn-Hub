import { pgTable, serial, text, varchar, boolean, timestamp, pgEnum, numeric, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["student", "teacher", "admin"]);
export const languageEnum = pgEnum("language", ["ar", "en"]);
export const teacherTierEnum = pgEnum("teacher_tier", ["free", "bronze", "golden", "diamond"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  fullNameAr: varchar("full_name_ar", { length: 255 }),
  role: userRoleEnum("role").notNull().default("student"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  bioAr: text("bio_ar"),
  expertise: text("expertise"),
  language: languageEnum("language").notNull().default("ar"),
  phoneNumber: varchar("phone_number", { length: 20 }),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  otpCode: varchar("otp_code", { length: 6 }),
  otpExpiry: timestamp("otp_expiry"),
  isVerified: boolean("is_verified").notNull().default(false),
  isTutoringEnabled: boolean("is_tutoring_enabled").notNull().default(false),
  tutoringHourlyRate: numeric("tutoring_hourly_rate", { precision: 10, scale: 2 }).default("0"),
  tutoringSubjects: text("tutoring_subjects"),
  commissionAgreed: boolean("commission_agreed").notNull().default(false),
  tutoringSuspendedUntil: timestamp("tutoring_suspended_until"),
  // Teacher profile & verification fields
  cvUrl: text("cv_url"),
  facePhotoUrl: text("face_photo_url"),
  voiceSampleUrl: text("voice_sample_url"),
  copyrightAgreedAt: timestamp("copyright_agreed_at"),
  profileSlug: varchar("profile_slug", { length: 255 }).unique(),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  biometricProfile: text("biometric_profile"), // Will store JSON: { face: { front, left, right, up, down }, voice: { scriptText, status } }
  biometricsVerified: boolean("biometrics_verified").notNull().default(false),
  // Monetization / subscription
  tier: teacherTierEnum("tier").notNull().default("free"),
  proExpiry: timestamp("pro_expiry"),
  storageUsed: bigint("storage_used", { mode: 'number' }).notNull().default(0),
  isBonusUnlocked: boolean("is_bonus_unlocked").notNull().default(false),
  isSponsored: boolean("is_sponsored").notNull().default(false),
  sponsoredUntil: timestamp("sponsored_until"),
  balance: numeric("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  passkeyHash: text("passkey_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
