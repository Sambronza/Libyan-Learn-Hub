import { pgTable, serial, varchar, integer, text, boolean, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";
import { lessonsTable } from "./lessons";
import { usersTable } from "./users";

export const quizTypeEnum = pgEnum("quiz_type", ["lesson", "final"]);
export const questionTypeEnum = pgEnum("question_type", ["multiple_choice", "true_false", "short_answer"]);

export const quizzesTable = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").references(() => lessonsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  type: quizTypeEnum("type").notNull().default("lesson"),
  passingScore: integer("passing_score").notNull().default(70),
  timeLimitMinutes: integer("time_limit_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizQuestionsTable = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  questionAr: text("question_ar").notNull(),
  type: questionTypeEnum("type").notNull().default("multiple_choice"),
  points: integer("points").notNull().default(1),
  explanation: text("explanation"),
  explanationAr: text("explanation_ar"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quizOptionsTable = pgTable("quiz_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => quizQuestionsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  textAr: text("text_ar").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  order: integer("order").notNull().default(0),
});

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  score: numeric("score", { precision: 5, scale: 2 }).notNull().default("0"),
  totalPoints: integer("total_points").notNull().default(0),
  earnedPoints: integer("earned_points").notNull().default(0),
  passed: boolean("passed").notNull().default(false),
  answers: text("answers"),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const insertQuizSchema = createInsertSchema(quizzesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuizQuestionSchema = createInsertSchema(quizQuestionsTable).omit({ id: true, createdAt: true });
export const insertQuizOptionSchema = createInsertSchema(quizOptionsTable).omit({ id: true });
export const insertQuizAttemptSchema = createInsertSchema(quizAttemptsTable).omit({ id: true, completedAt: true });

export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzesTable.$inferSelect;
export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;
export type QuizOption = typeof quizOptionsTable.$inferSelect;
export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;
