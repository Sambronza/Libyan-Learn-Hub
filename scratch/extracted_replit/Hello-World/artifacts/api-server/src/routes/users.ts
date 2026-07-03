import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, coursesTable, enrollmentsTable, reviewsTable } from "@workspace/db";
import { eq, count, avg, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

async function buildTeacherProfile(teacher: any) {
  const [courseCount] = await db.select({ value: count() }).from(coursesTable).where(eq(coursesTable.teacherId, teacher.id));
  const [studentCount] = await db.select({ value: count() }).from(enrollmentsTable)
    .where(sql`${enrollmentsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacher.id})`);
  const [ratingData] = await db.select({ avgRating: avg(reviewsTable.rating) }).from(reviewsTable)
    .where(sql`${reviewsTable.courseId} IN (SELECT id FROM courses WHERE teacher_id = ${teacher.id})`);
  return {
    id: teacher.id,
    fullName: teacher.fullName,
    fullNameAr: teacher.fullNameAr || teacher.fullName,
    avatarUrl: teacher.avatarUrl,
    bio: teacher.bio,
    bioAr: teacher.bioAr,
    courseCount: Number(courseCount.value),
    studentCount: Number(studentCount.value),
    rating: parseFloat(ratingData?.avgRating || "0"),
    expertise: teacher.expertise,
  };
}

router.get("/teachers", async (_req, res) => {
  try {
    const teachers = await db.select().from(usersTable).where(eq(usersTable.role, "teacher"));
    const result = await Promise.all(teachers.map(buildTeacherProfile));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/teachers/:teacherId", async (req, res) => {
  try {
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(req.params.teacherId))).limit(1);
    if (!teacher || teacher.role !== "teacher") { res.status(404).json({ error: "Teacher not found" }); return; }
    res.json(await buildTeacherProfile(teacher));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/users/profile", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { fullName, fullNameAr, bio, bioAr, avatarUrl, language } = req.body;
    const [user] = await db.update(usersTable)
      .set({ fullName, fullNameAr, bio, bioAr, avatarUrl, language, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      fullNameAr: user.fullNameAr,
      role: user.role,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      bioAr: user.bioAr,
      language: user.language,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.put("/users/email", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { newEmail } = req.body;

    if (!newEmail || typeof newEmail !== 'string' || !newEmail.includes('@')) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, newEmail)).limit(1);
    if (existing.length > 0 && existing[0].id !== userId) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    const [user] = await db.update(usersTable)
      .set({ email: newEmail, emailVerified: false, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({
      success: true,
      message: "Email updated successfully",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        language: user.language,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
