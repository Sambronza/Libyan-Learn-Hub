import { Router } from "express";
import { db } from "@workspace/db";
import { coursesTable, usersTable, enrollmentsTable, reviewsTable, lessonsTable, liveSessionsTable, teacherEarningsTable } from "@workspace/db";
import { eq, count, avg, sum, sql, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

router.get("/courses", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const courses = await db.select().from(coursesTable).where(eq(coursesTable.teacherId, userId));
    const result = await Promise.all(courses.map(async (course) => {
      const [reviewData] = await db.select({ avgRating: avg(reviewsTable.rating), reviewCount: count() }).from(reviewsTable).where(eq(reviewsTable.courseId, course.id));
      const [enrollData] = await db.select({ value: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, course.id));
      const [lessonData] = await db.select({ lessonCount: count(), totalDuration: sum(lessonsTable.duration) }).from(lessonsTable).where(eq(lessonsTable.courseId, course.id));
      return {
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
        totalRevenue: parseFloat(course.price) * Number(enrollData?.value || 0),
        completionRate: 0,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/students", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    
    const rawStudents = await db
      .select({
        studentId: usersTable.id,
        studentName: usersTable.fullName,
        studentEmail: usersTable.email,
        courseId: coursesTable.id,
        courseTitle: coursesTable.title,
        enrolledAt: enrollmentsTable.enrolledAt,
        progress: enrollmentsTable.progress,
      })
      .from(enrollmentsTable)
      .innerJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
      .innerJoin(usersTable, eq(enrollmentsTable.userId, usersTable.id))
      .where(eq(coursesTable.teacherId, userId));

    const result = rawStudents.map(s => ({
      studentId: s.studentId,
      studentName: s.studentName,
      studentEmail: s.studentEmail,
      courseId: s.courseId,
      courseTitle: s.courseTitle,
      enrolledAt: s.enrolledAt,
      progress: parseFloat(s.progress as any || "0"),
    }));
    
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// Public: list all teachers with stats
router.get("/", async (_req, res) => {
  try {
    const teachers = await db.select().from(usersTable).where(eq(usersTable.role, "teacher"));
    const result = await Promise.all(teachers.map(async (t) => {
      const [cc] = await db.select({ total: count() }).from(coursesTable).where(and(eq(coursesTable.teacherId, t.id), eq(coursesTable.isPublished, true)));
      const [sc] = await db.select({ total: count() }).from(enrollmentsTable)
        .where(sql`${enrollmentsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${t.id})`);
      const [er] = await db.select({ avg: avg(reviewsTable.rating), cnt: count() }).from(reviewsTable)
        .where(sql`${reviewsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${t.id})`);
      return {
        id: t.id,
        fullName: t.fullName,
        fullNameAr: t.fullNameAr,
        bio: t.bio,
        bioAr: t.bioAr,
        expertise: t.expertise,
        avatarUrl: t.avatarUrl,
        isVerified: t.isVerified,
        isTutoringEnabled: t.isTutoringEnabled,
        tutoringHourlyRate: parseFloat(t.tutoringHourlyRate || "0"),
        isSponsored: t.isSponsored && t.sponsoredUntil && new Date(t.sponsoredUntil) > new Date(),
        tier: t.tier,
        profileSlug: t.profileSlug,
        courseCount: Number(cc.total),
        studentCount: Number(sc.total),
        rating: parseFloat(er.avg || "0"),
        reviewCount: Number(er.cnt),
      };
    }));
    // Sort: sponsored first, then by rating
    const sorted = result
      .filter(t => t.courseCount > 0 || t.isTutoringEnabled)
      .sort((a, b) => {
        if (a.isSponsored && !b.isSponsored) return -1;
        if (!a.isSponsored && b.isSponsored) return 1;
        return b.rating - a.rating;
      });
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
