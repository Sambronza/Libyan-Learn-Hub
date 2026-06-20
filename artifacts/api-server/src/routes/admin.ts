import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, coursesTable, paymentsTable, enrollmentsTable,
  teacherEarningsTable, liveSessionsTable, categoriesTable, lessonsTable,
  platformSettingsTable, redeemCardsTable, withdrawalRequestsTable, notificationsTable,
  tutoringRequestsTable
} from "@workspace/db";
import { eq, count, sql, sum, desc, and, ne, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { deleteFromCloudinaryByUrl } from "../lib/cloudinary.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

// ─── STATS ────────────────────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  try {
    const [userCount] = await db.select({ total: count() }).from(usersTable);
    const [teacherCount] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.role, "teacher"));
    const [studentCount] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.role, "student"));
    const [courseCount] = await db.select({ total: count() }).from(coursesTable);
    const [publishedCount] = await db.select({ total: count() }).from(coursesTable).where(eq(coursesTable.isPublished, true));
    const [enrollCount] = await db.select({ total: count() }).from(enrollmentsTable);
    const [sessionCount] = await db.select({ total: count() }).from(liveSessionsTable);

    const [revenueData] = await db.select({
      totalRevenue: sql`COALESCE(SUM(CAST(${paymentsTable.amount} AS NUMERIC)), 0)`,
    }).from(paymentsTable).where(eq(paymentsTable.status, "completed"));

    const [pendingCount] = await db.select({ total: count() }).from(paymentsTable).where(eq(paymentsTable.status, "pending"));

    const [platformFees] = await db.select({
      total: sql`COALESCE(SUM(CAST(${teacherEarningsTable.platformFee} AS NUMERIC)), 0)`,
    }).from(teacherEarningsTable);

    const [pendingEarnings] = await db.select({
      total: sql`COALESCE(SUM(CAST(${teacherEarningsTable.netAmount} AS NUMERIC)), 0)`,
    }).from(teacherEarningsTable).where(eq(teacherEarningsTable.status, "available"));

    res.json({
      totalUsers: Number(userCount.total),
      totalTeachers: Number(teacherCount.total),
      totalStudents: Number(studentCount.total),
      totalCourses: Number(courseCount.total),
      publishedCourses: Number(publishedCount.total),
      totalEnrollments: Number(enrollCount.total),
      totalSessions: Number(sessionCount.total),
      totalRevenue: parseFloat(revenueData.totalRevenue as string),
      platformFees: parseFloat(platformFees.total as string),
      pendingPayments: Number(pendingCount.total),
      pendingEarnings: parseFloat(pendingEarnings.total as string),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

router.get("/settings", async (_req, res) => {
  try {
    const settings = await db.select().from(platformSettingsTable);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({ error: "Key and value are required" });
      return;
    }
    
    // Upsert logic using delete then insert, or just select and update
    const existing = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
    
    let updated;
    if (existing.length > 0) {
      [updated] = await db.update(platformSettingsTable)
        .set({ value, description: description || existing[0].description, updatedAt: new Date() })
        .where(eq(platformSettingsTable.key, key))
        .returning();
    } else {
      [updated] = await db.insert(platformSettingsTable)
        .values({ key, value, description })
        .returning();
    }
    res.json({ success: true, setting: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── USERS ────────────────────────────────────────────────────────────────────

router.get("/users", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    const result = await Promise.all(users.map(async (u) => {
      let extra: any = {};
      if (u.role === "teacher") {
        const [cc] = await db.select({ total: count() }).from(coursesTable).where(eq(coursesTable.teacherId, u.id));
        const [ec] = await db.select({ total: count() }).from(enrollmentsTable)
          .where(sql`${enrollmentsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${u.id})`);
        extra = { courseCount: Number(cc.total), studentCount: Number(ec.total) };
      } else if (u.role === "student") {
        const [ec] = await db.select({ total: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.userId, u.id));
        extra = { enrollmentCount: Number(ec.total) };
      }
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        phoneNumber: u.phoneNumber,
        phoneVerified: u.phoneVerified,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        ...extra,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/users/:userId/verify", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { isVerified } = req.body;
    const [updated] = await db.update(usersTable)
      .set({ isVerified: !!isVerified, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ success: true, isVerified: updated.isVerified });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/users/:userId/role", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { role } = req.body;
    const { userId: adminId } = (req as any).user;

    if (userId === adminId) {
      res.status(400).json({ error: "Cannot change your own role. Please ask another administrator to do this if needed." });
      return;
    }

    if (!["student", "teacher", "admin"].includes(role)) {
      res.status(400).json({ error: "Invalid role" }); return;
    }
    const [updated] = await db.update(usersTable)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ success: true, user: { id: updated.id, role: updated.role } });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.delete("/users/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { userId: adminId } = (req as any).user;
    if (userId === adminId) { res.status(400).json({ error: "Cannot delete yourself" }); return; }
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/users/create", async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "Email already registered" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email, passwordHash, fullName, role: role as any, language: "ar",
    }).returning();
    res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, createdAt: user.createdAt });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create user", message: err.message });
  }
});

// ─── COURSES ─────────────────────────────────────────────────────────────────

router.get("/courses", async (req, res) => {
  try {
    const { status } = req.query as any;
    const courses = status === "pending_review"
      ? await db.select().from(coursesTable).where(eq(coursesTable.status, "pending_review")).orderBy(desc(coursesTable.createdAt))
      : await db.select().from(coursesTable).orderBy(desc(coursesTable.createdAt));
    const result = await Promise.all(courses.map(async (c) => {
      const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, c.teacherId)).limit(1);
      const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, c.categoryId)).limit(1);
      const [enroll] = await db.select({ total: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, c.id));
      const [lessons] = await db.select({ total: count() }).from(lessonsTable).where(eq(lessonsTable.courseId, c.id));
      return {
        id: c.id,
        title: c.title,
        titleAr: c.titleAr,
        price: parseFloat(c.price),
        currency: c.currency,
        level: c.level,
        language: c.language,
        isPublished: c.isPublished,
        teacherId: c.teacherId,
        teacherName: teacher?.fullName || "Unknown",
        teacherEmail: teacher?.email || "",
        categoryName: cat?.name || "Uncategorized",
        enrollmentCount: Number(enroll.total),
        lessonCount: Number(lessons.total),
        revenue: parseFloat(c.price) * Number(enroll.total),
        status: c.status,
        rejectionReason: c.rejectionReason,
        submittedAt: c.submittedAt,
        createdAt: c.createdAt,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/courses/:courseId/publish", async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const { isPublished } = req.body; // kept for backward compatibility if true
    const adminId = (req as any).user.userId;

    const [updated] = await db.update(coursesTable)
      .set({ 
        isPublished: true, 
        status: "published",
        reviewedAt: new Date(),
        reviewedBy: adminId,
        updatedAt: new Date() 
      })
      .where(eq(coursesTable.id, courseId))
      .returning();
      
    if (!updated) { res.status(404).json({ error: "Course not found" }); return; }

    // Notify teacher
    await db.insert(notificationsTable).values({
      userId: updated.teacherId,
      type: "course_approved" as any,
      title: "Course Approved",
      titleAr: "تم الموافقة على الدورة",
      message: `Your course "${updated.title}" was approved and is now live.`,
      messageAr: `تم الموافقة على دورتك "${updated.titleAr}" وهي الآن متاحة للطلاب.`,
      referenceId: updated.id,
    });

    res.json({ success: true, isPublished: updated.isPublished, status: updated.status });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/courses/:courseId/reject", async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const { rejectionReason } = req.body;
    const adminId = (req as any).user.userId;

    if (!rejectionReason || rejectionReason.length < 20) {
      res.status(400).json({ error: "A rejection reason of at least 20 characters is required" });
      return;
    }

    const [updated] = await db.update(coursesTable)
      .set({ 
        isPublished: false, 
        status: "rejected",
        rejectionReason,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        updatedAt: new Date() 
      })
      .where(eq(coursesTable.id, courseId))
      .returning();
      
    if (!updated) { res.status(404).json({ error: "Course not found" }); return; }

    // Notify teacher
    await db.insert(notificationsTable).values({
      userId: updated.teacherId,
      type: "course_rejected" as any,
      title: "Course Update",
      titleAr: "تحديث حول دورتك",
      message: `Your course "${updated.title}" requires revisions before publishing.`,
      messageAr: `تتطلب دورتك "${updated.titleAr}" بعض التعديلات قبل النشر.`,
      referenceId: updated.id,
    });

    res.json({ success: true, status: updated.status, rejectionReason: updated.rejectionReason });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.delete("/courses/:courseId", async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    
    // Fetch course and lessons to delete from Cloudinary
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (course && course.thumbnailUrl) {
      await deleteFromCloudinaryByUrl(course.thumbnailUrl);
    }
    
    const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.courseId, courseId));
    for (const lesson of lessons) {
      if (lesson.videoUrl) await deleteFromCloudinaryByUrl(lesson.videoUrl);
      if (lesson.videoFilePath) await deleteFromCloudinaryByUrl(lesson.videoFilePath);
      if (lesson.documentFilePath) await deleteFromCloudinaryByUrl(lesson.documentFilePath);
    }

    await db.delete(coursesTable).where(eq(coursesTable.id, courseId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

router.get("/payments", async (req, res) => {
  try {
    const { status } = req.query as any;
    let payments = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt));
    if (status && status !== "all") {
      payments = payments.filter(p => p.status === status);
    }
    const result = await Promise.all(payments.map(async (p) => {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      let itemName = "–";
      if (p.courseId) {
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, p.courseId)).limit(1);
        itemName = course?.title || `Course #${p.courseId}`;
      } else if (p.sessionId) {
        const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, p.sessionId)).limit(1);
        itemName = session?.title || `Session #${p.sessionId}`;
      }
      return {
        id: p.id,
        userId: p.userId,
        studentName: student?.fullName || "Unknown",
        studentEmail: student?.email || "",
        courseId: p.courseId,
        sessionId: p.sessionId,
        itemName,
        amount: parseFloat(p.amount),
        currency: p.currency,
        method: p.method,
        status: p.status,
        reference: p.reference,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/payments/pending", async (_req, res) => {
  try {
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "pending"));
    const result = await Promise.all(payments.map(async (p) => {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      let itemName = "–";
      if (p.courseId) {
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, p.courseId)).limit(1);
        itemName = course?.title || `Course #${p.courseId}`;
      }
      return {
        id: p.id,
        userId: p.userId,
        studentName: student?.fullName || "Unknown",
        studentEmail: student?.email || "",
        itemName,
        amount: parseFloat(p.amount),
        currency: p.currency,
        status: p.status,
        reference: p.reference,
        createdAt: p.createdAt,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/payments/:paymentId/approve", async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).limit(1);
    if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
    if (payment.status !== "pending") { res.status(400).json({ error: `Payment is already ${payment.status}` }); return; }

    await db.update(paymentsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(paymentsTable.id, paymentId));

    const amount = parseFloat(payment.amount);
    let platformFeePercent = 20; // Default
    try {
      const [setting] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "teacher_commission_percent")).limit(1);
      if (setting && setting.value) {
        const parsed = parseFloat(setting.value);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          platformFeePercent = parsed;
        }
      }
    } catch (err) {}
    
    const platformFee = parseFloat((amount * platformFeePercent / 100).toFixed(2));
    const netAmount = parseFloat((amount - platformFee).toFixed(2));

    if (payment.courseId) {
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      const alreadyEnrolled = await db.select().from(enrollmentsTable)
        .where(and(eq(enrollmentsTable.courseId, payment.courseId), eq(enrollmentsTable.userId, payment.userId))).limit(1);
      if (alreadyEnrolled.length === 0) {
        await db.insert(enrollmentsTable).values({ courseId: payment.courseId, userId: payment.userId, progress: "0" });
      }
      if (course) {
        await db.transaction(async (tx) => {
          await tx.insert(teacherEarningsTable).values({
            teacherId: course.teacherId, paymentId,
            courseId: course.id,
            grossAmount: amount.toFixed(2),
            platformFeePercent: platformFeePercent.toFixed(2),
            platformFee: platformFee.toFixed(2),
            netAmount: netAmount.toFixed(2),
            currency: course.currency || "LYD",
            status: "available",
          });
          const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
          if (teacher) {
            const newBalance = (parseFloat(teacher.balance as string || "0") + netAmount);
            await tx.update(usersTable).set({ balance: newBalance.toFixed(2), updatedAt: new Date() }).where(eq(usersTable.id, course.teacherId));
          }
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/payments/:paymentId/reject", async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).limit(1);
    if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
    if (payment.status !== "pending") { res.status(400).json({ error: `Payment is already ${payment.status}` }); return; }
    await db.update(paymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(paymentsTable.id, paymentId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── FINANCE / EARNINGS ───────────────────────────────────────────────────────

router.get("/earnings", async (_req, res) => {
  try {
    const earnings = await db.select().from(teacherEarningsTable).orderBy(desc(teacherEarningsTable.createdAt));
    const result = await Promise.all(earnings.map(async (e) => {
      const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
      let itemName = "–";
      if (e.courseId) {
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1);
        itemName = course?.title || `Course #${e.courseId}`;
      } else if (e.sessionId) {
        const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, e.sessionId)).limit(1);
        itemName = session?.title || `Session #${e.sessionId}`;
      }
      return {
        id: e.id,
        teacherId: e.teacherId,
        teacherName: teacher?.fullName || "Unknown",
        teacherEmail: teacher?.email || "",
        paymentId: e.paymentId,
        itemName,
        gross: parseFloat(e.grossAmount),
        platformFee: parseFloat(e.platformFee),
        net: parseFloat(e.netAmount),
        currency: e.currency,
        status: e.status,
        createdAt: e.createdAt,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/earnings/:earningId/pay", async (req, res) => {
  try {
    const earningId = parseInt(req.params.earningId);
    await db.transaction(async (tx) => {
      const [earning] = await tx.select().from(teacherEarningsTable).where(eq(teacherEarningsTable.id, earningId)).limit(1);
      if (!earning) { throw new Error("Earning not found"); }
      if (earning.status !== "available") { throw new Error("Earning not available for payout"); }
      await tx.update(teacherEarningsTable).set({ status: "paid" }).where(eq(teacherEarningsTable.id, earningId));
      
      const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, earning.teacherId)).limit(1);
      if (teacher) {
        const currentBalance = parseFloat(teacher.balance as string || "0");
        const paidAmount = parseFloat(earning.netAmount as string);
        await tx.update(usersTable)
          .set({ balance: (currentBalance - paidAmount).toFixed(2), updatedAt: new Date() })
          .where(eq(usersTable.id, earning.teacherId));
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === "Earning not found") { res.status(404).json({ error: err.message }); return; }
    if (err.message === "Earning not available for payout") { res.status(400).json({ error: err.message }); return; }
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/earnings/pay-all/:teacherId", async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId);
    await db.transaction(async (tx) => {
      const earnings = await tx.select().from(teacherEarningsTable)
        .where(and(eq(teacherEarningsTable.teacherId, teacherId), eq(teacherEarningsTable.status, "available")));
      if (earnings.length === 0) return;
      
      const totalAmount = earnings.reduce((sum, e) => sum + parseFloat(e.netAmount as string), 0);
      await tx.update(teacherEarningsTable)
        .set({ status: "paid" })
        .where(and(eq(teacherEarningsTable.teacherId, teacherId), eq(teacherEarningsTable.status, "available")));
        
      const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
      if (teacher) {
        const currentBalance = parseFloat(teacher.balance as string || "0");
        await tx.update(usersTable)
          .set({ balance: (currentBalance - totalAmount).toFixed(2), updatedAt: new Date() })
          .where(eq(usersTable.id, teacherId));
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── REDEEM CARDS ─────────────────────────────────────────────────────────────

router.post("/redeem-cards/generate", async (req, res) => {
  try {
    // Accept both `count` (frontend) and `quantity` (legacy) for flexibility
    const { value, prefix = "LLH" } = req.body;
    const quantity = req.body.quantity || req.body.count;

    if (!quantity || !value || Number(quantity) <= 0 || Number(value) <= 0) {
      res.status(400).json({ error: "Invalid quantity or value" });
      return;
    }

    const cardsToInsert = [];
    for (let i = 0; i < Number(quantity); i++) {
      const randomStr = crypto.randomBytes(4).toString("hex").toUpperCase();
      const randomStr2 = crypto.randomBytes(4).toString("hex").toUpperCase();
      const code = `${prefix}-${randomStr}-${randomStr2}`;
      cardsToInsert.push({
        code,
        value: value.toString(),
        status: "active",
      });
    }

    const inserted = await db.insert(redeemCardsTable).values(cardsToInsert).returning();
    res.json({ success: true, count: inserted.length, cards: inserted });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/redeem-cards", async (_req, res) => {
  try {
    const cards = await db.select().from(redeemCardsTable).orderBy(desc(redeemCardsTable.createdAt));
    const result = await Promise.all(cards.map(async (c) => {
      let studentEmail = null;
      if (c.redeemedBy) {
        const [student] = await db.select().from(usersTable).where(eq(usersTable.id, c.redeemedBy)).limit(1);
        studentEmail = student?.email;
      }
      return {
        ...c,
        value: parseFloat(c.value as string),
        studentEmail,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/redeem-cards/:id/deactivate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(redeemCardsTable)
      .set({ status: "deactivated", deactivatedAt: new Date() })
      .where(and(eq(redeemCardsTable.id, id), eq(redeemCardsTable.status, "active")))
      .returning();
    
    if (!updated) {
      res.status(400).json({ error: "Card not found or not active" });
      return;
    }
    res.json({ success: true, card: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── WITHDRAWAL REQUESTS ──────────────────────────────────────────────────────

router.get("/withdrawals", async (req, res) => {
  try {
    const withdrawals = await db.select().from(withdrawalRequestsTable).orderBy(desc(withdrawalRequestsTable.createdAt));
    const result = await Promise.all(withdrawals.map(async (w) => {
      const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, w.teacherId)).limit(1);
      return {
        ...w,
        amount: parseFloat(w.amount as string),
        teacherName: teacher?.fullName || "Unknown",
        teacherEmail: teacher?.email || "",
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/withdrawals/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, adminNotes } = req.body;

    if (!["approved", "rejected", "paid"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const [request] = await db.select().from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.id, id)).limit(1);
    if (!request) {
      res.status(404).json({ error: "Withdrawal request not found" });
      return;
    }

    // Perform the status update + balance deduction atomically to prevent race conditions
    let updated: any;
    await db.transaction(async (tx) => {
      // Re-read inside transaction to prevent double-processing
      const [fresh] = await tx.select().from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.id, id)).limit(1);
      if (!fresh) throw new Error("Withdrawal request not found");

      // Only deduct balance once, when transitioning from 'pending'
      const wasAlreadyProcessed = fresh.status !== "pending";

      const [upd] = await tx.update(withdrawalRequestsTable)
        .set({
          status,
          adminNotes: adminNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(withdrawalRequestsTable.id, id))
        .returning();
      updated = upd;

      if ((status === "approved" || status === "paid") && !wasAlreadyProcessed) {
        let amountToCover = parseFloat(updated.amount as string);
        
        // Deduct from teacher's overall balance
        const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, updated.teacherId)).limit(1);
        if (teacher) {
          const currentBalance = parseFloat(teacher.balance as string || "0");
          await tx.update(usersTable)
            .set({ balance: (currentBalance - amountToCover).toFixed(2), updatedAt: new Date() })
            .where(eq(usersTable.id, updated.teacherId));
        }

        const earnings = await tx.select().from(teacherEarningsTable)
          .where(and(eq(teacherEarningsTable.teacherId, updated.teacherId), eq(teacherEarningsTable.status, "available")))
          .orderBy(teacherEarningsTable.createdAt);

        for (const earning of earnings) {
          if (amountToCover <= 0.001) break;
          const netAmount = parseFloat(earning.netAmount as string);
          await tx.update(teacherEarningsTable).set({ status: "paid" }).where(eq(teacherEarningsTable.id, earning.id));
          amountToCover -= netAmount;
          
          if (amountToCover < -0.001) {
             const refundAmount = Math.abs(amountToCover);
             await tx.insert(teacherEarningsTable).values({
               teacherId: updated.teacherId,
               paymentId: earning.paymentId,
               courseId: earning.courseId,
               sessionId: earning.sessionId,
               grossAmount: refundAmount.toFixed(2),
               platformFeePercent: "0.00",
               platformFee: "0.00",
               netAmount: refundAmount.toFixed(2),
               currency: earning.currency,
               status: "available"
             });
             // Add the refunded fragment back to the balance
             const [updatedTeacher] = await tx.select().from(usersTable).where(eq(usersTable.id, updated.teacherId)).limit(1);
             if (updatedTeacher) {
               const newBalance = parseFloat(updatedTeacher.balance as string || "0");
               await tx.update(usersTable)
                 .set({ balance: (newBalance + refundAmount).toFixed(2), updatedAt: new Date() })
                 .where(eq(usersTable.id, updated.teacherId));
             }
             break;
          }
        }
      }
    });

    res.json({ success: true, withdrawal: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});
// ─── TUTORING REVIEWS ───────────────────────────────────────────────────────────

router.get("/tutoring-reviews", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };

    const reviewStatuses = ["completed_pending_review", "cancelled_no_show", "approved", "rejected", "partially_approved"] as const;

    let whereClause;
    if (!status || status === "all") {
      whereClause = or(
        ...reviewStatuses.map(s => eq(tutoringRequestsTable.status, s as any))
      );
    } else {
      whereClause = eq(tutoringRequestsTable.status, status as any);
    }

    const requests = await db.select().from(tutoringRequestsTable)
      .where(whereClause)
      .orderBy(desc(tutoringRequestsTable.updatedAt));

    const result = await Promise.all(requests.map(async (r) => {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.id, r.studentId)).limit(1);
      const [teacher] = r.teacherId ? await db.select().from(usersTable).where(eq(usersTable.id, r.teacherId)).limit(1) : [null];
      return {
        ...r,
        hourlyRate: parseFloat(r.hourlyRate),
        totalAmount: parseFloat(r.totalAmount),
        studentName: student?.fullName,
        studentEmail: student?.email,
        teacherName: teacher?.fullName,
        teacherEmail: teacher?.email,
      };
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/tutoring-reviews/:id/approve", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { adminReview } = req.body;

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "completed_pending_review" && request.status !== "cancelled_no_show") {
      res.status(400).json({ error: "Only pending or no-show sessions can be approved" }); return;
    }

    await db.transaction(async (tx) => {
      await tx.update(tutoringRequestsTable)
        .set({ status: "approved", adminReview: adminReview || null, recordingUrl: null, updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      await tx.update(paymentsTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(paymentsTable.tutoringRequestId, requestId));

      // Pay teacher
      if (request.teacherId) {
        const platformFeePercent = 10;
        const platformFee = parseFloat(request.totalAmount) * (platformFeePercent / 100);
        const teacherPayout = parseFloat(request.totalAmount) - platformFee;
        
        await tx.insert(teacherEarningsTable).values({
          teacherId: request.teacherId,
          paymentId: 0,
          tutoringRequestId: request.id,
          grossAmount: parseFloat(request.totalAmount).toFixed(2),
          platformFeePercent: platformFeePercent.toFixed(2),
          platformFee: platformFee.toFixed(2),
          netAmount: teacherPayout.toFixed(2),
          currency: "LYD",
          status: "available",
        });

        await tx.update(usersTable)
          .set({ balance: sql`${usersTable.balance} + ${teacherPayout}` })
          .where(eq(usersTable.id, request.teacherId));
      }
    });

    if (request.recordingUrl) {
      await deleteFromCloudinaryByUrl(request.recordingUrl).catch(console.error);
    }

    res.json({ success: true, status: "approved" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/tutoring-reviews/:id/reject", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { adminReview } = req.body;

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "completed_pending_review" && request.status !== "cancelled_no_show") {
      res.status(400).json({ error: "Only pending or no-show sessions can be rejected" }); return;
    }

    await db.transaction(async (tx) => {
      await tx.update(tutoringRequestsTable)
        .set({ status: "rejected", adminReview: adminReview || null, recordingUrl: null, updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      await tx.update(paymentsTable)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(paymentsTable.tutoringRequestId, requestId));

      // Refund student in full
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${parseFloat(request.totalAmount)}` })
        .where(eq(usersTable.id, request.studentId));
    });

    if (request.recordingUrl) {
      await deleteFromCloudinaryByUrl(request.recordingUrl).catch(console.error);
    }

    res.json({ success: true, status: "rejected" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/tutoring-reviews/:id/partial-approve", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { teacherAmount, adminReview } = req.body;

    if (teacherAmount === undefined || isNaN(parseFloat(teacherAmount)) || parseFloat(teacherAmount) < 0) {
      res.status(400).json({ error: "Valid teacherAmount is required" }); return;
    }

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "completed_pending_review" && request.status !== "cancelled_no_show") {
      res.status(400).json({ error: "Only pending or no-show sessions can be partially approved" }); return;
    }

    const total = parseFloat(request.totalAmount);
    const approvedTeacherAmount = parseFloat(teacherAmount);

    if (approvedTeacherAmount > total) {
      res.status(400).json({ error: "Teacher amount cannot exceed total session amount" }); return;
    }

    const refundAmount = total - approvedTeacherAmount;

    await db.transaction(async (tx) => {
      await tx.update(tutoringRequestsTable)
        .set({ status: "partially_approved", adminReview: adminReview || null, recordingUrl: null, updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      await tx.update(paymentsTable)
        .set({ status: "completed", notes: `Partially refunded: ${refundAmount}`, updatedAt: new Date() })
        .where(eq(paymentsTable.tutoringRequestId, requestId));

      // Pay teacher part
      if (request.teacherId && approvedTeacherAmount > 0) {
        const platformFeePercent = 10;
        const platformFee = approvedTeacherAmount * (platformFeePercent / 100);
        const teacherPayout = approvedTeacherAmount - platformFee;
        
        await tx.insert(teacherEarningsTable).values({
          teacherId: request.teacherId,
          paymentId: 0,
          tutoringRequestId: request.id,
          grossAmount: approvedTeacherAmount.toFixed(2),
          platformFeePercent: platformFeePercent.toFixed(2),
          platformFee: platformFee.toFixed(2),
          netAmount: teacherPayout.toFixed(2),
          currency: "LYD",
          status: "available",
        });

        await tx.update(usersTable)
          .set({ balance: sql`${usersTable.balance} + ${teacherPayout}` })
          .where(eq(usersTable.id, request.teacherId));
      }

      // Refund student part
      if (refundAmount > 0) {
        await tx.update(usersTable)
          .set({ balance: sql`${usersTable.balance} + ${refundAmount}` })
          .where(eq(usersTable.id, request.studentId));
      }
    });

    if (request.recordingUrl) {
      await deleteFromCloudinaryByUrl(request.recordingUrl).catch(console.error);
    }

    res.json({ success: true, status: "partially_approved" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
