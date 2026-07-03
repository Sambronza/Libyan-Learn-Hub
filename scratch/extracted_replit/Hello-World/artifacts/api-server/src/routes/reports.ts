import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable, usersTable, coursesTable, liveSessionsTable, lessonsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { type, reason, description, targetId, reportedUserId } = req.body;
    const [report] = await db.insert(reportsTable).values({
      reporterId: userId,
      reportedUserId: reportedUserId || null,
      type, reason, description, targetId,
    }).returning();
    res.status(201).json(report);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const reports = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
    const result = await Promise.all(reports.map(async (r) => {
      const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, r.reporterId)).limit(1);
      const [reported] = r.reportedUserId
        ? await db.select().from(usersTable).where(eq(usersTable.id, r.reportedUserId)).limit(1)
        : [null];
      return {
        ...r,
        reporterName: reporter?.fullName || "Unknown",
        reporterEmail: reporter?.email || "",
        reportedName: reported?.fullName || null,
        reportedEmail: reported?.email || null,
      };
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/:reportId/status", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const reportId = parseParam(req.params.reportId);
    const { userId } = (req as any).user;
    const { status, adminNote } = req.body;
    const [updated] = await db.update(reportsTable)
      .set({ status, adminNote, resolvedById: userId, updatedAt: new Date() })
      .where(eq(reportsTable.id, reportId))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
