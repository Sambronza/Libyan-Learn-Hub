import { Router } from "express";
import { db } from "@workspace/db";
import { advertisementsTable, usersTable, paymentsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

// ── Teacher: Create ad ───────────────────────────────────────────
router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { adType, startDate, endDate, budgetPaid, paymentId } = req.body;

    if (!adType || !startDate || !endDate) {
      res.status(400).json({ error: "adType, startDate, and endDate are required" });
      return;
    }

    const [ad] = await db.insert(advertisementsTable).values({
      teacherId: userId,
      adType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      budgetPaid: budgetPaid || "0",
      paymentId: paymentId || null,
      isActive: true,
      status: "active",
    }).returning();

    // Update user sponsored status
    await db.update(usersTable).set({
      isSponsored: true,
      sponsoredUntil: new Date(endDate),
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    res.json(ad);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Public: Get active homepage ads ──────────────────────────────
router.get("/active", async (_req, res) => {
  try {
    const now = new Date();
    const activeAds = await db.select({
      id: advertisementsTable.id,
      teacherId: advertisementsTable.teacherId,
      adType: advertisementsTable.adType,
      startDate: advertisementsTable.startDate,
      endDate: advertisementsTable.endDate,
      teacherName: usersTable.fullName,
      teacherNameAr: usersTable.fullNameAr,
      teacherAvatar: usersTable.avatarUrl,
      teacherSlug: usersTable.profileSlug,
    }).from(advertisementsTable)
      .innerJoin(usersTable, eq(advertisementsTable.teacherId, usersTable.id))
      .where(and(
        eq(advertisementsTable.isActive, true),
        eq(advertisementsTable.status, "active"),
        lte(advertisementsTable.startDate, now),
        gte(advertisementsTable.endDate, now),
      ))
      .orderBy(desc(advertisementsTable.budgetPaid));

    res.json(activeAds);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Teacher: Get own ads ─────────────────────────────────────────
router.get("/my", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const ads = await db.select().from(advertisementsTable)
      .where(eq(advertisementsTable.teacherId, userId))
      .orderBy(desc(advertisementsTable.createdAt));
    res.json(ads);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Public: Track ad click ───────────────────────────────────────
router.post("/:id/click", async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    const [ad] = await db.select().from(advertisementsTable).where(eq(advertisementsTable.id, adId)).limit(1);
    if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
    await db.update(advertisementsTable).set({
      clicks: (ad.clicks || 0) + 1,
      updatedAt: new Date(),
    }).where(eq(advertisementsTable.id, adId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
