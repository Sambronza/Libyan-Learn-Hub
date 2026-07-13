import { Router } from "express";
import { serverError } from "../lib/http.js";
import { db } from "@workspace/db";
import { progressTable, enrollmentsTable, lessonsTable, coursesTable, usersTable, sectionsTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /progress/continue-watching
router.get("/continue-watching", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    
    const recentProgress = await db.select({
      progress: progressTable,
      lesson: lessonsTable,
      course: coursesTable,
      section: sectionsTable
    })
    .from(progressTable)
    .innerJoin(lessonsTable, eq(progressTable.lessonId, lessonsTable.id))
    .innerJoin(coursesTable, eq(progressTable.courseId, coursesTable.id))
    .leftJoin(sectionsTable, eq(lessonsTable.sectionId, sectionsTable.id))
    .where(and(
      eq(progressTable.userId, userId)
    ))
    .orderBy(desc(progressTable.updatedAt))
    .limit(3);

    res.json(recentProgress.map(p => ({
      courseId: p.course.id,
      courseTitle: p.course.title,
      courseTitleAr: p.course.titleAr,
      courseThumbnailUrl: p.course.thumbnailUrl,
      lessonId: p.lesson.id,
      lessonTitle: p.lesson.title,
      lessonTitleAr: p.lesson.titleAr,
      sectionTitle: p.section?.title || "",
      sectionTitleAr: p.section?.titleAr || "",
      watchedSeconds: p.progress.watchedSeconds,
      totalDuration: p.lesson.duration,
      updatedAt: p.progress.updatedAt,
      isCompleted: p.progress.isCompleted
    })));
  } catch (err: any) {
    serverError(res, err);
  }
});

// GET /progress/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    
    const enrollments = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.userId, userId));
    
    const summary = await Promise.all(
      enrollments.map(async (e) => {
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1);
        const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
        
        const lessonProgress = await db.select({
          lessonId: progressTable.lessonId,
          isCompleted: progressTable.isCompleted,
          watchedSeconds: progressTable.watchedSeconds
        }).from(progressTable).where(and(eq(progressTable.userId, userId), eq(progressTable.courseId, e.courseId)));
        
        return {
          courseId: course.id,
          title: course.title,
          titleAr: course.titleAr,
          thumbnailUrl: course.thumbnailUrl,
          teacherName: teacher?.fullName || "",
          overallProgress: parseFloat(e.progress) || 0,
          lessonProgress: lessonProgress
        };
      })
    );
    
    res.json(summary);
  } catch (err: any) {
    serverError(res, err);
  }
});

router.post("/:courseId/:lessonId", requireAuth, async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId as string);
    const lessonId = parseInt(req.params.lessonId as string);
    const { userId } = req.user!;
    const { isCompleted, watchedSeconds } = req.body;

    const existing = await db.select().from(progressTable)
      .where(and(eq(progressTable.lessonId, lessonId), eq(progressTable.userId, userId)))
      .limit(1);

    // Anti-skip guard: watched time can only grow, and never beyond the lesson
    // duration. Certificates rely on this value, so decreases (or absurd jumps
    // past the video length) are clamped server-side.
    let safeWatched = Math.max(0, Math.floor(Number(watchedSeconds) || 0));
    const [lessonRow] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
    if (lessonRow?.duration && lessonRow.duration > 0) {
      safeWatched = Math.min(safeWatched, lessonRow.duration);
    }
    if (existing.length > 0) {
      safeWatched = Math.max(safeWatched, existing[0].watchedSeconds ?? 0);
    }

    let prog;
    if (existing.length > 0) {
      [prog] = await db.update(progressTable)
        .set({ isCompleted, watchedSeconds: safeWatched, updatedAt: new Date() })
        .where(and(eq(progressTable.lessonId, lessonId), eq(progressTable.userId, userId)))
        .returning();
    } else {
      [prog] = await db.insert(progressTable)
        .values({ lessonId, courseId, userId, isCompleted, watchedSeconds: safeWatched })
        .returning();
    }

    const [completedCount] = await db.select({ value: count() }).from(progressTable)
      .where(and(eq(progressTable.courseId, courseId), eq(progressTable.userId, userId), eq(progressTable.isCompleted, true)));
    const [totalCount] = await db.select({ value: count() }).from(lessonsTable).where(eq(lessonsTable.courseId, courseId));
    const progressPct = totalCount.value > 0 ? (Number(completedCount.value) / Number(totalCount.value)) * 100 : 0;

    await db.update(enrollmentsTable)
      .set({ progress: progressPct.toFixed(2) })
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)));

    res.json({
      lessonId: prog.lessonId,
      courseId: prog.courseId,
      userId: prog.userId,
      isCompleted: prog.isCompleted,
      watchedSeconds: prog.watchedSeconds,
      updatedAt: prog.updatedAt,
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
