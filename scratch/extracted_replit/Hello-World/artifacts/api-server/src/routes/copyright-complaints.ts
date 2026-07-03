import { Router } from "express";
import { db } from "@workspace/db";
import { copyrightComplaintsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

// ── Public: Submit a copyright complaint ─────────────────────────
router.post("/", async (req, res) => {
  try {
    const { reporterName, reporterEmail, reportedTeacherId, reportedLessonId, description, proofUrl, reporterUserId } = req.body;
    if (!reporterName || !reporterEmail || !reportedTeacherId || !description) {
      res.status(400).json({ error: "reporterName, reporterEmail, reportedTeacherId, and description are required" });
      return;
    }

    const [complaint] = await db.insert(copyrightComplaintsTable).values({
      reporterName,
      reporterEmail,
      reporterUserId: reporterUserId || null,
      reportedTeacherId,
      reportedLessonId: reportedLessonId || null,
      description,
      proofUrl: proofUrl || null,
    }).returning();

    res.status(201).json(complaint);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: List all complaints ───────────────────────────────────
router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const complaints = await db.select({
      id: copyrightComplaintsTable.id,
      reporterName: copyrightComplaintsTable.reporterName,
      reporterEmail: copyrightComplaintsTable.reporterEmail,
      reportedTeacherId: copyrightComplaintsTable.reportedTeacherId,
      reportedTeacherName: usersTable.fullName,
      reportedLessonId: copyrightComplaintsTable.reportedLessonId,
      description: copyrightComplaintsTable.description,
      proofUrl: copyrightComplaintsTable.proofUrl,
      status: copyrightComplaintsTable.status,
      adminNotes: copyrightComplaintsTable.adminNotes,
      createdAt: copyrightComplaintsTable.createdAt,
    }).from(copyrightComplaintsTable)
      .leftJoin(usersTable, eq(copyrightComplaintsTable.reportedTeacherId, usersTable.id))
      .orderBy(desc(copyrightComplaintsTable.createdAt));

    res.json(complaints);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Admin: Update complaint status ───────────────────────────────
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseParam(req.params.id);
    const { userId } = (req as any).user;
    const { status, adminNotes } = req.body;

    await db.update(copyrightComplaintsTable).set({
      status,
      adminNotes,
      resolvedById: userId,
      updatedAt: new Date(),
    }).where(eq(copyrightComplaintsTable.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
