import { Router } from "express";
import { db } from "@workspace/db";
import {
  liveSessionFeedbackTable,
  liveSessionsTable,
  reviewsTable,
  tutoringRequestsTable,
  enrollmentsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// LIVE SESSION FEEDBACK
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/feedback/live-session/:sessionId/mine
 * Check whether the authenticated student has already submitted feedback for this session.
 * Returns { submitted: boolean, feedback: {...} | null }
 */
router.get("/live-session/:sessionId/mine", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const sessionId = parseParam(req.params.sessionId);

    const [existing] = await db
      .select()
      .from(liveSessionFeedbackTable)
      .where(
        and(
          eq(liveSessionFeedbackTable.sessionId, sessionId),
          eq(liveSessionFeedbackTable.userId, userId)
        )
      )
      .limit(1);

    res.json({ submitted: !!existing, feedback: existing || null });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

/**
 * POST /api/feedback/live-session/:sessionId
 * Submit feedback for a live session (students only, one per session).
 * Body: { contentRating: 1-5, technicalRating?: 1-5, comment?: string }
 */
router.post("/live-session/:sessionId", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const sessionId = parseParam(req.params.sessionId);
    const { contentRating, technicalRating, comment } = req.body;

    if (!contentRating || contentRating < 1 || contentRating > 5) {
      res.status(400).json({ error: "contentRating must be between 1 and 5" });
      return;
    }

    // Get the session to find teacherId
    const [session] = await db
      .select()
      .from(liveSessionsTable)
      .where(eq(liveSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Don't let the teacher review their own session
    if (session.teacherId === userId) {
      res.status(403).json({ error: "Teachers cannot review their own sessions" });
      return;
    }

    // Upsert — conflict on (sessionId, userId) updates instead of throwing
    const [feedback] = await db
      .insert(liveSessionFeedbackTable)
      .values({
        sessionId,
        userId,
        teacherId: session.teacherId,
        contentRating,
        technicalRating: technicalRating || null,
        comment: comment || null,
      })
      .onConflictDoUpdate({
        target: [liveSessionFeedbackTable.sessionId, liveSessionFeedbackTable.userId],
        set: {
          contentRating,
          technicalRating: technicalRating || null,
          comment: comment || null,
        },
      })
      .returning();

    res.json({ success: true, feedback });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// COURSE FEEDBACK (delegates to reviews table)
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/feedback/course/:courseId/mine
 * Check whether the authenticated student has already reviewed this course.
 */
router.get("/course/:courseId/mine", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const courseId = parseParam(req.params.courseId);

    const [existing] = await db
      .select()
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.courseId, courseId),
          eq(reviewsTable.userId, userId)
        )
      )
      .limit(1);

    res.json({ submitted: !!existing, review: existing || null });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

/**
 * POST /api/feedback/course/:courseId
 * Submit or update a course review.
 * Body: { rating: 1-5, comment?: string }
 */
router.post("/course/:courseId", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const courseId = parseParam(req.params.courseId);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be between 1 and 5" });
      return;
    }

    // Verify enrollment
    const [enrollment] = await db
      .select()
      .from(enrollmentsTable)
      .where(
        and(
          eq(enrollmentsTable.courseId, courseId),
          eq(enrollmentsTable.userId, userId)
        )
      )
      .limit(1);

    if (!enrollment) {
      res.status(403).json({ error: "You must be enrolled to review this course" });
      return;
    }

    // Upsert — no unique constraint on reviewsTable so check-then-insert/update
    const [existingReview] = await db
      .select()
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.courseId, courseId),
          eq(reviewsTable.userId, userId)
        )
      )
      .limit(1);

    let review;
    if (existingReview) {
      [review] = await db
        .update(reviewsTable)
        .set({ rating, comment: comment || null })
        .where(eq(reviewsTable.id, existingReview.id))
        .returning();
    } else {
      [review] = await db
        .insert(reviewsTable)
        .values({ courseId, userId, rating, comment: comment || null })
        .returning();
    }

    res.json({ success: true, review });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// TUTORING FEEDBACK
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/feedback/tutoring/:requestId/mine
 * Check whether the student has already rated this tutoring session.
 */
router.get("/tutoring/:requestId/mine", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.requestId);

    const [tRequest] = await db
      .select()
      .from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId))
      .limit(1);

    if (!tRequest || tRequest.studentId !== userId) {
      res.status(404).json({ error: "Tutoring request not found" });
      return;
    }

    res.json({
      submitted: tRequest.studentRating !== null,
      rating: tRequest.studentRating,
      review: tRequest.studentReview,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

/**
 * POST /api/feedback/tutoring/:requestId
 * Submit feedback for a completed 1-on-1 tutoring session.
 * Body: { rating: 1-5, comment?: string }
 */
router.post("/tutoring/:requestId", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requestId = parseParam(req.params.requestId);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be between 1 and 5" });
      return;
    }

    const [tRequest] = await db
      .select()
      .from(tutoringRequestsTable)
      .where(eq(tutoringRequestsTable.id, requestId))
      .limit(1);

    if (!tRequest) {
      res.status(404).json({ error: "Tutoring request not found" });
      return;
    }

    if (tRequest.studentId !== userId) {
      res.status(403).json({ error: "Only the student can rate a tutoring session" });
      return;
    }

    if (!["completed", "approved", "partially_approved"].includes(tRequest.status)) {
      res.status(400).json({ error: "Session must be completed before rating" });
      return;
    }

    const [updated] = await db
      .update(tutoringRequestsTable)
      .set({ studentRating: rating, studentReview: comment || null })
      .where(eq(tutoringRequestsTable.id, requestId))
      .returning();

    res.json({ success: true, rating: updated.studentRating, review: updated.studentReview });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
