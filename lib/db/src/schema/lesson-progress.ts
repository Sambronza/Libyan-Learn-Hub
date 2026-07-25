import { pgTable, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { lessonsTable } from "./lessons";
import { coursesTable } from "./courses";

export const lessonProgressTable = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull().references(() => lessonsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("lesson_progress_user_course_idx").on(t.userId, t.courseId),
  index("lesson_progress_lesson_id_idx").on(t.lessonId),
]);

export type LessonProgress = typeof lessonProgressTable.$inferSelect;
