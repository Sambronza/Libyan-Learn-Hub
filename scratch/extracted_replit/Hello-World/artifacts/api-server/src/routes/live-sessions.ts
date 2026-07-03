import { Router } from "express";
import { db } from "@workspace/db";
import { liveSessionsTable, usersTable, enrollmentsTable, sessionRegistrationsTable } from "@workspace/db";
import { eq, gte, count, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";
import { getSessionDurationLimit } from "../lib/plans.js";
import type { TeacherTier } from "../lib/plans.js";

const router = Router();

async function formatSession(session: any, userId?: number | null, teacherCache?: Map<number, string>) {
  let teacherName = "";
  if (teacherCache && teacherCache.has(session.teacherId)) {
    teacherName = teacherCache.get(session.teacherId)!;
  } else {
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, session.teacherId)).limit(1);
    teacherName = teacher?.fullName || "";
    if (teacherCache) teacherCache.set(session.teacherId, teacherName);
  }

  const [regCount] = await db.select({ total: count() }).from(sessionRegistrationsTable)
    .where(eq(sessionRegistrationsTable.sessionId, session.id));
  const participantCount = Number(regCount?.total || 0);

  let isRegistered = false;
  if (userId) {
    const existing = await db.select().from(sessionRegistrationsTable)
      .where(and(
        eq(sessionRegistrationsTable.sessionId, session.id),
        eq(sessionRegistrationsTable.userId, userId)
      ))
      .limit(1);
    isRegistered = existing.length > 0;
  }

  const isTeacher = userId ? session.teacherId === userId : false;

  return {
    id: session.id,
    courseId: session.courseId,
    teacherId: session.teacherId,
    teacherName,
    title: session.title,
    titleAr: session.titleAr,
    description: session.description,
    scheduledAt: session.scheduledAt,
    durationMinutes: session.durationMinutes,
    maxParticipants: session.maxParticipants,
    meetingUrl: session.meetingUrl,
    status: session.status,
    price: parseFloat(session.price || "0"),
    participantCount,
    isRegistered: isRegistered || isTeacher,
    isTeacher,
    cancellationReason: session.cancellationReason,
    recordingUrl: session.recordingUrl,
    createdAt: session.createdAt,
  };
}

import { verifyToken } from "../lib/auth.js";

router.get("/", async (req, res) => {
  try {
    const { courseId, upcoming, teacherId } = req.query as any;
    
    // Optional auth to check if user is a teacher
    const authHeader = req.headers.authorization;
    let userRole = null;
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const payload = verifyToken(authHeader.slice(7));
        userRole = payload.role;
        userId = payload.userId;
      } catch (e) {}
    }

    const conditions = [];
    if (courseId) conditions.push(eq(liveSessionsTable.courseId, parseParam(courseId)));
    if (teacherId) conditions.push(eq(liveSessionsTable.teacherId, parseParam(teacherId)));
    if (upcoming === "true") conditions.push(gte(liveSessionsTable.scheduledAt, new Date()));

    let sessions = await db.select().from(liveSessionsTable).where(conditions.length > 0 ? and(...conditions) : undefined);
    
    let enrolledCourseIds = new Set<number>();
    if (userId) {
      const enrollments = await db.select({ courseId: enrollmentsTable.courseId })
        .from(enrollmentsTable).where(eq(enrollmentsTable.userId, userId));
      enrollments.forEach(e => enrolledCourseIds.add(e.courseId));
    }

    // Filter visibility
    sessions = sessions.filter(s => {
      // Visible to everyone if not ended/cancelled
      if (s.status !== "ended" && s.status !== "cancelled") return true;
      // If ended, check access for recordings
      if (s.status === "ended") {
        if (userRole === "admin") return true;
        if (userRole === "teacher" && s.teacherId === userId) return true;
        if (s.courseId && enrolledCourseIds.has(s.courseId)) return true;
        if (parseFloat(s.price || "0") === 0) return true; // Free sessions
      }
      return false;
    });

    const teacherCache = new Map<number, string>();
    const result = await Promise.all(sessions.map(s => formatSession(s, userId, teacherCache)));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { courseId, title, titleAr, description, scheduledAt, durationMinutes, maxParticipants, meetingUrl, price = 0 } = req.body;

    // ── Session duration limit check ──────────────────────────────
    const teacher = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: { tier: true },
    });
    if (teacher) {
      const maxMinutes = getSessionDurationLimit(teacher.tier as TeacherTier);
      if (durationMinutes > maxMinutes) {
        res.status(403).json({
          error: `Your plan only allows sessions up to ${maxMinutes} minutes. Please upgrade your plan.`,
          planLimit: maxMinutes,
          requested: durationMinutes,
        });
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────

    const [session] = await db.insert(liveSessionsTable).values({
      courseId, teacherId: userId, title, titleAr, description,
      scheduledAt: new Date(scheduledAt),
      durationMinutes, maxParticipants, meetingUrl,
      price: parseFloat(price).toFixed(2),
    }).returning();
    res.status(201).json(await formatSession(session, userId));
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create session", message: err.message });
  }
});

router.get("/:sessionId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const payload = verifyToken(authHeader.slice(7));
        userId = payload.userId;
      } catch (e) {}
    }

    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, parseParam(req.params.sessionId))).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    res.json(await formatSession(session, userId));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:sessionId/join", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const sessionId = parseParam(req.params.sessionId);
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, sessionId)).limit(1);
    
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    if (session.status === "cancelled") {
      res.status(403).json({ error: "This session has been cancelled", cancellationReason: session.cancellationReason });
      return;
    }

    const isTeacher = session.teacherId === userId;
    // Return stable internal roomId
    const roomId = session.meetingUrl || `edulibya-legacy-${sessionId}`;
    
    res.json({
      sessionId: session.id,
      roomId: roomId,
      isTeacher,
      message: "Success",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:sessionId/cancel", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    const { reason, notifyStudents } = req.body;
    
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, parseParam(req.params.sessionId))).limit(1);
    
    if (!session) { 
      res.status(404).json({ error: "Session not found" }); 
      return; 
    }
    
    if (session.teacherId !== userId && role !== "admin") {
      res.status(403).json({ error: "Forbidden: You are not the teacher of this session" });
      return;
    }

    const [updatedSession] = await db.update(liveSessionsTable)
      .set({ 
        status: "cancelled", 
        cancellationReason: reason || null 
      })
      .where(eq(liveSessionsTable.id, parseParam(req.params.sessionId)))
      .returning();

    if (notifyStudents) {
      // Simulate sending notifications
      console.log(`Notification: Live Session ${session.id} cancelled. Reason: ${reason || 'No reason provided'}`);
    }

    res.json({
      success: true,
      message: "Session cancelled successfully",
      session: await formatSession(updatedSession, userId)
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:sessionId/end", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    const { recordingUrl } = req.body;
    
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, parseParam(req.params.sessionId))).limit(1);
    
    if (!session) { 
      res.status(404).json({ error: "Session not found" }); 
      return; 
    }
    
    if (session.teacherId !== userId && role !== "admin") {
      res.status(403).json({ error: "Forbidden: You are not the teacher of this session" });
      return;
    }

    const updateData: any = { status: "ended" };
    if (recordingUrl !== undefined) {
      updateData.recordingUrl = recordingUrl;
    }

    const [updatedSession] = await db.update(liveSessionsTable)
      .set(updateData)
      .where(eq(liveSessionsTable.id, parseParam(req.params.sessionId)))
      .returning();

    res.json({
      success: true,
      message: "Session ended successfully",
      session: await formatSession(updatedSession, userId)
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.delete("/:sessionId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, parseParam(req.params.sessionId))).limit(1);
    
    if (!session) { 
      res.status(404).json({ error: "Session not found" }); 
      return; 
    }
    
    if (session.teacherId !== userId && role !== "admin") {
      res.status(403).json({ error: "Forbidden: You are not the teacher of this session" });
      return;
    }

    await db.delete(liveSessionsTable).where(eq(liveSessionsTable.id, parseParam(req.params.sessionId)));

    res.json({
      success: true,
      message: "Session deleted successfully"
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
