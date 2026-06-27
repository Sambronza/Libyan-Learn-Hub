import { Router } from "express";
import { db } from "@workspace/db";
import { tutoringRequestsTable, usersTable, paymentsTable, teacherEarningsTable, reportsTable } from "@workspace/db";
import { eq, and, desc, isNull, or, sql, lt, inArray, like } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";
import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";
import multer from "multer";
import { uploadToCloudinary } from "../lib/cloudinary.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Grade-level minimum hourly rates (LYD/hour) ─────────────────────────────
export const GRADE_LEVEL_RATES_INTL: Record<string, number> = {
  grade_1_6:   70,
  grade_7:    100,
  grade_8:    100,
  grade_9:    100,
  grade_10:   150,
  grade_11:   150,
  grade_12:   150,
  university:  150,
};

export const GRADE_LEVEL_RATES_LOCAL: Record<string, number> = {
  grade_1_6:   30,
  grade_7:     50,
  grade_8:     50,
  grade_9:     70,
  grade_10:    60,
  grade_11:    60,
  grade_12:   100,
  university:  150,
};

/** Returns the minimum hourly rate for a given lecturer level and education type. */
export function getGradeRate(lecturerLevel?: string | null, educationType?: string | null): number {
  const table = educationType === "local" ? GRADE_LEVEL_RATES_LOCAL : GRADE_LEVEL_RATES_INTL;
  return table[lecturerLevel ?? ""] ?? 100;
}

// ─── List tutors (teachers with tutoring enabled) ────────────────────────────
router.get("/tutors", async (req, res) => {
  try {
    const { subject, level } = req.query;

    const conditions = [
      eq(usersTable.isTutoringEnabled, true)
    ];

    const tutors = await db.select().from(usersTable)
      .where(and(...conditions));
    res.json(tutors.map(t => ({
      id: t.id,
      fullName: t.fullName,
      bio: t.bio,
      expertise: t.expertise,
      avatarUrl: t.avatarUrl,
      tutoringHourlyRate: parseFloat(t.tutoringHourlyRate || "0"),
      tutoringSubjects: t.tutoringSubjects,
      tutoringLevels: t.tutoringLevels,
      isVerified: t.isVerified,
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/debug-tutors-raw", async (req, res) => {
  try {
    const allUsers = await db.select({
      id: usersTable.id,
      role: usersTable.role,
      isTutoringEnabled: usersTable.isTutoringEnabled,
      tutoringSuspendedUntil: usersTable.tutoringSuspendedUntil,
      tutoringSubjects: usersTable.tutoringSubjects,
      tutoringLevels: usersTable.tutoringLevels,
      fullName: usersTable.fullName
    }).from(usersTable);
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Register teacher for tutoring ───────────────────────────────────────────
router.post("/register", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    if (role !== "teacher" && role !== "admin") {
      res.status(403).json({ error: "Only teachers can register for tutoring" });
      return;
    }
    const { tutoringHourlyRate, tutoringSubjects, tutoringLevels, commissionAgreed } = req.body;
    
    if (!commissionAgreed) {
      res.status(400).json({ error: "You must agree to the 10% commission" });
      return;
    }
    
    const rate = parseFloat(tutoringHourlyRate);
    if (isNaN(rate) || rate < 0) {
      res.status(400).json({ error: "Hourly rate must be 0 or greater" });
      return;
    }

    const [updated] = await db.update(usersTable)
      .set({
        isTutoringEnabled: true,
        tutoringHourlyRate: rate.toFixed(2),
        tutoringSubjects: tutoringSubjects || null,
        tutoringLevels: tutoringLevels || null,
        commissionAgreed: true,
        updatedAt: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning();
    res.json({ success: true, isTutoringEnabled: updated.isTutoringEnabled });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Update teacher tutoring settings ────────────────────────────────────────
router.put("/settings", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    if (role !== "teacher" && role !== "admin") {
      res.status(403).json({ error: "Only teachers can update tutoring settings" });
      return;
    }
    const { isTutoringEnabled, tutoringHourlyRate, tutoringSubjects, tutoringLevels } = req.body;

    // Validate hourly rate
    if (tutoringHourlyRate != null) {
      const rate = parseFloat(tutoringHourlyRate);
      if (isNaN(rate) || rate < 0) {
        res.status(400).json({ error: "Hourly rate must be 0 or greater" });
        return;
      }
    }

    const [updated] = await db.update(usersTable)
      .set({
        isTutoringEnabled: !!isTutoringEnabled,
        tutoringHourlyRate: tutoringHourlyRate != null ? parseFloat(tutoringHourlyRate).toFixed(2) : "0.00",
        tutoringSubjects: tutoringSubjects || null,
        tutoringLevels: tutoringLevels || null,
        updatedAt: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning();
    res.json({ success: true, isTutoringEnabled: updated.isTutoringEnabled });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Get my tutoring requests (student or teacher) ───────────────────────────
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    let requests;

    if (role === "student") {
      // Students see their own requests
      requests = await db.select().from(tutoringRequestsTable)
        .where(eq(tutoringRequestsTable.studentId, userId))
        .orderBy(desc(tutoringRequestsTable.createdAt));
    } else {
      let teacherSubjects: string[] = [];
      let teacherLevels: string[] = [];
      if (role === "teacher") {
        const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (teacher && teacher.tutoringSubjects) {
          teacherSubjects = teacher.tutoringSubjects.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (teacher && teacher.tutoringLevels) {
          teacherLevels = teacher.tutoringLevels.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      let unassignedCondition;
      if (role === "admin") {
        unassignedCondition = and(
          isNull(tutoringRequestsTable.teacherId),
          eq(tutoringRequestsTable.status, "pending")
        );
      } else {
        if (teacherSubjects.length > 0) {
          if (teacherLevels.length > 0) {
            // New behaviour: filter by both subject AND level
            unassignedCondition = and(
              isNull(tutoringRequestsTable.teacherId),
              eq(tutoringRequestsTable.status, "pending"),
              inArray(tutoringRequestsTable.subject, teacherSubjects),
              inArray(tutoringRequestsTable.lecturerLevel, teacherLevels)
            );
          } else {
            // Legacy fallback: teacher hasn't set levels yet → filter by subject only
            unassignedCondition = and(
              isNull(tutoringRequestsTable.teacherId),
              eq(tutoringRequestsTable.status, "pending"),
              inArray(tutoringRequestsTable.subject, teacherSubjects)
            );
          }
        } else {
          unassignedCondition = sql`false`;
        }
      }

      // Teachers/admins see:
      //  • Requests explicitly assigned to them
      //  • Unassigned requests that match their subjects
      requests = await db.select().from(tutoringRequestsTable)
        .where(
          or(
            eq(tutoringRequestsTable.teacherId, userId),
            unassignedCondition
          )
        )
        .orderBy(desc(tutoringRequestsTable.createdAt));
    }

    const result = await Promise.all(requests.map(async (r) => {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.id, r.studentId)).limit(1);
      const [teacher] = r.teacherId
        ? await db.select().from(usersTable).where(eq(usersTable.id, r.teacherId)).limit(1)
        : [null];
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

// ─── Fetch a single tutoring request by ID ────────────────────────────────────
// Called by TutoringRoom.tsx before the PreJoin screen renders.
// Both the student AND the assigned teacher are authorised to fetch it.
router.get("/requests/:id", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    // Must be the student, the assigned teacher, or an admin
    const isParticipant = request.studentId === userId || request.teacherId === userId;
    if (!isParticipant && role !== "admin") {
      res.status(403).json({ error: "Not authorized to view this session" }); return;
    }

    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, request.studentId)).limit(1);
    const [teacher] = request.teacherId
      ? await db.select().from(usersTable).where(eq(usersTable.id, request.teacherId)).limit(1)
      : [null];

    res.json({
      ...request,
      hourlyRate: parseFloat(request.hourlyRate),
      totalAmount: parseFloat(request.totalAmount),
      studentName: student?.fullName,
      studentEmail: student?.email,
      teacherName: teacher?.fullName,
      teacherEmail: teacher?.email,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Student creates a tutoring request ──────────────────────────────────────
router.post("/requests", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    if (role !== "student") {
      res.status(403).json({ error: "Only students can create tutoring requests" });
      return;
    }

    const { teacherId, categoryId, lecturerLevel, educationType, isUrgent, subject, topic, preferredAt, durationMinutes, message, attachmentsUrl } = req.body;

    // Validate required fields
    if (!subject || !subject.trim()) {
      res.status(400).json({ error: "Subject is required" });
      return;
    }
    if (!preferredAt) {
      res.status(400).json({ error: "Preferred date & time is required" });
      return;
    }
    const preferredDate = new Date(preferredAt);
    if (isNaN(preferredDate.getTime())) {
      res.status(400).json({ error: "Invalid preferred date & time" });
      return;
    }
    if (preferredDate < new Date()) {
      res.status(400).json({ error: "Preferred date must be in the future" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const result = await db.transaction(async (tx) => {
      // Determine hourly rate
      let hourlyRate = "0.00";
      const resolvedTeacherId = isUrgent ? null : (teacherId ? parseInt(teacherId) : null);

      // Grade-level minimum rate acts as the floor for all requests
      const gradeMinRate = getGradeRate(lecturerLevel, educationType);

      if (resolvedTeacherId) {
        const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, resolvedTeacherId)).limit(1);
        if (!teacher) {
           throw new Error("Selected teacher not found");
        }
        if (teacher.tutoringSuspendedUntil && new Date(teacher.tutoringSuspendedUntil) > new Date()) {
           throw new Error("Selected teacher is currently suspended and cannot accept requests");
        }
        // Use the exact teacher rate as requested
        const teacherRate = parseFloat(teacher.tutoringHourlyRate || "0");
        hourlyRate = teacherRate.toFixed(2);
      } else {
        // Urgent / any-teacher: use grade-level minimum rate
        hourlyRate = gradeMinRate.toFixed(2);
      }

      const duration = parseInt(durationMinutes) || 60;
      const cost = parseFloat(((parseFloat(hourlyRate) * duration) / 60).toFixed(2));

      if (parseFloat(user.balance) < cost) {
        throw new Error(`Insufficient balance. ${cost.toFixed(2)} dinars required to reserve this session.`);
      }

      // Deduct balance
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} - ${cost}` })
        .where(eq(usersTable.id, userId));

      // Create tutoring request
      const [request] = await tx.insert(tutoringRequestsTable).values({
        studentId: userId,
        categoryId: categoryId || null,
        lecturerLevel: lecturerLevel || null,
        educationType: educationType || null,
        teacherId: resolvedTeacherId,
        isUrgent: !!isUrgent,
        subject: subject.trim(),
        topic: topic?.trim() || "",
        preferredAt: preferredDate,
        durationMinutes: parseInt(durationMinutes) || 60,
        message: message?.trim() || null,
        attachmentsUrl: attachmentsUrl || null,
        hourlyRate,
        totalAmount: cost.toString(),
        status: "pending",
        currency: "LYD",
      }).returning();

      // Create pending payment record
      await tx.insert(paymentsTable).values({
        userId,
        tutoringRequestId: request.id,
        amount: cost.toString(),
        method: "wallet",
        status: "pending",
        notes: `Tutoring request #${request.id} reservation`,
      });

      return request;
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.message.includes("Insufficient balance") || err.message.includes("suspended") || err.message.includes("not found")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Server error", message: err.message });
    }
  }
});

// ─── Teacher accepts a request ────────────────────────────────────────────────
// This handles:
//   1. Urgent requests (race — first teacher wins)
//   2. Non-urgent requests assigned to a specific teacher
//   3. Non-urgent "any teacher" requests (teacherId=null, isUrgent=false)
router.post("/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    if (role !== "teacher" && role !== "admin") {
      res.status(403).json({ error: "Only teachers can accept tutoring requests" });
      return;
    }

    const requestId = parseParam(req.params.id);
    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "pending") {
      res.status(400).json({ error: "Request is no longer pending" }); return;
    }

    const roomId = `edulibya-tutoring-${requestId}-${crypto.randomBytes(4).toString("hex")}`;
    const meetingUrl = roomId;

    // Case: request has no assigned teacher (urgent OR any-teacher) — first teacher wins
    if (request.teacherId === null) {
      const [updated] = await db.update(tutoringRequestsTable)
        .set({ teacherId: userId, status: "accepted", meetingUrl, updatedAt: new Date() })
        .where(and(
          eq(tutoringRequestsTable.id, requestId),
          isNull(tutoringRequestsTable.teacherId),
          eq(tutoringRequestsTable.status, "pending")
        ))
        .returning();

      if (!updated) {
        res.status(409).json({ error: "Request was already taken by another teacher" });
        return;
      }
      res.json({ success: true, meetingUrl, updated });
      return;
    }

    // Case: request is assigned to a specific teacher
    if (request.teacherId === userId) {
      const [updated] = await db.update(tutoringRequestsTable)
        .set({ status: "accepted", meetingUrl, updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId))
        .returning();
      res.json({ success: true, meetingUrl, updated });
      return;
    }

    res.status(403).json({ error: "This request is assigned to a different teacher" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Teacher declines a request ───────────────────────────────────────────────
router.post("/requests/:id/decline", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    if (role !== "teacher" && role !== "admin") {
      res.status(403).json({ error: "Only teachers can decline tutoring requests" });
      return;
    }

    const requestId = parseParam(req.params.id);
    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    if (request.status !== "pending" && request.status !== "rescheduled_by_teacher") {
      res.status(400).json({ error: "Cannot decline a request in its current status" }); return;
    }

    // Authorization: must be the assigned teacher OR an unassigned (any-teacher) request
    if (request.teacherId !== null && request.teacherId !== userId) {
      res.status(403).json({ error: "This request is assigned to a different teacher" }); return;
    }

    await db.transaction(async (tx) => {
      await tx.update(tutoringRequestsTable)
        .set({ status: "declined", updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      // Refund student in full
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${parseFloat(request.totalAmount)}` })
        .where(eq(usersTable.id, request.studentId));

      await tx.update(paymentsTable)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(paymentsTable.tutoringRequestId, requestId));
    });

    res.json({ success: true, status: "declined" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Teacher proposes a new time ─────────────────────────────────────────────
router.post("/requests/:id/propose-time", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    if (role !== "teacher" && role !== "admin") {
      res.status(403).json({ error: "Only teachers can propose a new time" });
      return;
    }

    const requestId = parseParam(req.params.id);
    const { proposedAt } = req.body;

    if (!proposedAt) { res.status(400).json({ error: "proposedAt is required" }); return; }

    const proposedDate = new Date(proposedAt);
    if (isNaN(proposedDate.getTime())) {
      res.status(400).json({ error: "Invalid proposed date" }); return;
    }

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "pending") {
      res.status(400).json({ error: "Can only propose a time for pending requests" }); return;
    }

    // Authorization: must be assigned teacher OR unassigned request (any-teacher)
    if (request.teacherId !== null && request.teacherId !== userId) {
      res.status(403).json({ error: "This request is assigned to a different teacher" }); return;
    }

    // If unassigned, assign this teacher when proposing
    const [updated] = await db.update(tutoringRequestsTable)
      .set({
        teacherId: request.teacherId ?? userId,  // claim the request
        status: "rescheduled_by_teacher",
        proposedAt: proposedDate,
        updatedAt: new Date()
      })
      .where(and(
        eq(tutoringRequestsTable.id, requestId),
        eq(tutoringRequestsTable.status, "pending")
      ))
      .returning();

    if (!updated) { res.status(409).json({ error: "Request no longer pending or already taken" }); return; }

    res.json({ success: true, updated });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Student accepts teacher's proposed time ──────────────────────────────────
router.post("/requests/:id/accept-proposed-time", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(and(
        eq(tutoringRequestsTable.id, requestId),
        eq(tutoringRequestsTable.studentId, userId)
      )).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "rescheduled_by_teacher" || !request.proposedAt) {
      res.status(400).json({ error: "No pending time proposal for this request" }); return;
    }

    const roomId = `edulibya-tutoring-${requestId}-${crypto.randomBytes(4).toString("hex")}`;
    const meetingUrl = roomId;

    const [updated] = await db.update(tutoringRequestsTable)
      .set({
        status: "accepted",
        preferredAt: request.proposedAt,
        proposedAt: null,
        meetingUrl,
        updatedAt: new Date()
      })
      .where(eq(tutoringRequestsTable.id, requestId))
      .returning();

    res.json({ success: true, meetingUrl, updated });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Student cancels a request ────────────────────────────────────────────────
router.post("/requests/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(and(
        eq(tutoringRequestsTable.id, requestId),
        eq(tutoringRequestsTable.studentId, userId)
      )).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    if (["completed", "cancelled", "cancelled_no_show", "declined", "completed_pending_review", "approved", "rejected", "partially_approved"].includes(request.status)) {
      res.status(400).json({ error: "Cannot cancel a request that is already completed, under review, or in a terminal state" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(tutoringRequestsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      // Refund student in full
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${parseFloat(request.totalAmount)}` })
        .where(eq(usersTable.id, request.studentId));

      await tx.update(paymentsTable)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(paymentsTable.tutoringRequestId, requestId));
    });

    res.json({ success: true, status: "cancelled" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Student rates a completed session ───────────────────────────────────────
router.post("/requests/:id/rate", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be between 1 and 5" }); return;
    }

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(and(
        eq(tutoringRequestsTable.id, requestId),
        eq(tutoringRequestsTable.studentId, userId)
      )).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (!["completed", "completed_pending_review", "approved", "partially_approved"].includes(request.status)) {
      res.status(400).json({ error: "Can only rate completed sessions" }); return;
    }

    await db.update(tutoringRequestsTable)
      .set({ studentRating: rating, studentReview: review || null, updatedAt: new Date() })
      .where(eq(tutoringRequestsTable.id, requestId));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Mark session as complete ─────────────────────────────────────────────────
router.post("/requests/:id/complete", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    // Only student or teacher involved in this session can mark complete
    if (request.teacherId !== userId && request.studentId !== userId) {
      res.status(403).json({ error: "Not authorized to complete this request" }); return;
    }

    if (request.status !== "accepted") {
      res.status(400).json({ error: "Only accepted sessions can be marked as complete" }); return;
    }

    await db.transaction(async (tx) => {
      await tx.update(tutoringRequestsTable)
        .set({ status: "completed_pending_review", updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      // Payment remains pending until admin review
    });

    res.json({ success: true, status: "completed_pending_review" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Mark session as no-show (Teacher didn't attend) ──────────────────────────
router.post("/requests/:id/no-show", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    
    // ONLY Admins can manually trigger a no-show now (automated system handles the rest)
    if ((req as any).user.role !== "admin") {
      res.status(403).json({ error: "Only admins can manually report a no-show" }); return;
    }

    if (request.status !== "accepted") {
      res.status(400).json({ error: "Only accepted sessions can be marked as no-show" }); return;
    }

    if (!request.teacherId) {
      res.status(400).json({ error: "Cannot mark no-show for an unassigned request" }); return;
    }

    await db.transaction(async (tx) => {
      // Mark as cancelled no show
      await tx.update(tutoringRequestsTable)
        .set({ status: "cancelled_no_show", updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      await tx.update(paymentsTable)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(paymentsTable.tutoringRequestId, requestId));

      // Refund student in full
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${parseFloat(request.totalAmount)}` })
        .where(eq(usersTable.id, request.studentId));

      // Suspend teacher for 1 week
      const suspendUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await tx.update(usersTable)
        .set({ tutoringSuspendedUntil: suspendUntil, updatedAt: new Date() })
        .where(eq(usersTable.id, request.teacherId as number));
    });

    res.json({ success: true, status: "cancelled_no_show" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Join LiveKit Tutoring Session ────────────────────────────────────────────
router.post("/requests/:id/join", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    if (!["accepted", "completed", "completed_pending_review"].includes(request.status)) {
      res.status(403).json({ error: "Session is not active or completed" }); return;
    }

    if (request.teacherId !== userId && request.studentId !== userId) {
      res.status(403).json({ error: "Not authorized to join this session" }); return;
    }

    const isTeacher = request.teacherId === userId;
    const roomId = request.meetingUrl || `edulibya-tutoring-${requestId}`;

    const livekitApiKey = process.env.LIVEKIT_API_KEY || "devkey";
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || "secret";
    const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880";

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const displayName = user?.fullName || (isTeacher ? "Teacher" : "Student");

    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: `user-${userId}`,
      name: displayName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    res.json({ roomId, requestId, isTeacher, token, livekitUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Save Recording URL ───────────────────────────────────────────────────────
router.post("/requests/:id/recording", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);
    const { recordingUrl } = req.body;

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    if (request.teacherId !== userId) {
      res.status(403).json({ error: "Only the teacher can save the recording" }); return;
    }

    await db.update(tutoringRequestsTable)
      .set({ recordingUrl, updatedAt: new Date() })
      .where(eq(tutoringRequestsTable.id, requestId));

    res.json({ success: true, recordingUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});
// ─── Upload Audio Recording (Temporary) ─────────────────────────────────────────
router.post("/requests/:id/upload-audio", requireAuth, upload.single("audio"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    // Only a participant of the session may upload audio
    if (request.teacherId !== userId && request.studentId !== userId) {
      res.status(403).json({ error: "Not authorized to upload audio for this session" }); return;
    }

    // Only upload if session is active or pending review (not already resolved)
    const allowedStatuses = ["accepted", "completed_pending_review"];
    if (!allowedStatuses.includes(request.status)) {
      res.status(400).json({ error: "Cannot upload audio for a session that has already been resolved" }); return;
    }

    // Upload to Cloudinary securely with unguessable string
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const safePublicId = `session_${requestId}_audio_${randomSuffix}`;

    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: "video", // audio works under video in Cloudinary
      folder: "libyan-learn-hub/tutoring-audio",
      public_id: safePublicId,
    });

    await db.update(tutoringRequestsTable)
      .set({ recordingUrl: result.secure_url, updatedAt: new Date() })
      .where(eq(tutoringRequestsTable.id, requestId));

    res.json({ success: true, recordingUrl: result.secure_url });
  } catch (err: any) {
    console.error("Audio upload error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Server-Authoritative Timer: Sync ────────────────────────────────────────
// Called by both teacher and student every ~5 s while inside the room.
// On the teacher's FIRST call it starts the session timer if both are present.
router.post("/requests/:id/timer/sync", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);
    const { participantCount } = req.body; // client sends LiveKit participant count

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.teacherId !== userId && request.studentId !== userId) {
      res.status(403).json({ error: "Not authorized" }); return;
    }

    const isTeacher = request.teacherId === userId;
    const now = new Date();

    // ── Start the timer if both are present and it hasn't started yet ──────────
    if (!request.sessionStartedAt && participantCount >= 2) {
      await db.update(tutoringRequestsTable)
        .set({ sessionStartedAt: now, timerPausedAt: null, updatedAt: now })
        .where(eq(tutoringRequestsTable.id, requestId));

      res.json({
        elapsedSeconds: 0,
        isPaused: false,
        totalDurationSeconds: (request.durationMinutes || 60) * 60,
        sessionStartedAt: now.toISOString(),
      });
    } else {
      // ── Compute current elapsed time ─────────────────────────────────────────
      let elapsed = request.elapsedSeconds ?? 0;
      const isPaused = !!request.timerPausedAt;

      const totalSecs = (request.durationMinutes || 60) * 60;

      if (request.sessionStartedAt && !isPaused) {
        // Timer is running: add live seconds since start
        const liveSecs = Math.floor((now.getTime() - new Date(request.sessionStartedAt).getTime()) / 1000);
        elapsed += liveSecs;
      }

      // Cap elapsed at the total session duration to prevent overshoot
      elapsed = Math.min(elapsed, totalSecs);

      // ── Auto-complete if time has fully elapsed or wall-clock grace period expired ──
      const realScheduledEndMs = new Date(request.preferredAt).getTime() + totalSecs * 1000 + (15 * 60 * 1000); // 15 min grace period
      
      if ((elapsed >= totalSecs || now.getTime() > realScheduledEndMs) && request.status === "accepted") {
        const neverJoined = (request.elapsedSeconds ?? 0) === 0 && request.sessionStartedAt === null;
        const teacherAbandoned = !!request.teacherLeftAt && elapsed < totalSecs;
        const isNoShow = neverJoined || teacherAbandoned;

        await db.update(tutoringRequestsTable)
          .set({ 
            status: isNoShow ? "cancelled_no_show" : "completed_pending_review", 
            earlyTerminationFlagged: teacherAbandoned,
            updatedAt: now 
          })
          .where(and(eq(tutoringRequestsTable.id, requestId), eq(tutoringRequestsTable.status, "accepted")));
      }

      res.json({
        elapsedSeconds: elapsed,
        isPaused,
        totalDurationSeconds: totalSecs,
        sessionStartedAt: request.sessionStartedAt?.toISOString() ?? null,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Server-Authoritative Timer: Participant Leaves ───────────────────────────
// Called when teacher or student disconnects from the room.
// If teacher leaves → pause timer. If both leave before end → flag early termination.
router.post("/requests/:id/leave", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.teacherId !== userId && request.studentId !== userId) {
      res.status(403).json({ error: "Not authorized" }); return;
    }
    if (request.status !== "accepted") {
      res.json({ success: true, skipped: true }); return; // session already ended
    }

    const isTeacher = request.teacherId === userId;
    const now = new Date();

    const totalSecsLeave = (request.durationMinutes || 60) * 60;

    // ── Compute current accumulated elapsed before we do anything ─────────────
    let elapsed = request.elapsedSeconds ?? 0;
    if (request.sessionStartedAt && !request.timerPausedAt) {
      const liveSecs = Math.floor((now.getTime() - new Date(request.sessionStartedAt).getTime()) / 1000);
      elapsed = Math.min(elapsed + liveSecs, totalSecsLeave);
    }

    const updateFields: any = { updatedAt: now };

    if (isTeacher) {
      // Pause the timer and record accumulated elapsed
      updateFields.timerPausedAt = now;
      updateFields.teacherLeftAt = now;
      updateFields.elapsedSeconds = elapsed;
      updateFields.sessionStartedAt = null; // will be reset on resume
    } else {
      updateFields.studentLeftAt = now;
    }

    await db.update(tutoringRequestsTable)
      .set(updateFields)
      .where(eq(tutoringRequestsTable.id, requestId));

    // Re-fetch to check if BOTH have now left ──────────────────────────────────
    const [fresh] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    const totalSecsLeave2 = (fresh.durationMinutes || 60) * 60;
    const teacherGone = !!fresh.teacherLeftAt;
    const studentGone = !!fresh.studentLeftAt;
    const sessionNotComplete = (fresh.elapsedSeconds ?? 0) < totalSecsLeave2;
    const neverJoined = (fresh.elapsedSeconds ?? 0) === 0 && fresh.sessionStartedAt === null;
    const isPastStartTime = now.getTime() >= new Date(fresh.preferredAt).getTime();

    if (studentGone && sessionNotComplete && fresh.status === "accepted") {
      if (neverJoined && isPastStartTime) {
        // Teacher never joined, and student gave up after start time — flag for admin review
        await db.transaction(async (tx) => {
          await tx.update(tutoringRequestsTable)
            .set({ status: "cancelled_no_show", earlyTerminationFlagged: false, updatedAt: now })
            .where(eq(tutoringRequestsTable.id, requestId));
          // Payment frozen — Admin reviews and decides to refund or partially pay teacher
          await tx.update(paymentsTable)
            .set({ status: "on_hold", updatedAt: now })
            .where(eq(paymentsTable.tutoringRequestId, requestId));
        });
      } else if (teacherGone) {
        // Teacher joined but left early, and student eventually left — flag for admin review
        await db.transaction(async (tx) => {
          await tx.update(tutoringRequestsTable)
            .set({ status: "cancelled_no_show", earlyTerminationFlagged: true, updatedAt: now })
            .where(eq(tutoringRequestsTable.id, requestId));
          // Payment frozen — Admin reviews and decides to refund or partially pay teacher
          await tx.update(paymentsTable)
            .set({ status: "on_hold", updatedAt: now })
            .where(eq(paymentsTable.tutoringRequestId, requestId));
        });
      }
    } else if (teacherGone && !studentGone && neverJoined && isPastStartTime && sessionNotComplete && fresh.status === "accepted") {
      // Teacher never joined — flag for admin review even while student is still waiting
      await db.transaction(async (tx) => {
        await tx.update(tutoringRequestsTable)
          .set({ status: "cancelled_no_show", earlyTerminationFlagged: false, updatedAt: now })
          .where(eq(tutoringRequestsTable.id, requestId));
        // Payment frozen — Admin reviews and decides to refund or partially pay teacher
        await tx.update(paymentsTable)
          .set({ status: "on_hold", updatedAt: now })
          .where(eq(paymentsTable.tutoringRequestId, requestId));
      });
    }

    res.json({ success: true, elapsedSeconds: elapsed });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── Server-Authoritative Timer: Teacher Rejoins ─────────────────────────────
// Called by the teacher when they reconnect. Resumes the paused timer.
router.post("/requests/:id/timer/resume", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.teacherId !== userId) {
      res.status(403).json({ error: "Only the teacher can resume the timer" }); return;
    }
    if (request.status !== "accepted") {
      res.json({ success: true, skipped: true }); return;
    }

    const now = new Date();

    await db.update(tutoringRequestsTable)
      .set({
        timerPausedAt: null,
        teacherLeftAt: null,
        sessionStartedAt: now,   // reset live-clock anchor; elapsed already banked
        updatedAt: now,
      })
      .where(eq(tutoringRequestsTable.id, requestId));

    res.json({
      success: true,
      elapsedSeconds: request.elapsedSeconds ?? 0,
      totalDurationSeconds: (request.durationMinutes || 60) * 60,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});


// ─── Misbehave / Panic Report ─────────────────────────────────────────────────
// Either the student or teacher can hit this endpoint to immediately:
//  1. Upload the client-side 2-min rolling video buffer as evidence
//  2. Force-terminate the LiveKit room for ALL participants
//  3. Flag the tutoring request as terminated_due_to_report
//  4. Create a report record in the reportsTable for admin review
router.post("/requests/:id/misbehave", requireAuth, upload.single("recording"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.id);
    const { reason, description } = req.body;

    const [request] = await db.select().from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId)).limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    // Both student and teacher can trigger this
    if (request.teacherId !== userId && request.studentId !== userId) {
      res.status(403).json({ error: "Not authorized" }); return;
    }

    if (!["accepted", "completed_pending_review"].includes(request.status)) {
      res.status(400).json({ error: "Session is not currently active" }); return;
    }

    // Determine who is being reported
    const reportedUserId = userId === request.studentId ? request.teacherId : request.studentId;

    // ── 1. Upload the rolling-buffer recording to Cloudinary if provided ──────
    let recordingUrl: string | null = null;
    if (req.file) {
      try {
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const safePublicId = `misbehave_${requestId}_${randomSuffix}`;
        const uploadResult = await uploadToCloudinary(req.file.buffer, {
          resource_type: "video",
          folder: "libyan-learn-hub/misbehave-recordings",
          public_id: safePublicId,
        });
        recordingUrl = uploadResult.secure_url;
      } catch (uploadErr) {
        // Recording upload failure should NOT block the safety action — log and continue
        console.error("[Misbehave] Recording upload failed:", uploadErr);
      }
    }

    // ── 2. Force-terminate the LiveKit room ───────────────────────────────────
    if (request.meetingUrl) {
      try {
        const { RoomServiceClient } = await import("livekit-server-sdk");
        const livekitApiKey = process.env.LIVEKIT_API_KEY || "devkey";
        const livekitApiSecret = process.env.LIVEKIT_API_SECRET || "secret";
        const livekitHost = (process.env.LIVEKIT_URL || "ws://localhost:7880")
          .replace(/^wss?:\/\//, "https://")
          .replace(/^https?:\/\//, "https://");

        const svc = new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret);
        // deleteRoom removes all participants and closes the room atomically
        await svc.deleteRoom(request.meetingUrl);
      } catch (livekitErr) {
        // LiveKit may already be closed; don't block the report
        console.error("[Misbehave] LiveKit room termination error:", livekitErr);
      }
    }

    // ── 3. Mark session as terminated_due_to_report & put payment on hold ──────
    // No automatic refund — the Admin will review the incident recording
    // and decide the outcome. The funds stay locked (on_hold) until then.
    await db.transaction(async (tx) => {
      await tx.update(tutoringRequestsTable)
        .set({ status: "terminated_due_to_report", updatedAt: new Date() })
        .where(eq(tutoringRequestsTable.id, requestId));

      // Payment is frozen — Admin must release to teacher OR refund student
      await tx.update(paymentsTable)
        .set({ status: "on_hold", updatedAt: new Date() })
        .where(eq(paymentsTable.tutoringRequestId, requestId));
    });

    // ── 4. Create the report record ───────────────────────────────────────────
    const [report] = await db.insert(reportsTable).values({
      reporterId: userId,
      reportedUserId: reportedUserId ?? null,
      type: "tutoring_misbehave",
      reason: (reason as any) || "inappropriate_behavior",
      description: description || "Session forcefully terminated via Misbehave button.",
      targetId: requestId,
      recordingUrl,
      status: "open",
    }).returning();

    res.json({ success: true, reportId: report.id, recordingUrl });
  } catch (err: any) {
    console.error("[Misbehave] Error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;

