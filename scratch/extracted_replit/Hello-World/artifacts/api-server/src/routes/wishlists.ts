import { Router } from "express";
import { db } from "@workspace/db";
import { wishlistsTable, coursesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const items = await db.select().from(wishlistsTable).where(eq(wishlistsTable.userId, userId));
    const result = await Promise.all(items.map(async (w) => {
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, w.courseId)).limit(1);
      const [teacher] = course ? await db.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1) : [null];
      return { ...w, course: course ? { ...course, price: parseFloat(course.price), teacherName: teacher?.fullName } : null };
    }));
    res.json(result.filter(w => w.course));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/:courseId", async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const courseId = parseInt(req.params.courseId);
    const existing = await db.select().from(wishlistsTable)
      .where(and(eq(wishlistsTable.userId, userId), eq(wishlistsTable.courseId, courseId))).limit(1);
    if (existing.length > 0) { res.json({ wishlisted: true }); return; }
    await db.insert(wishlistsTable).values({ userId, courseId });
    res.json({ wishlisted: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.delete("/:courseId", async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const courseId = parseInt(req.params.courseId);
    await db.delete(wishlistsTable).where(and(eq(wishlistsTable.userId, userId), eq(wishlistsTable.courseId, courseId)));
    res.json({ wishlisted: false });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/check/:courseId", async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const courseId = parseInt(req.params.courseId);
    const existing = await db.select().from(wishlistsTable)
      .where(and(eq(wishlistsTable.userId, userId), eq(wishlistsTable.courseId, courseId))).limit(1);
    res.json({ wishlisted: existing.length > 0 });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
