import { Router } from "express";
import { db } from "@workspace/db";
import { tutoringRequestsTable, usersTable, paymentsTable, teacherEarningsTable } from "@workspace/db";
import { eq, and, desc, isNull, or, sql, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";
import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";

const router = Router();

// ─── Grade-level minimum hourly rates (LYD/hour) ─────────────────────────────
export const GRADE_LEVEL_RATES: Record<string, number> = {
  grade_1_6:   70,
  grade_7_9:  100,
  grade_10_12: 150,
  university:  150,
};

/** Returns the minimum hourly rate for a given lecturer level. */
export function getGradeRate(lecturerLevel?: string | null): number {
  return GRADE_LEVEL_RATES[lecturerLevel ?? ""] ?? 100;
}

// ─── List tutors (teachers with tutoring enabled) ────────────────────────────
router.get("/tutors", async (_req, res) => {
  try {
    const tutors = await db.select().from(usersTable)
      .where(and(
        or(eq(usersTable.role, "teacher"), eq(usersTable.role, "admin")), 
        eq(usersTable.isTutoringEnabled, true),
        or(isNull(usersTable.tutoringSuspendedUntil), lt(usersTable.tutoringSuspendedUntil, new Date()))
      ));
    res.json(tutors.map(t => ({
      id: t.id,
      fullName: t.fullName,
      bio: t.bio,
      expertise: t.expertise,
      avatarUrl: t.avatarUrl,
      tutoringHourlyRate: parseFloat(t.tutoringHourlyRate || "0"),
      tutoringSubjects: t.tutoringSubjects,
      isVerified: t.isVerified,
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
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
    const { tutoringHourlyRate, tutoringSubjects, commissionAgreed } = req.body;
    
    if (!commissionAgreed) {
      res.status(400).json({ error: "You must agree to the 10% commission" });
      return;
    }
    
    const rate = parseFloat(tutoringHourlyRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      res.status(400).json({ error: "Hourly rate must be between 0 and 100 dinars" });
      return;
    }

    const [updated] = await db.update(usersTable)
      .set({
        isTutoringEnabled: true,
        tutoringHourlyRate: rate.toFixed(2),
        tutoringSubjects: tutoringSubjects || null,
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
    const { isTutoringEnabled, tutoringHourlyRate, tutoringSubjects } = req.body;

    // Validate hourly rate
    if (tutoringHourlyRate != null) {
      const rate = parseFloat(tutoringHourlyRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        res.status(400).json({ error: "Hourly rate must be between 0 and 100 dinars" });
        return;
      }
    }

    const [updated] = await db.update(usersTable)
      .set({
        isTutoringEnabled: !!isTutoringEnabled,
        tutoringHourlyRate: tutoringHourlyRate != null ? parseFloat(tutoringHourlyRate).toFixed(2) : "0.00",
        tutoringSubjects: tutoringSubjects || null,
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
      // Teachers/admins see:
      //  • Requests explicitly assigned to them
      //  • Urgent requests with no teacher assigned (open pool)
      //  • Non-urgent requests with no teacher assigned (any-teacher requests)
      requests = await db.select().from(tutoringRequestsTable)
        .where(
          or(
            eq(tutoringRequestsTable.teacherId, userId),
            and(
              isNull(tutoringRequestsTable.teacherId),
              eq(tutoringRequestsTable.status, "pending")
            )
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

// ─── Student creates a tutoring request ──────────────────────────────────────
router.post("/requests", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    if (role !== "student") {
      res.status(403).json({ error: "Only students can create tutoring requests" });
      return;
    }

    const { teacherId, categoryId, lecturerLevel, isUrgent, subject, topic, preferredAt, durationMinutes, message, attachmentsUrl } = req.body;

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
      const gradeMinRate = getGradeRate(lecturerLevel);

      if (resolvedTeacherId) {
        const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, resolvedTeacherId)).limit(1);
        if (!teacher) {
           throw new Error("Selected teacher not found");
        }
        if (teacher.tutoringSuspendedUntil && new Date(teacher.tutoringSuspendedUntil) > new Date()) {
           throw new Error("Selected teacher is currently suspended and cannot accept requests");
        }
        // Use the higher of the teacher's rate or the grade-level minimum
        const teacherRate = parseFloat(teacher.tutoringHourlyRate || "0");
        hourlyRate = Math.max(teacherRate, gradeMinRate).toFixed(2);
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

    if (["completed", "cancelled", "declined"].includes(request.status)) {
      res.status(400).json({ error: "Cannot cancel a request that is already completed, cancelled, or declined" });
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
    
    if (request.studentId !== userId && (req as any).user.role !== "admin") {
      res.status(403).json({ error: "Not authorized to report a no-show for this request" }); return;
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

    if (!["accepted", "completed"].includes(request.status)) {
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

export default router;
