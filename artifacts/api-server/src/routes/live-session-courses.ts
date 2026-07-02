import { Router } from "express";
import { db } from "@workspace/db";
import {
  liveSessionCoursesTable,
  liveSessionsTable,
  usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";
import { getSessionDurationLimit } from "../lib/plans.js";
import type { TeacherTier } from "../lib/plans.js";

const router = Router();

/**
 * POST /api/live-session-courses
 *
 * Creates a live session course and bulk-inserts all its sessions in one
 * atomic operation.
 *
 * Body shape:
 * {
 *   title: string,
 *   titleAr: string,
 *   description?: string,
 *   pricePerSession: number,    // LYD, applied to every session
 *   durationMinutes: number,    // same duration for all sessions
 *   maxParticipants: number,
 *   meetingUrl?: string,
 *   sessions: Array<{
 *     scheduledAt: string,       // ISO date string
 *     title?: string,            // optional per-session override
 *     titleAr?: string,
 *   }>
 * }
 */
router.post(
  "/",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res): Promise<any> => {
    try {
      const { userId } = (req as any).user;

      // ── Biometrics check ─────────────────────────────────────────────────
      const [teacherUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!teacherUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (teacherUser.role === "teacher" && !teacherUser.biometricsVerified) {
        return res.status(403).json({
          error:
            "Biometric identity verification is required before scheduling live sessions.",
        });
      }

      const {
        title,
        titleAr,
        description,
        totalPrice = 0,
        durationMinutes = 60,
        maxParticipants = 100,
        meetingUrl,
        sessions, // Array<{ scheduledAt, title?, titleAr? }>
      } = req.body;

      // ── Validate required fields ─────────────────────────────────────────
      if (!title || !titleAr) {
        return res
          .status(400)
          .json({ error: "title and titleAr are required" });
      }
      if (!Array.isArray(sessions) || sessions.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one session is required" });
      }
      if (sessions.length > 100) {
        return res
          .status(400)
          .json({ error: "Maximum 100 sessions per course" });
      }

      // ── Duration limit check ──────────────────────────────────────────────
      const maxMinutes = getSessionDurationLimit(
        teacherUser.tier as TeacherTier
      );
      if (durationMinutes > maxMinutes) {
        return res.status(403).json({
          error: `Your plan only allows sessions up to ${maxMinutes} minutes. Please upgrade.`,
          planLimit: maxMinutes,
          requested: durationMinutes,
        });
      }

      // ── 1. Create the parent live session course record ───────────────────
      const [liveSessionCourse] = await db
        .insert(liveSessionCoursesTable)
        .values({
          teacherId: userId,
          title,
          titleAr,
          description: description || null,
          totalPrice: parseFloat(totalPrice).toFixed(2),
          sessionCount: sessions.length,
        })
        .returning();

      // ── 2. Bulk-insert all sessions ───────────────────────────────────────
      const sessionRows = sessions.map((s: any, idx: number) => ({
        liveSessionCourseId: liveSessionCourse.id,
        teacherId: userId,
        title: s.title || `${title} — Session ${idx + 1}`,
        titleAr: s.titleAr || `${titleAr} — الجلسة ${idx + 1}`,
        description: description || null,
        scheduledAt: new Date(s.scheduledAt),
        durationMinutes,
        maxParticipants,
        meetingUrl: meetingUrl || null,
        // Individual sessions carry price=0; the course totalPrice is what students pay once
        price: "0.00",
        status: "scheduled" as const,
      }));

      const insertedSessions = await db
        .insert(liveSessionsTable)
        .values(sessionRows)
        .returning();

      return res.status(201).json({
        liveSessionCourse: {
          id: liveSessionCourse.id,
          title: liveSessionCourse.title,
          titleAr: liveSessionCourse.titleAr,
          description: liveSessionCourse.description,
          totalPrice: parseFloat(liveSessionCourse.totalPrice || "0"),
          sessionCount: liveSessionCourse.sessionCount,
          createdAt: liveSessionCourse.createdAt,
        },
        sessions: insertedSessions.map((s) => ({
          id: s.id,
          title: s.title,
          scheduledAt: s.scheduledAt,
          status: s.status,
        })),
      });
    } catch (err: any) {
      res.status(400).json({
        error: "Failed to create live session course",
        message: err.message,
      });
    }
  }
);

/**
 * GET /api/live-session-courses
 *
 * Returns all live session courses for the authenticated teacher.
 */
router.get(
  "/",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res) => {
    try {
      const { userId, role } = (req as any).user;

      const courses =
        role === "admin"
          ? await db.select().from(liveSessionCoursesTable)
          : await db
              .select()
              .from(liveSessionCoursesTable)
              .where(eq(liveSessionCoursesTable.teacherId, userId));

      // Attach session summaries
      const result = await Promise.all(
        courses.map(async (c) => {
          const sessions = await db
            .select({
              id: liveSessionsTable.id,
              scheduledAt: liveSessionsTable.scheduledAt,
              status: liveSessionsTable.status,
            })
            .from(liveSessionsTable)
            .where(eq(liveSessionsTable.liveSessionCourseId, c.id));

          return {
            id: c.id,
            title: c.title,
            titleAr: c.titleAr,
            description: c.description,
            totalPrice: parseFloat(c.totalPrice || "0"),
            sessionCount: c.sessionCount,
            createdAt: c.createdAt,
            sessions,
          };
        })
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "Server error", message: err.message });
    }
  }
);

/**
 * GET /api/live-session-courses/:id
 *
 * Returns a single live session course with all its sessions.
 * Public endpoint — anyone can view (needed for student course cards).
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseParam(req.params.id);
    const [course] = await db
      .select()
      .from(liveSessionCoursesTable)
      .where(eq(liveSessionCoursesTable.id, id))
      .limit(1);

    if (!course) {
      res.status(404).json({ error: "Live session course not found" });
      return;
    }

    const [teacher] = await db
      .select({ fullName: usersTable.fullName, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, course.teacherId))
      .limit(1);

    const sessions = await db
      .select()
      .from(liveSessionsTable)
      .where(eq(liveSessionsTable.liveSessionCourseId, id));

    res.json({
      id: course.id,
      title: course.title,
      titleAr: course.titleAr,
      description: course.description,
      totalPrice: parseFloat(course.totalPrice || "0"),
      sessionCount: course.sessionCount,
      teacherName: teacher?.fullName || "",
      teacherAvatar: teacher?.avatarUrl || null,
      createdAt: course.createdAt,
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        titleAr: s.titleAr,
        scheduledAt: s.scheduledAt,
        durationMinutes: s.durationMinutes,
        status: s.status,
        price: parseFloat(s.price || "0"),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
