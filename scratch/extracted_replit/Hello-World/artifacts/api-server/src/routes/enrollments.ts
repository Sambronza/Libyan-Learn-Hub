import { Router } from "express";
import { db } from "@workspace/db";
import { enrollmentsTable, coursesTable, usersTable, reviewsTable, lessonsTable } from "@workspace/db";
import { eq, avg, count, sum, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { PLANS } from "../lib/plans.js";
import type { TeacherTier } from "../lib/plans.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const enrollments = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.userId, userId));
    const result = await Promise.all(
      enrollments.map(async (e) => {
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1);
        const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
        const [reviewData] = await db.select({ avgRating: avg(reviewsTable.rating), reviewCount: count() }).from(reviewsTable).where(eq(reviewsTable.courseId, course.id));
        const [enrollData] = await db.select({ value: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, course.id));
        const [lessonData] = await db.select({ lessonCount: count(), totalDuration: sum(lessonsTable.duration) }).from(lessonsTable).where(eq(lessonsTable.courseId, course.id));
        return {
          id: e.id,
          courseId: e.courseId,
          userId: e.userId,
          progress: parseFloat(e.progress),
          enrolledAt: e.enrolledAt,
          completedAt: e.completedAt,
          course: {
            id: course.id,
            title: course.title,
            titleAr: course.titleAr,
            description: course.description,
            descriptionAr: course.descriptionAr,
            thumbnailUrl: course.thumbnailUrl,
            price: parseFloat(course.price),
            currency: course.currency,
            level: course.level,
            language: course.language,
            categoryId: course.categoryId,
            teacherId: course.teacherId,
            teacherName: teacher?.fullName || "",
            teacherAvatar: teacher?.avatarUrl || null,
            rating: parseFloat(reviewData?.avgRating || "0"),
            reviewCount: Number(reviewData?.reviewCount || 0),
            enrollmentCount: Number(enrollData?.value || 0),
            lessonCount: Number(lessonData?.lessonCount || 0),
            totalDuration: Number(lessonData?.totalDuration || 0),
            isPublished: course.isPublished,
            createdAt: course.createdAt,
          },
        };
      })
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── POST /enrollments — Enroll student in a course ───────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { courseId } = req.body;

    if (!courseId) {
      res.status(400).json({ error: "courseId is required" });
      return;
    }

    // Prevent duplicate enrollment
    const [existing] = await db.select().from(enrollmentsTable)
      .where(eq(enrollmentsTable.userId, userId))
      .limit(1);
    // Only skip if exact course already enrolled
    const alreadyEnrolled = await db.select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.courseId, courseId))
      .then(rows => rows.some(r => r.userId === userId));

    if (alreadyEnrolled) {
      res.status(409).json({ error: "Already enrolled in this course" });
      return;
    }

    // Insert enrollment
    const [enrollment] = await db.insert(enrollmentsTable).values({
      userId,
      courseId,
    }).returning();

    // ── 100GB Bonus: Check if teacher has reached 100 unique students ───
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (course?.teacherId) {
      const teacherCourses = await db.select({ id: coursesTable.id })
        .from(coursesTable)
        .where(eq(coursesTable.teacherId, course.teacherId));
      const courseIds = teacherCourses.map(c => c.id);

      if (courseIds.length > 0) {
        // Count distinct students across all teacher's courses
        const [{ value: studentCount }] = await db
          .select({ value: count() })
          .from(enrollmentsTable)
          .where(inArray(enrollmentsTable.courseId, courseIds));

        const [teacher] = await db.select().from(usersTable)
          .where(eq(usersTable.id, course.teacherId)).limit(1);

        const plan = PLANS[(teacher.tier as TeacherTier) || "free"];

        if (Number(studentCount) >= plan.studentBonusThreshold && !teacher.isBonusUnlocked) {
          await db.update(usersTable)
            .set({ isBonusUnlocked: true })
            .where(eq(usersTable.id, course.teacherId));
          console.log(`★ Teacher ${teacher.fullName} (id=${teacher.id}) unlocked 100GB bonus storage!`);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────

    res.status(201).json(enrollment);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
