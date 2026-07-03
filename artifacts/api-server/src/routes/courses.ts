import { Router } from "express";
import { db } from "@workspace/db";
import {
  coursesTable,
  usersTable,
  categoriesTable,
  lessonsTable,
  enrollmentsTable,
  reviewsTable,
  progressTable,
  notificationsTable,
  sectionsTable,
} from "@workspace/db";
import { eq, and, ilike, count, avg, sum, sql, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";
import { deleteFromCloudinaryByUrl } from "../lib/cloudinary.js";
import { parsePlanPrices, hasIncompletePlanPrices } from "../lib/subscriptions.js";

const router = Router();

function buildCourseResult(course: any, teacher: any, reviewData: any, enrollCount: number, lessonData: any) {
  return {
    id: course.id,
    title: course.title,
    titleAr: course.titleAr,
    description: course.description,
    descriptionAr: course.descriptionAr,
    thumbnailUrl: course.thumbnailUrl,
    price: parseFloat(course.price),
    priceMonth1: course.priceMonth1 !== null && course.priceMonth1 !== undefined ? parseFloat(course.priceMonth1) : null,
    priceMonth3: course.priceMonth3 !== null && course.priceMonth3 !== undefined ? parseFloat(course.priceMonth3) : null,
    priceMonth6: course.priceMonth6 !== null && course.priceMonth6 !== undefined ? parseFloat(course.priceMonth6) : null,
    priceMonth12: course.priceMonth12 !== null && course.priceMonth12 !== undefined ? parseFloat(course.priceMonth12) : null,
    currency: course.currency,
    level: course.level,
    language: course.language,
    categoryId: course.categoryId,
    teacherId: course.teacherId,
    teacherName: teacher?.fullName || "",
    teacherAvatar: teacher?.avatarUrl || null,
    rating: parseFloat(reviewData?.avgRating || "0"),
    reviewCount: Number(reviewData?.reviewCount || 0),
    enrollmentCount: enrollCount,
    lessonCount: Number(lessonData?.lessonCount || 0),
    totalDuration: Number(lessonData?.totalDuration || 0),
    isPublished: course.isPublished,
    createdAt: course.createdAt,
  };
}

router.get("/", async (req, res) => {
  try {
    const { categoryId, search, level, language, teacherId, page = "1", limit = "12" } = req.query as any;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.isPublished, true))
      .$dynamic();

    const conditions: any[] = [eq(coursesTable.isPublished, true)];
    if (categoryId) conditions.push(eq(coursesTable.categoryId, parseInt(categoryId)));
    if (level) conditions.push(eq(coursesTable.level, level));
    if (language) conditions.push(eq(coursesTable.language, language));
    if (teacherId) conditions.push(eq(coursesTable.teacherId, parseInt(teacherId)));
    if (search) conditions.push(ilike(coursesTable.title, `%${search}%`));

    const allCourses = await db
      .select()
      .from(coursesTable)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .limit(limitNum)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(coursesTable)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const courses = await Promise.all(
      allCourses.map(async (course) => {
        const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
        const [reviewData] = await db
          .select({ avgRating: avg(reviewsTable.rating), reviewCount: count() })
          .from(reviewsTable)
          .where(eq(reviewsTable.courseId, course.id));
        const [enrollData] = await db
          .select({ value: count() })
          .from(enrollmentsTable)
          .where(eq(enrollmentsTable.courseId, course.id));
        const [lessonData] = await db
          .select({ lessonCount: count(), totalDuration: sum(lessonsTable.duration) })
          .from(lessonsTable)
          .where(eq(lessonsTable.courseId, course.id));

        return buildCourseResult(course, teacher, reviewData, Number(enrollData.value), lessonData);
      })
    );

    res.json({
      courses,
      total: Number(total),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Number(total) / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Bulk creation: course + default section + lessons in one shot ─────────────
router.post("/bulk", requireAuth, requireRole("teacher", "admin"), async (req, res): Promise<any> => {
  try {
    const { userId } = (req as any).user;

    // Validate biometrics
    const [teacherUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!teacherUser) return res.status(404).json({ error: "User not found" });
    if (teacherUser.role === "teacher" && !teacherUser.biometricsVerified) {
      return res.status(403).json({ error: "Biometric identity verification is required before creating a course." });
    }

    const {
      title,
      titleAr,
      description,
      descriptionAr,
      price,
      categoryId,
      level = "beginner",
      language = "ar",
      lessons, // array of { title, titleAr, videoFilePath, duration, isFree }
    } = req.body;

    if (!title || !categoryId) {
      return res.status(400).json({ error: "title and categoryId are required" });
    }
    if (!Array.isArray(lessons) || lessons.length === 0) {
      return res.status(400).json({ error: "At least one lesson is required" });
    }

    // Subscription plan prices (paid courses must set all 4 before review)
    const planPrices = parsePlanPrices(req.body);
    if (planPrices.error) {
      return res.status(400).json(planPrices.error);
    }

    // 1. Create the course
    const [course] = await db.insert(coursesTable).values({
      title,
      titleAr: titleAr || title,
      description: description || title,
      descriptionAr: descriptionAr || titleAr || title,
      ...planPrices.values!,
      level,
      language,
      categoryId: parseInt(categoryId),
      teacherId: userId,
      isPublished: false,
      status: "pending_review",
      submittedAt: new Date(),
    }).returning();

    // 2. Create a default section
    const [section] = await db.insert(sectionsTable).values({
      courseId: course.id,
      title: "General",
      titleAr: "عام",
      order: 0,
    }).returning();

    // 3. Bulk-insert lessons
    const lessonRows = lessons.map((l: any, idx: number) => ({
      courseId: course.id,
      sectionId: section.id,
      title: l.title || `Lesson ${idx + 1}`,
      titleAr: l.titleAr || l.title || `درس ${idx + 1}`,
      videoFilePath: l.videoFilePath || null,
      videoUrl: l.videoUrl || null,
      documentFilePath: l.documentFilePath || null,
      documentFileName: l.documentFileName || null,
      duration: parseInt(l.duration) || 0,
      isFree: l.isFree === true || l.isFree === "true",
      type: l.type || "video",
      order: idx,
    }));
    const insertedLessons = await db.insert(lessonsTable).values(lessonRows).returning();

    // 4. Notify all admins about the new pending course
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
    if (admins.length > 0) {
      await db.insert(notificationsTable).values(admins.map((admin) => ({
        userId: admin.id,
        type: "course_submitted" as any,
        title: "New Course Pending Review",
        titleAr: "دورة جديدة تنتظر المراجعة",
        message: `A new course "${course.title}" by ${teacherUser.fullName} has been submitted for review.`,
        messageAr: `تم إرسال دورة جديدة "${course.titleAr}" بواسطة ${teacherUser.fullName} للمراجعة.`,
        referenceId: course.id,
      })));
    }

    res.status(201).json({
      course: { id: course.id, title: course.title, status: course.status },
      section: { id: section.id },
      lessons: insertedLessons.map(l => ({ id: l.id, title: l.title, order: l.order })),
    });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create course", message: err.message });
  }
});

router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { title, titleAr, description, descriptionAr, thumbnailUrl, level, language, categoryId } = req.body;
    const planPrices = parsePlanPrices(req.body);
    if (planPrices.error) {
      res.status(400).json(planPrices.error);
      return;
    }
    const [course] = await db.insert(coursesTable).values({
      title, titleAr, description, descriptionAr, thumbnailUrl,
      ...planPrices.values!,
      level, language, categoryId,
      isPublished: false,
      teacherId: userId,
    }).returning();
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.status(201).json(buildCourseResult(course, teacher, { avgRating: "0", reviewCount: 0 }, 0, { lessonCount: 0, totalDuration: 0 }));
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create course", message: err.message });
  }
});

router.get("/:courseId", async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }

    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, course.categoryId)).limit(1);
    const [reviewData] = await db
      .select({ avgRating: avg(reviewsTable.rating), reviewCount: count() })
      .from(reviewsTable)
      .where(eq(reviewsTable.courseId, courseId));
    const [enrollData] = await db.select({ value: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId));
    const [lessonData] = await db
      .select({ lessonCount: count(), totalDuration: sum(lessonsTable.duration) })
      .from(lessonsTable)
      .where(eq(lessonsTable.courseId, courseId));
    const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.courseId, courseId)).orderBy(lessonsTable.order);

    let isEnrolled = false;
    let userProgress = null;
    let completedLessonIds = new Set<number>();
    const token = req.headers.authorization?.slice(7);
    if (token) {
      try {
        const { verifyToken } = await import("../lib/auth.js");
        const payload = verifyToken(token);
        const [enrollment] = await db
          .select()
          .from(enrollmentsTable)
          .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, payload.userId)))
          .limit(1);
        if (enrollment) {
          isEnrolled = true;
          userProgress = parseFloat(enrollment.progress);
          // Fetch all completed lessons for this user + course in one query
          const progRows = await db
            .select({ lessonId: progressTable.lessonId })
            .from(progressTable)
            .where(and(
              eq(progressTable.userId, payload.userId),
              eq(progressTable.courseId, courseId),
              eq(progressTable.isCompleted, true)
            ));
          completedLessonIds = new Set(progRows.map(r => r.lessonId));
        }
      } catch {}
    }

    const teacherCourseCount = await db.select({ value: count() }).from(coursesTable).where(eq(coursesTable.teacherId, teacher.id));
    const teacherStudentCount = await db.select({ value: count() }).from(enrollmentsTable)
      .where(sql`${enrollmentsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacher.id})`);
    const teacherRating = await db.select({ avgRating: avg(reviewsTable.rating) }).from(reviewsTable)
      .where(sql`${reviewsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacher.id})`);

    res.json({
      ...buildCourseResult(course, teacher, reviewData, Number(enrollData.value), lessonData),
      lessons: lessons.map(l => ({
        id: l.id,
        title: l.title,
        titleAr: l.titleAr,
        duration: l.duration,
        order: l.order,
        isFree: l.isFree,
        type: l.type,
        isCompleted: completedLessonIds.has(l.id),
      })),
      category: {
        id: category?.id,
        name: category?.name,
        nameAr: category?.nameAr,
        icon: category?.icon,
        courseCount: 0,
      },
      teacher: {
        id: teacher.id,
        fullName: teacher.fullName,
        fullNameAr: teacher.fullNameAr || teacher.fullName,
        avatarUrl: teacher.avatarUrl,
        bio: teacher.bio,
        bioAr: teacher.bioAr,
        courseCount: Number(teacherCourseCount[0].value),
        studentCount: Number(teacherStudentCount[0].value),
        rating: parseFloat(teacherRating[0]?.avgRating || "0"),
        expertise: teacher.expertise,
      },
      isEnrolled,
      userProgress,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/:courseId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const { userId, role } = (req as any).user;
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    if (course.teacherId !== userId && role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

    const { title, titleAr, description, descriptionAr, thumbnailUrl, price, level, language, categoryId } = req.body;

    // Only touch pricing when the request includes pricing fields
    const hasPricingFields = [price, req.body.priceMonth1, req.body.priceMonth3, req.body.priceMonth6, req.body.priceMonth12]
      .some((v) => v !== undefined);
    let pricingValues = {};
    if (hasPricingFields) {
      const planPrices = parsePlanPrices(req.body);
      if (planPrices.error) {
        res.status(400).json(planPrices.error);
        return;
      }
      pricingValues = planPrices.values!;
    }

    const [updated] = await db.update(coursesTable)
      .set({ title, titleAr, description, descriptionAr, thumbnailUrl, ...pricingValues, level, language, categoryId, updatedAt: new Date() })
      .where(eq(coursesTable.id, courseId))
      .returning();

    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, updated.teacherId)).limit(1);

    // Trigger notification if newly published
    if (!course.isPublished && updated.isPublished) {
      const students = await db.select().from(usersTable).where(eq(usersTable.role, "student"));
      if (students.length > 0) {
        const notifications = students.map(s => ({
          userId: s.id,
          type: "new_course" as const,
          title: "New Course Available!",
          titleAr: "دورة جديدة متاحة!",
          message: `A new course "${updated.title}" has been published by ${teacher?.fullName || 'a teacher'}.`,
          messageAr: `تم نشر دورة جديدة "${updated.titleAr}" بواسطة ${teacher?.fullNameAr || teacher?.fullName || 'أحد المعلمين'}.`,
          referenceId: updated.id,
        }));
        await db.insert(notificationsTable).values(notifications);
      }
    }
    const [reviewData] = await db.select({ avgRating: avg(reviewsTable.rating), reviewCount: count() }).from(reviewsTable).where(eq(reviewsTable.courseId, courseId));
    const [enrollData] = await db.select({ value: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId));
    const [lessonData] = await db.select({ lessonCount: count(), totalDuration: sum(lessonsTable.duration) }).from(lessonsTable).where(eq(lessonsTable.courseId, courseId));

    res.json(buildCourseResult(updated, teacher, reviewData, Number(enrollData.value), lessonData));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/:courseId/submit", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const { userId, role } = (req as any).user;
    
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    if (course.teacherId !== userId && role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    
    if (course.status !== "draft" && course.status !== "rejected") {
      res.status(400).json({ error: "Course is already submitted or published" });
      return;
    }

    // Paid courses must have all 4 subscription prices before publishing
    if (hasIncompletePlanPrices(course)) {
      res.status(400).json({
        error: "Missing subscription prices",
        message: "Set prices for all four subscription durations (1, 3, 6, and 12 months) before submitting the course.",
        messageAr: "حدّد أسعار جميع مدد الاشتراك الأربع (شهر، 3 أشهر، 6 أشهر، 12 شهرًا) قبل إرسال الدورة للمراجعة.",
      });
      return;
    }

    const [updated] = await db.update(coursesTable)
      .set({
        status: "pending_review",
        submittedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(coursesTable.id, courseId))
      .returning();

    // Notify all admins
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
    const teacher = await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
    
    if (admins.length > 0) {
      const notifications = admins.map(admin => ({
        userId: admin.id,
        type: "course_submitted" as any,
        title: "New Course Review",
        titleAr: "مراجعة دورة جديدة",
        message: `A new course "${updated.title}" by ${teacher[0]?.fullName} is waiting for review.`,
        messageAr: `هناك دورة جديدة "${updated.titleAr}" بواسطة ${teacher[0]?.fullName} في انتظار المراجعة.`,
        referenceId: updated.id,
      }));
      await db.insert(notificationsTable).values(notifications);
    }

    res.json({ success: true, status: updated.status });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});


router.delete("/:courseId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const { userId, role } = (req as any).user;
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    if (course.teacherId !== userId && role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

    // Deletion allowed even if students are enrolled
    // Delete associated files from Cloudinary
    if (course.thumbnailUrl) {
      await deleteFromCloudinaryByUrl(course.thumbnailUrl);
    }
    const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.courseId, courseId));
    for (const lesson of lessons) {
      if (lesson.videoUrl) await deleteFromCloudinaryByUrl(lesson.videoUrl);
      if (lesson.videoFilePath) await deleteFromCloudinaryByUrl(lesson.videoFilePath);
      if (lesson.documentFilePath) await deleteFromCloudinaryByUrl(lesson.documentFilePath);
    }

    await db.delete(coursesTable).where(eq(coursesTable.id, courseId));
    res.json({ success: true, message: "Course deleted" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/:courseId/lessons", async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.courseId, courseId)).orderBy(lessonsTable.order);
    res.json(lessons.map(l => ({
      id: l.id,
      title: l.title,
      titleAr: l.titleAr,
      duration: l.duration,
      order: l.order,
      isFree: l.isFree,
      type: l.type,
      courseId: l.courseId,
      videoUrl: l.videoUrl,
      videoFilePath: l.videoFilePath,
      documentFilePath: l.documentFilePath,
      documentFileName: l.documentFileName,
      content: l.content,
      contentAr: l.contentAr,
      createdAt: l.createdAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:courseId/lessons", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const { title, titleAr, videoUrl, videoFilePath, videoPublicId, documentFilePath, documentPublicId, documentFileName, content, contentAr, duration, order, isFree, type, bookName, bookNameAr, schoolYear, chapter, pageNumber, subjectTags } = req.body;
    const [lesson] = await db.insert(lessonsTable).values({
      courseId, title, titleAr, videoUrl, videoFilePath, videoPublicId: videoPublicId || null,
      documentFilePath, documentPublicId: documentPublicId || null, documentFileName, content, contentAr,
      duration: duration || 0,
      order: order || 0,
      isFree: isFree || false,
      type: type || "video",
      bookName: bookName || null, bookNameAr: bookNameAr || null, schoolYear: schoolYear || null,
      chapter: chapter || null, pageNumber: pageNumber || null, subjectTags: subjectTags || null
    }).returning();
    res.status(201).json({ ...lesson, courseId: lesson.courseId });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create lesson", message: err.message });
  }
});

router.get("/:courseId/lessons/:lessonId", requireAuth, async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const lessonId = parseParam(req.params.lessonId);
    const { userId } = (req as any).user;
    const [lesson] = await db.select().from(lessonsTable)
      .where(and(eq(lessonsTable.id, lessonId), eq(lessonsTable.courseId, courseId)))
      .limit(1);
    if (!lesson) { res.status(404).json({ error: "Lesson not found" }); return; }

    if (!lesson.isFree) {
      const [enrollment] = await db.select().from(enrollmentsTable)
        .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)))
        .limit(1);
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
      if (!enrollment && course?.teacherId !== userId) {
        res.status(403).json({ error: "Not enrolled in this course" });
        return;
      }
    }

    const [prog] = await db.select().from(progressTable)
      .where(and(eq(progressTable.lessonId, lessonId), eq(progressTable.userId, userId)))
      .limit(1);

    res.json({
      id: lesson.id,
      title: lesson.title,
      titleAr: lesson.titleAr,
      duration: lesson.duration,
      order: lesson.order,
      isFree: lesson.isFree,
      type: lesson.type,
      courseId: lesson.courseId,
      videoUrl: lesson.videoUrl,
      videoFilePath: lesson.videoFilePath,
      documentFilePath: lesson.documentFilePath,
      documentFileName: lesson.documentFileName,
      content: lesson.content,
      contentAr: lesson.contentAr,
      createdAt: lesson.createdAt,
      isCompleted: prog?.isCompleted || false,
      watchedSeconds: prog?.watchedSeconds || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/:courseId/lessons/:lessonId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const lessonId = parseParam(req.params.lessonId);
    const body = req.body;

    // Build a partial update — only include fields that were explicitly sent in the request body.
    // This prevents callers that only update e.g. isFree from accidentally nulling out
    // videoFilePath / documentFilePath and breaking playback.
    const updateData: Record<string, any> = { updatedAt: new Date() };
    const fields = [
      'title', 'titleAr', 'videoUrl', 'videoFilePath', 'videoPublicId',
      'documentFilePath', 'documentPublicId', 'documentFileName',
      'content', 'contentAr', 'duration', 'order', 'isFree',
    ];
    for (const f of fields) {
      if (f in body) updateData[f] = body[f];
    }
    // Nullable fields: coerce empty string / missing to null
    const nullableFields = ['bookName', 'bookNameAr', 'schoolYear', 'chapter', 'pageNumber', 'subjectTags'];
    for (const f of nullableFields) {
      if (f in body) updateData[f] = body[f] || null;
    }

    const [updated] = await db.update(lessonsTable)
      .set(updateData)
      .where(eq(lessonsTable.id, lessonId))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.delete("/:courseId/lessons/:lessonId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const lessonId = parseParam(req.params.lessonId);
    
    // Fetch lesson first to get the URLs
    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
    if (lesson) {
      if (lesson.videoUrl) await deleteFromCloudinaryByUrl(lesson.videoUrl);
      if (lesson.videoFilePath) await deleteFromCloudinaryByUrl(lesson.videoFilePath);
      if (lesson.documentFilePath) await deleteFromCloudinaryByUrl(lesson.documentFilePath);
    }

    await db.delete(lessonsTable).where(eq(lessonsTable.id, lessonId));
    res.json({ success: true, message: "Lesson deleted" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:courseId/enroll", requireAuth, async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const { userId } = (req as any).user;
    const existing = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)))
      .limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Already enrolled" });
      return;
    }
    const [enrollment] = await db.insert(enrollmentsTable).values({ courseId, userId, progress: "0" }).returning();
    res.status(201).json({
      id: enrollment.id,
      courseId: enrollment.courseId,
      userId: enrollment.userId,
      progress: parseFloat(enrollment.progress),
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/:courseId/reviews", async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.courseId, courseId)).orderBy(reviewsTable.createdAt);
    const result = await Promise.all(
      reviews.map(async (r) => {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          user: {
            id: r.userId,
            fullName: user?.fullName || "Unknown",
            fullNameAr: user?.fullNameAr || user?.fullName || "Unknown",
            avatarUrl: user?.avatarUrl || null,
          }
        };
      })
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:courseId/reviews", requireAuth, async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const { userId } = (req as any).user;
    const { rating, comment } = req.body;
    const [review] = await db.insert(reviewsTable).values({ courseId, userId, rating, comment }).returning();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.status(201).json({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: {
        id: review.userId,
        fullName: user?.fullName || "Unknown",
        fullNameAr: user?.fullNameAr || user?.fullName || "Unknown",
        avatarUrl: user?.avatarUrl || null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
