import { Router } from "express";
import { db } from "@workspace/db";
import { slidesTable, lessonsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

router.get("/lesson/:lessonId", async (req, res) => {
  try {
    const lessonId = parseParam(req.params.lessonId);
    const slides = await db
      .select()
      .from(slidesTable)
      .where(eq(slidesTable.lessonId, lessonId))
      .orderBy(asc(slidesTable.order));
    res.json(slides);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/lesson/:lessonId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const lessonId = parseParam(req.params.lessonId);
    const { title, titleAr, content, contentAr, imageUrl, order } = req.body;
    const [slide] = await db
      .insert(slidesTable)
      .values({ lessonId, title, titleAr, content, contentAr, imageUrl, order: order || 0 })
      .returning();
    res.status(201).json(slide);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create slide", message: err.message });
  }
});

router.put("/:slideId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const slideId = parseParam(req.params.slideId);
    const { title, titleAr, content, contentAr, imageUrl, order } = req.body;
    const [updated] = await db
      .update(slidesTable)
      .set({ title, titleAr, content, contentAr, imageUrl, order })
      .where(eq(slidesTable.id, slideId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Slide not found" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update slide", message: err.message });
  }
});

router.delete("/:slideId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const slideId = parseParam(req.params.slideId);
    await db.delete(slidesTable).where(eq(slidesTable.id, slideId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to delete slide", message: err.message });
  }
});

export default router;
