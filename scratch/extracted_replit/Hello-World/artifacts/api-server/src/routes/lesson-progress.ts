import { Router } from "express";
import { db } from "@workspace/db";
import { lessonProgressTable, lessonsTable, enrollmentsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

// Get progress for a course (all lessons)
router.get("/courses/:courseId", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const courseId = parseParam(req.params.courseId);
    const progress = await db.select().from(lessonProgressTable)
      .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.courseId, courseId)));
    const [totalLessons] = await db.select({ total: count() }).from(lessonsTable).where(eq(lessonsTable.courseId, courseId));
    const completedIds = progress.filter(p => p.completed).map(p => p.lessonId);
    res.json({
      completedLessonIds: completedIds,
      totalLessons: Number(totalLessons.total),
      completedCount: completedIds.length,
      percentage: totalLessons.total > 0 ? Math.round((completedIds.length / Number(totalLessons.total)) * 100) : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// Mark a lesson complete
router.post("/lessons/:lessonId/complete", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const lessonId = parseParam(req.params.lessonId);
    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
    if (!lesson) { res.status(404).json({ error: "Lesson not found" }); return; }

    const existing = await db.select().from(lessonProgressTable)
      .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.lessonId, lessonId))).limit(1);

    if (existing.length > 0) {
      await db.update(lessonProgressTable)
        .set({ completed: true, completedAt: new Date() })
        .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.lessonId, lessonId)));
    } else {
      await db.insert(lessonProgressTable).values({
        userId, lessonId, courseId: lesson.courseId, completed: true, completedAt: new Date()
      });
    }

    // Update overall course progress
    const [totalLessons] = await db.select({ total: count() }).from(lessonsTable).where(eq(lessonsTable.courseId, lesson.courseId));
    const [completedLessons] = await db.select({ total: count() }).from(lessonProgressTable)
      .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.courseId, lesson.courseId), eq(lessonProgressTable.completed, true)));
    const pct = totalLessons.total > 0 ? Math.round((Number(completedLessons.total) / Number(totalLessons.total)) * 100) : 0;
    await db.update(enrollmentsTable)
      .set({ progress: pct.toString() })
      .where(and(eq(enrollmentsTable.userId, userId), eq(enrollmentsTable.courseId, lesson.courseId)));

    res.json({ success: true, percentage: pct, isComplete: pct === 100 });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
