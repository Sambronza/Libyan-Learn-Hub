import { Router } from "express";
import { db } from "@workspace/db";
import { contentVerificationJobsTable, usersTable, lessonsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

// ── Admin: Trigger face check for a teacher ──────────────────────
router.post("/face-check/:teacherId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const teacherId = parseParam(req.params.teacherId);
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
    if (!teacher || !teacher.facePhotoUrl) {
      res.status(400).json({ error: "Teacher has no face photo on file" });
      return;
    }

    const [job] = await db.insert(contentVerificationJobsTable).values({
      teacherId,
      jobType: "face",
      status: "pending",
    }).returning();

    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: Trigger voice check for a teacher ─────────────────────
router.post("/voice-check/:teacherId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const teacherId = parseParam(req.params.teacherId);
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
    if (!teacher || !teacher.voiceSampleUrl) {
      res.status(400).json({ error: "Teacher has no voice sample on file" });
      return;
    }

    const [job] = await db.insert(contentVerificationJobsTable).values({
      teacherId,
      jobType: "voice",
      status: "pending",
    }).returning();

    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: List all verification jobs ────────────────────────────
router.get("/jobs", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { status, jobType } = req.query;
    let query = db.select({
      id: contentVerificationJobsTable.id,
      teacherId: contentVerificationJobsTable.teacherId,
      teacherName: usersTable.fullName,
      teacherNameAr: usersTable.fullNameAr,
      lessonId: contentVerificationJobsTable.lessonId,
      jobType: contentVerificationJobsTable.jobType,
      status: contentVerificationJobsTable.status,
      matchScore: contentVerificationJobsTable.matchScore,
      duplicateOfLessonId: contentVerificationJobsTable.duplicateOfLessonId,
      adminNotes: contentVerificationJobsTable.adminNotes,
      flaggedAt: contentVerificationJobsTable.flaggedAt,
      createdAt: contentVerificationJobsTable.createdAt,
    }).from(contentVerificationJobsTable)
      .leftJoin(usersTable, eq(contentVerificationJobsTable.teacherId, usersTable.id))
      .orderBy(desc(contentVerificationJobsTable.createdAt))
      .$dynamic();

    const results = await query;
    // Client-side filter for simplicity (small dataset)
    const filtered = results.filter((j: any) => {
      if (status && j.status !== status) return false;
      if (jobType && j.jobType !== jobType) return false;
      return true;
    });

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: Update verification job ───────────────────────────────
router.patch("/jobs/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseParam(req.params.id);
    const { userId } = (req as any).user;
    const { status, adminNotes, matchScore } = req.body;

    const updates: any = { updatedAt: new Date(), reviewedByAdminId: userId };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (matchScore !== undefined) updates.matchScore = matchScore;
    if (status === "matched") updates.flaggedAt = new Date();

    await db.update(contentVerificationJobsTable).set(updates).where(eq(contentVerificationJobsTable.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: List duplicate video alerts ───────────────────────────
router.get("/duplicates", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const duplicates = await db.select({
      id: contentVerificationJobsTable.id,
      teacherId: contentVerificationJobsTable.teacherId,
      teacherName: usersTable.fullName,
      lessonId: contentVerificationJobsTable.lessonId,
      duplicateOfLessonId: contentVerificationJobsTable.duplicateOfLessonId,
      matchScore: contentVerificationJobsTable.matchScore,
      status: contentVerificationJobsTable.status,
      createdAt: contentVerificationJobsTable.createdAt,
    }).from(contentVerificationJobsTable)
      .leftJoin(usersTable, eq(contentVerificationJobsTable.teacherId, usersTable.id))
      .where(eq(contentVerificationJobsTable.jobType, "duplicate_video"))
      .orderBy(desc(contentVerificationJobsTable.createdAt));

    res.json(duplicates);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
