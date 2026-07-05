import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, coursesTable, enrollmentsTable, reviewsTable, lessonsTable,
  profileAnalyticsTable, studentEndorsementsTable,
} from "@workspace/db";
import { eq, count, avg, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { sendEmail, buildTeacherApprovedEmail, buildTeacherRejectedEmail } from "../lib/email.js";

const router = Router();

// Multer config for image / file uploads
const storage = multer.memoryStorage();
const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
  },
});
const docUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // Also accept images for qualifications/certificates
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, Word documents, and images (JPEG/PNG/WebP) are allowed"));
  },
});

function uploadToCloudinary(buffer: Buffer, options: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

// Helper: generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100) + "-" + Date.now().toString(36);
}

// ── Public: Get teacher profile by slug ──────────────────────────
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Check if slug is a numeric ID
    const isId = /^\d+$/.test(slug);
    const condition = isId 
      ? eq(usersTable.id, parseInt(slug))
      : eq(usersTable.profileSlug, slug);

    const [teacher] = await db.select().from(usersTable)
      .where(and(condition, eq(usersTable.role, "teacher")))
      .limit(1);

    if (!teacher) {
      res.status(404).json({ error: "Teacher not found" });
      return;
    }

    // Track profile view
    await db.insert(profileAnalyticsTable).values({
      teacherId: teacher.id,
      eventType: "profile_view",
      referer: req.headers.referer || null,
    });

    // Get courses
    const courses = await db.select().from(coursesTable)
      .where(and(eq(coursesTable.teacherId, teacher.id), eq(coursesTable.isPublished, true)))
      .orderBy(desc(coursesTable.createdAt));

    // Get stats
    const [courseCount] = await db.select({ total: count() }).from(coursesTable)
      .where(and(eq(coursesTable.teacherId, teacher.id), eq(coursesTable.isPublished, true)));
    const [studentCount] = await db.select({ total: count() }).from(enrollmentsTable)
      .where(sql`${enrollmentsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacher.id})`);
    const [reviewData] = await db.select({ avg: avg(reviewsTable.rating), cnt: count() }).from(reviewsTable)
      .where(sql`${reviewsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacher.id})`);

    // Get endorsements
    const endorsements = await db.select({
      trait: studentEndorsementsTable.trait,
      count: count(),
    }).from(studentEndorsementsTable)
      .where(eq(studentEndorsementsTable.teacherId, teacher.id))
      .groupBy(studentEndorsementsTable.trait);

    // Get recent student reviews
    const recentReviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
      user: {
        id: usersTable.id,
        fullName: usersTable.fullName,
        fullNameAr: usersTable.fullNameAr,
        avatarUrl: usersTable.avatarUrl,
      }
    }).from(reviewsTable)
      .innerJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
      .where(sql`${reviewsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacher.id})`)
      .orderBy(desc(reviewsTable.createdAt))
      .limit(10);

    res.json({
      id: teacher.id,
      fullName: teacher.fullName,
      fullNameAr: teacher.fullNameAr,
      bio: teacher.bio,
      bioAr: teacher.bioAr,
      expertise: teacher.expertise,
      avatarUrl: teacher.avatarUrl,
      cvUrl: teacher.cvUrl,
      isVerified: teacher.isVerified,
      isTutoringEnabled: teacher.isTutoringEnabled,
      tutoringHourlyRate: parseFloat(teacher.tutoringHourlyRate || "0"),
      tier: teacher.tier,
      isSponsored: teacher.isSponsored,
      profileSlug: teacher.profileSlug,
      courseCount: Number(courseCount.total),
      studentCount: Number(studentCount.total),
      rating: parseFloat(reviewData.avg || "0"),
      reviewCount: Number(reviewData.cnt),
      endorsements,
      reviews: recentReviews,
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        titleAr: c.titleAr,
        description: c.description,
        descriptionAr: c.descriptionAr,
        thumbnailUrl: c.thumbnailUrl,
        price: parseFloat(c.price),
        level: c.level,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Update own profile ──────────────────────────────────
router.put("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { bio, bioAr, expertise, fullNameAr } = req.body;

    // Auto-generate slug if not existing
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    let slug = existing?.profileSlug;
    if (!slug) {
      slug = generateSlug(existing?.fullName || "teacher");
    }

    await db.update(usersTable).set({
      bio, bioAr, expertise, fullNameAr,
      profileSlug: slug,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    res.json({ success: true, profileSlug: slug });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Upload CV ───────────────────────────────────────────
router.post("/cv", requireAuth, requireRole("teacher", "admin"), docUpload.single("cv"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    const { userId } = (req as any).user;
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: "raw",
      folder: "libyan-learn-hub/cvs",
    });
    await db.update(usersTable).set({ cvUrl: result.secure_url, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true, cvUrl: result.secure_url });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Face capture (selfie for verification) ──────────────
router.post("/face-capture", requireAuth, requireRole("teacher", "admin"), imageUpload.single("photo"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No photo provided" }); return; }
    const { userId } = (req as any).user;
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: "image",
      folder: "libyan-learn-hub/face-verification",
      access_mode: "authenticated",
    });
    await db.update(usersTable).set({ facePhotoUrl: result.secure_url, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Voice sample upload ─────────────────────────────────
const audioUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/wav", "audio/webm", "audio/ogg", "audio/mp4"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only audio files are allowed"));
  },
});

router.post("/voice-sample", requireAuth, requireRole("teacher", "admin"), audioUpload.single("audio"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No audio provided" }); return; }
    const { userId } = (req as any).user;
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: "video",
      folder: "libyan-learn-hub/voice-samples",
      access_mode: "authenticated",
    });
    await db.update(usersTable).set({ voiceSampleUrl: result.secure_url, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Agree to copyright declaration ──────────────────────
router.post("/copyright-agree", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    await db.update(usersTable).set({ copyrightAgreedAt: new Date(), updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Upload academic qualification (required) ────────────────────────
router.post("/qualification", requireAuth, requireRole("teacher", "admin"),
  docUpload.single("qualification"),
  async (req, res): Promise<any> => {
    try {
      const { userId } = (req as any).user;
      if (!req.file) return res.status(400).json({ error: "Qualification file is required" });

      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "teacher-qualifications",
        resource_type: "raw",
        public_id: `qualification-${userId}-${Date.now()}`,
      });

      await db.update(usersTable).set({
        qualificationUrl: result.secure_url,
        updatedAt: new Date(),
      }).where(eq(usersTable.id, userId));

      res.json({ success: true, url: result.secure_url });
    } catch (err: any) {
      res.status(500).json({ error: "Upload failed", message: err.message });
    }
  }
);

// ── Teacher: Upload experience letter (optional) ──────────────────────────────
router.post("/experience-letter", requireAuth, requireRole("teacher", "admin"),
  docUpload.single("experienceLetter"),
  async (req, res): Promise<any> => {
    try {
      const { userId } = (req as any).user;
      if (!req.file) return res.status(400).json({ error: "File is required" });

      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "teacher-experience-letters",
        resource_type: "raw",
        public_id: `experience-${userId}-${Date.now()}`,
      });

      await db.update(usersTable).set({
        experienceLetterUrl: result.secure_url,
        updatedAt: new Date(),
      }).where(eq(usersTable.id, userId));

      res.json({ success: true, url: result.secure_url });
    } catch (err: any) {
      res.status(500).json({ error: "Upload failed", message: err.message });
    }
  }
);

// ── Teacher: Complete onboarding → set pending_review ────────────────────────
router.post("/complete-onboarding", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!teacher) { res.status(404).json({ error: "User not found" }); return; }
    if (!teacher.copyrightAgreedAt) { res.status(400).json({ error: "Copyright agreement required" }); return; }
    if (!teacher.facePhotoUrl) { res.status(400).json({ error: "Face photo required" }); return; }
    if (!teacher.qualificationUrl) { res.status(400).json({ error: "Academic qualification document is required" }); return; }
    if (!teacher.cvUrl) { res.status(400).json({ error: "CV is required" }); return; }

    // Auto-generate slug if not existing
    let slug = teacher.profileSlug;
    if (!slug) slug = generateSlug(teacher.fullName);

    await db.update(usersTable).set({
      onboardingCompleted: true,
      teacherApprovalStatus: "pending_review",
      teacherRejectionReason: null,
      profileSlug: slug,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    // Notify all admins by email
    const admins = await db
      .select({ email: usersTable.email, fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    const appUrl = process.env.APP_URL || "https://eduonline.net.ly";
    for (const admin of admins) {
      sendEmail({
        to: admin.email,
        subject: `👩‍🏫 طلب معلم جديد بانتظار المراجعة | New teacher awaiting approval`,
        text: `A new teacher registration is pending review.\n\nName: ${teacher.fullName}\nEmail: ${teacher.email}\n\nReview here: ${appUrl}/admin/dashboard`,
        html: `<p>New teacher <strong>${teacher.fullName}</strong> (${teacher.email}) has submitted their registration and is awaiting your approval.</p><p><a href="${appUrl}/admin/dashboard">Review now →</a></p>`,
      }).catch((e) => console.error("Admin notification email failed:", e));
    }

    res.json({ success: true, status: "pending_review", profileSlug: slug });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: List teachers pending approval ─────────────────────────────────────
router.get("/approvals", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const teachers = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
        cvUrl: usersTable.cvUrl,
        qualificationUrl: usersTable.qualificationUrl,
        experienceLetterUrl: usersTable.experienceLetterUrl,
        teacherApprovalStatus: usersTable.teacherApprovalStatus,
        teacherRejectionReason: usersTable.teacherRejectionReason,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(and(
        eq(usersTable.role, "teacher"),
        eq(usersTable.teacherApprovalStatus, "pending_review"),
      ));
    res.json(teachers);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: Approve a teacher ──────────────────────────────────────────────────
router.post("/approvals/:teacherId/approve", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const teacherId = parseParam(req.params.teacherId);
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
    if (!teacher || teacher.role !== "teacher") {
      res.status(404).json({ error: "Teacher not found" }); return;
    }

    await db.update(usersTable).set({
      teacherApprovalStatus: "approved",
      teacherRejectionReason: null,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, teacherId));

    // Send approval email
    const email = buildTeacherApprovedEmail({ teacherName: teacher.fullName, teacherEmail: teacher.email });
    sendEmail({ to: teacher.email, ...email }).catch((e) => console.error("Approval email failed:", e));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: Reject a teacher ───────────────────────────────────────────────────
router.post("/approvals/:teacherId/reject", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const teacherId = parseParam(req.params.teacherId);
    const { reason } = req.body;
    if (!reason?.trim()) { res.status(400).json({ error: "Rejection reason is required" }); return; }

    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
    if (!teacher || teacher.role !== "teacher") {
      res.status(404).json({ error: "Teacher not found" }); return;
    }

    await db.update(usersTable).set({
      teacherApprovalStatus: "rejected",
      teacherRejectionReason: reason.trim(),
      // Reset onboarding so teacher must resubmit all docs
      onboardingCompleted: false,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, teacherId));

    // Send rejection email
    const email = buildTeacherRejectedEmail({ teacherName: teacher.fullName, reason: reason.trim() });
    sendEmail({ to: teacher.email, ...email }).catch((e) => console.error("Rejection email failed:", e));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Student: Endorse a teacher ───────────────────────────────────
router.post("/endorse/:teacherId", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const teacherId = parseParam(req.params.teacherId);
    const { trait } = req.body;
    if (!trait) { res.status(400).json({ error: "Trait is required" }); return; }

    // Check if student has enrolled in any of this teacher's courses
    const enrolled = await db.select().from(enrollmentsTable)
      .where(sql`${enrollmentsTable.userId} = ${userId} AND ${enrollmentsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacherId})`);
    if (enrolled.length === 0) {
      res.status(403).json({ error: "You must complete a course with this teacher to endorse them" });
      return;
    }

    // Check for duplicate endorsement
    const [existing] = await db.select().from(studentEndorsementsTable)
      .where(and(
        eq(studentEndorsementsTable.studentId, userId),
        eq(studentEndorsementsTable.teacherId, teacherId),
        eq(studentEndorsementsTable.trait, trait),
      )).limit(1);
    if (existing) {
      res.status(409).json({ error: "You have already endorsed this teacher for this trait" });
      return;
    }

    await db.insert(studentEndorsementsTable).values({ studentId: userId, teacherId, trait });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Analytics: track event ───────────────────────────────────────
router.post("/analytics/event", async (req, res) => {
  try {
    const { teacherId, eventType, referer } = req.body;
    if (!teacherId || !eventType) { res.status(400).json({ error: "teacherId and eventType are required" }); return; }
    await db.insert(profileAnalyticsTable).values({ teacherId, eventType, referer });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Get own analytics summary ───────────────────────────
router.get("/analytics/summary", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const stats = await db.select({
      eventType: profileAnalyticsTable.eventType,
      count: count(),
    }).from(profileAnalyticsTable)
      .where(eq(profileAnalyticsTable.teacherId, userId))
      .groupBy(profileAnalyticsTable.eventType);

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Upgrade to Pro (Placeholder for future payment flow) ───
router.post("/upgrade-pro", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    
    // For now, immediately upgrade to Pro for 30 days
    const proExpiry = new Date();
    proExpiry.setDate(proExpiry.getDate() + 30);
    
    await db.update(usersTable).set({ 
      tier: "diamond", 
      proExpiry, 
      updatedAt: new Date() 
    }).where(eq(usersTable.id, userId));
    
    res.json({ success: true, message: "Upgraded to Pro successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
