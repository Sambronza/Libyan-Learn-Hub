import { Router } from "express";
import { db } from "@workspace/db";
import {
  sectionsTable,
  lessonsTable,
  slidesTable,
  quizzesTable,
  enrollmentsTable,
  usersTable,
  contentVerificationJobsTable
} from "@workspace/db";
import { eq, and, asc, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const courseId = parseParam((req.params as any).courseId);
    const sections = await db
      .select()
      .from(sectionsTable)
      .where(eq(sectionsTable.courseId, courseId))
      .orderBy(asc(sectionsTable.order));

    const sectionsWithLessons = await Promise.all(
      sections.map(async (section) => {
        const lessons = await db
          .select()
          .from(lessonsTable)
          .where(
            and(
              eq(lessonsTable.courseId, courseId),
              eq(lessonsTable.sectionId, section.id)
            )
          )
          .orderBy(asc(lessonsTable.order));

        const lessonIds = lessons.map((l) => l.id);
        const quiz = lessonIds.length
          ? await db
              .select()
              .from(quizzesTable)
              .where(
                and(
                  eq(quizzesTable.courseId, courseId),
                  eq(quizzesTable.type, "lesson")
                )
              )
              .limit(1)
          : [];

        return {
          ...section,
          lessons: lessons.map((l) => ({
            id: l.id,
            title: l.title,
            titleAr: l.titleAr,
            duration: l.duration,
            order: l.order,
            isFree: l.isFree,
            type: l.type,
          })),
          lessonCount: lessons.length,
        };
      })
    );

    res.json(sectionsWithLessons);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const { title, titleAr, description, descriptionAr, order } = req.body;
    const [section] = await db
      .insert(sectionsTable)
      .values({ courseId, title, titleAr, description, descriptionAr, order: order || 0 })
      .returning();
    res.status(201).json(section);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create section", message: err.message });
  }
});

router.put("/:sectionId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const sectionId = parseParam(req.params.sectionId);
    const { title, titleAr, description, descriptionAr, order } = req.body;
    const [updated] = await db
      .update(sectionsTable)
      .set({ title, titleAr, description, descriptionAr, order, updatedAt: new Date() })
      .where(eq(sectionsTable.id, sectionId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Section not found" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update section", message: err.message });
  }
});

router.delete("/:sectionId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const sectionId = parseParam(req.params.sectionId);

    // Deletion allowed even if students are enrolled
    // Clean up Cloudinary assets for all lessons in this section before deleting
    const { deleteFromCloudinaryByUrl } = await import("../lib/cloudinary.js");
    const sectionLessons = await db.select().from(lessonsTable)
      .where(and(eq(lessonsTable.courseId, courseId), eq(lessonsTable.sectionId, sectionId)));
    for (const lesson of sectionLessons) {
      if (lesson.videoUrl) await deleteFromCloudinaryByUrl(lesson.videoUrl);
      if (lesson.videoFilePath) await deleteFromCloudinaryByUrl(lesson.videoFilePath);
      if (lesson.documentFilePath) await deleteFromCloudinaryByUrl(lesson.documentFilePath);
    }

    // Cascade-delete lessons within this section
    await db.delete(lessonsTable).where(and(eq(lessonsTable.courseId, courseId), eq(lessonsTable.sectionId, sectionId)));
    await db.delete(sectionsTable).where(eq(sectionsTable.id, sectionId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to delete section", message: err.message });
  }
});

router.get("/:sectionId/lessons", async (req, res) => {
  try {
    const courseId = parseParam((req.params as any).courseId);
    const sectionId = parseParam(req.params.sectionId);
    const lessons = await db
      .select()
      .from(lessonsTable)
      .where(
        and(
          eq(lessonsTable.courseId, courseId),
          eq(lessonsTable.sectionId, sectionId)
        )
      )
      .orderBy(asc(lessonsTable.order));

    const lessonsWithSlides = await Promise.all(
      lessons.map(async (lesson) => {
        const slides = await db
          .select()
          .from(slidesTable)
          .where(eq(slidesTable.lessonId, lesson.id))
          .orderBy(asc(slidesTable.order));

        const quiz = await db
          .select()
          .from(quizzesTable)
          .where(
            and(
              eq(quizzesTable.lessonId, lesson.id),
              eq(quizzesTable.type, "lesson")
            )
          )
          .limit(1);

        return {
          ...lesson,
          slides,
          hasQuiz: quiz.length > 0,
          quizId: quiz[0]?.id || null,
        };
      })
    );

    res.json(lessonsWithSlides);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:sectionId/lessons", requireAuth, requireRole("teacher", "admin"), async (req, res): Promise<any> => {
  try {
    const reqUser = (req as any).user;
    const courseId = parseParam(req.params.courseId);
    const sectionId = parseParam(req.params.sectionId);
    
    // Enforce biometrics setup
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, reqUser.userId)
    });
    
    if (reqUser?.role === 'teacher' && !user?.biometricsVerified) {
      return res.status(403).json({ error: "Biometric identity verification is required before uploading lessons." });
    }

    const {
      title, titleAr, videoUrl,
      videoFilePath, videoPublicId,
      documentFilePath, documentPublicId, documentFileName,
      content, contentAr, notes, notesAr, duration, order, isFree, type,
      bookName, bookNameAr, schoolYear, chapter, pageNumber, subjectTags
    } = req.body;

    const [lesson] = await db
      .insert(lessonsTable)
      .values({ 
        courseId, sectionId, title, titleAr, videoUrl,
        videoFilePath, videoPublicId: videoPublicId || null,
        documentFilePath, documentPublicId: documentPublicId || null, documentFileName, 
        content, contentAr, notes, notesAr, duration: duration || 0, order: order || 0, 
        isFree: isFree || false, type: type || "video",
        bookName: bookName || null, bookNameAr: bookNameAr || null, schoolYear: schoolYear || null,
        chapter: chapter || null, pageNumber: pageNumber || null, subjectTags: subjectTags || null
      })
      .returning();

    // Trigger biometric video verification if it's a video lesson by a teacher
    if (reqUser?.role === 'teacher' && type === 'video' && (videoUrl || videoFilePath)) {
      // Simulate verification job
      await db.insert(contentVerificationJobsTable).values({
        teacherId: reqUser.userId,
        lessonId: lesson.id,
        jobType: "face",
        status: "processing"
      });
    }

    res.status(201).json(lesson);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create lesson", message: err.message });
  }
});

export default router;
