import { Router } from "express";
import { serverError } from "../lib/http.js";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  certificatesTable,
  coursesTable,
  usersTable,
  lessonsTable,
  progressTable,
  quizzesTable,
  quizAttemptsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { requireActiveEnrollment } from "../lib/subscriptions.js";

const router = Router();

/** Fraction of a video lesson that must be watched to count as "fully watched". */
const FULL_WATCH_RATIO = 0.9;

function generateCode(): string {
  // e.g. "LLH-9F3A2C7B1D" — short, unambiguous, verifiable
  return `LLH-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

/**
 * Check that the student fully watched every video lesson of the course.
 * "Fully watched" = watchedSeconds >= 90% of the lesson duration (durations are
 * stored in seconds on lessons created by upload; treat 0-duration lessons and
 * non-video lessons as satisfied).
 */
async function checkFullWatch(userId: number, courseId: number): Promise<{
  ok: boolean;
  totalLessons: number;
  fullyWatched: number;
  missing: Array<{ lessonId: number; title: string }>;
}> {
  const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.courseId, courseId));
  const progress = await db.select().from(progressTable)
    .where(and(eq(progressTable.userId, userId), eq(progressTable.courseId, courseId)));
  const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));

  const missing: Array<{ lessonId: number; title: string }> = [];
  let fullyWatched = 0;

  for (const lesson of lessons) {
    const isVideo = (lesson.type ?? "video") === "video" && (lesson.videoFilePath || lesson.videoUrl);
    if (!isVideo || !lesson.duration || lesson.duration <= 0) {
      fullyWatched++;
      continue;
    }
    const p = progressByLesson.get(lesson.id);
    const watched = p?.watchedSeconds ?? 0;
    if (p?.isCompleted || watched >= lesson.duration * FULL_WATCH_RATIO) {
      fullyWatched++;
    } else {
      missing.push({ lessonId: lesson.id, title: lesson.title });
    }
  }

  return { ok: missing.length === 0, totalLessons: lessons.length, fullyWatched, missing };
}

/** Eligibility status for the current student (drives the client UI). */
router.get("/courses/:courseId/eligibility", requireAuth, async (req, res) => {
  try {
    const { userId, role } = req.user!;
    const courseId = parseInt(req.params.courseId as string);

    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    if (course.certificateMode === "none") {
      res.json({ available: false });
      return;
    }

    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
    if (!teacher?.certificatesApproved) {
      res.json({ available: false });
      return;
    }

    // Already issued?
    const [existing] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.userId, userId), eq(certificatesTable.courseId, courseId)))
      .limit(1);
    if (existing) {
      res.json({ available: true, issued: true, certificate: existing });
      return;
    }

    const access = await requireActiveEnrollment(userId, courseId, role);
    if (!access.ok) {
      res.json({ available: true, issued: false, eligible: false, reason: "not_enrolled" });
      return;
    }

    const watch = await checkFullWatch(userId, courseId);

    let quizPassed: boolean | null = null;
    if (course.certificateMode === "quiz") {
      quizPassed = false;
      const [finalQuiz] = await db.select().from(quizzesTable)
        .where(and(eq(quizzesTable.courseId, courseId), eq(quizzesTable.type, "final"))).limit(1);
      if (finalQuiz) {
        const [attempt] = await db.select().from(quizAttemptsTable)
          .where(and(
            eq(quizAttemptsTable.quizId, finalQuiz.id),
            eq(quizAttemptsTable.userId, userId),
            eq(quizAttemptsTable.passed, true),
          )).limit(1);
        quizPassed = !!attempt;
      }
    }

    res.json({
      available: true,
      issued: false,
      mode: course.certificateMode,
      eligible: watch.ok && (course.certificateMode === "completion" || quizPassed === true),
      watch: { totalLessons: watch.totalLessons, fullyWatched: watch.fullyWatched, missingCount: watch.missing.length },
      quizPassed,
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

/** Issue the certificate (validates everything server-side). */
router.post("/courses/:courseId/issue", requireAuth, async (req, res) => {
  try {
    const { userId, role } = req.user!;
    const courseId = parseInt(req.params.courseId as string);

    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    if (course.certificateMode === "none") {
      res.status(400).json({
        error: "Certificates not enabled",
        message: "This course does not offer a certificate.",
        messageAr: "هذه الدورة لا تقدم شهادة.",
      });
      return;
    }

    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
    if (!teacher?.certificatesApproved) {
      res.status(400).json({
        error: "Teacher not certificate-approved",
        message: "The course teacher is not approved to issue certificates.",
        messageAr: "معلّم الدورة غير معتمد لإصدار الشهادات.",
      });
      return;
    }

    // Prevent duplicates
    const [existing] = await db.select().from(certificatesTable)
      .where(and(eq(certificatesTable.userId, userId), eq(certificatesTable.courseId, courseId)))
      .limit(1);
    if (existing) {
      res.json({ success: true, certificate: existing });
      return;
    }

    const access = await requireActiveEnrollment(userId, courseId, role);
    if (!access.ok) {
      res.status(403).json({
        error: "No active enrollment",
        message: "You need an active subscription to this course.",
        messageAr: "تحتاج إلى اشتراك نشط في هذه الدورة.",
      });
      return;
    }

    // FULL watch required — no skipping (client blocks seeking; server verifies totals)
    const watch = await checkFullWatch(userId, courseId);
    if (!watch.ok) {
      res.status(400).json({
        error: "Course not fully watched",
        message: `You must watch every lesson completely (${watch.fullyWatched}/${watch.totalLessons} done).`,
        messageAr: `يجب مشاهدة جميع الدروس كاملة (${watch.fullyWatched}/${watch.totalLessons} مكتمل).`,
        missing: watch.missing,
      });
      return;
    }

    // Quiz mode also requires passing the final quiz
    let quizScore: string | null = null;
    if (course.certificateMode === "quiz") {
      const [finalQuiz] = await db.select().from(quizzesTable)
        .where(and(eq(quizzesTable.courseId, courseId), eq(quizzesTable.type, "final"))).limit(1);
      if (!finalQuiz) {
        res.status(400).json({
          error: "No final quiz",
          message: "The course requires a final quiz but none exists yet. Contact the teacher.",
          messageAr: "تتطلب الدورة اختبارًا نهائيًا لكنه غير موجود بعد. تواصل مع المعلّم.",
        });
        return;
      }
      const [attempt] = await db.select().from(quizAttemptsTable)
        .where(and(
          eq(quizAttemptsTable.quizId, finalQuiz.id),
          eq(quizAttemptsTable.userId, userId),
          eq(quizAttemptsTable.passed, true),
        )).limit(1);
      if (!attempt) {
        res.status(400).json({
          error: "Final quiz not passed",
          message: "You must pass the final quiz to earn this certificate.",
          messageAr: "يجب اجتياز الاختبار النهائي للحصول على الشهادة.",
        });
        return;
      }
      quizScore = attempt.score;
    }

    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const [certificate] = await db.insert(certificatesTable).values({
      code: generateCode(),
      userId,
      courseId,
      studentName: student.fullName,
      studentNameAr: student.fullNameAr,
      courseTitle: course.title,
      courseTitleAr: course.titleAr,
      teacherName: teacher.fullName,
      mode: course.certificateMode,
      quizScore,
    }).returning();

    res.status(201).json({ success: true, certificate });
  } catch (err: any) {
    serverError(res, err);
  }
});

/** The student's certificates. */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.userId, userId));
    res.json(certs);
  } catch (err: any) {
    serverError(res, err);
  }
});

/** PUBLIC verification endpoint — anyone can validate a certificate code. */
router.get("/verify/:code", async (req, res) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const [cert] = await db.select().from(certificatesTable).where(eq(certificatesTable.code, code)).limit(1);
    if (!cert) {
      res.status(404).json({
        valid: false,
        message: "No certificate found for this code.",
        messageAr: "لا توجد شهادة بهذا الرمز.",
      });
      return;
    }
    res.json({
      valid: true,
      certificate: {
        code: cert.code,
        studentName: cert.studentName,
        studentNameAr: cert.studentNameAr,
        courseTitle: cert.courseTitle,
        courseTitleAr: cert.courseTitleAr,
        teacherName: cert.teacherName,
        mode: cert.mode,
        quizScore: cert.quizScore,
        issuedAt: cert.issuedAt,
      },
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
