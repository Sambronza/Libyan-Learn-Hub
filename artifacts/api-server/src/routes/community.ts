import { Router, type IRouter } from "express";
import {
  db, teacherPostsTable, followsTable, usersTable, coursesTable, notificationsTable,
} from "@workspace/db";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { requireAuth, requireRole } from "../lib/auth.js";
import { deleteFromCloudinaryByUrl } from "../lib/cloudinary.js";
import { sendPushToUsers } from "../lib/expo-notifications.js";

const router: IRouter = Router();

const MAX_POST_LENGTH = 2000;

/** Parse the Bearer token if present without rejecting anonymous requests. */
function optionalUserId(req: any): number | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const SECRET = process.env.JWT_SECRET || "lms-libya-secret-2024-dev";
    return (jwt.verify(h.slice(7), SECRET) as any).userId ?? null;
  } catch {
    return null;
  }
}

const postColumns = {
  id: teacherPostsTable.id,
  teacherId: teacherPostsTable.teacherId,
  content: teacherPostsTable.content,
  imageUrl: teacherPostsTable.imageUrl,
  linkUrl: teacherPostsTable.linkUrl,
  courseId: teacherPostsTable.courseId,
  createdAt: teacherPostsTable.createdAt,
  teacherName: usersTable.fullName,
  teacherNameAr: usersTable.fullNameAr,
  teacherAvatarUrl: usersTable.avatarUrl,
  teacherSlug: usersTable.profileSlug,
};

// ── Public: a teacher's posts (shown on their profile) ──────────────────────
router.get("/posts/teacher/:teacherId", async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId as string);
    if (isNaN(teacherId)) return void res.status(400).json({ error: "Invalid teacher id" });

    const posts = await db.select(postColumns)
      .from(teacherPostsTable)
      .innerJoin(usersTable, eq(teacherPostsTable.teacherId, usersTable.id))
      .where(eq(teacherPostsTable.teacherId, teacherId))
      .orderBy(desc(teacherPostsTable.createdAt))
      .limit(50);

    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Feed: posts from teachers the caller follows ─────────────────────────────
router.get("/feed", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;

    const followed = await db.select({ teacherId: followsTable.teacherId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    if (followed.length === 0) return void res.json([]);

    const posts = await db.select(postColumns)
      .from(teacherPostsTable)
      .innerJoin(usersTable, eq(teacherPostsTable.teacherId, usersTable.id))
      .where(inArray(teacherPostsTable.teacherId, followed.map((f) => f.teacherId)))
      .orderBy(desc(teacherPostsTable.createdAt))
      .limit(50);

    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Create a post (approved teachers and admins) ─────────────────────────────
router.post("/posts", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    if (role === "teacher") {
      const [teacher] = await db.select({
        isVerified: usersTable.isVerified,
        teacherApprovalStatus: usersTable.teacherApprovalStatus,
      }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const isApproved = teacher && (teacher.isVerified || teacher.teacherApprovalStatus === "approved");
      if (!isApproved) {
        return void res.status(403).json({
          error: "Only approved teachers can publish posts",
          errorAr: "فقط المعلمون المعتمدون يمكنهم النشر",
        });
      }
    }

    const { content, imageUrl, imagePublicId, linkUrl, courseId } = req.body || {};

    if (!content || typeof content !== "string" || !content.trim()) {
      return void res.status(400).json({ error: "Post content is required" });
    }
    if (content.length > MAX_POST_LENGTH) {
      return void res.status(400).json({ error: `Post is too long (max ${MAX_POST_LENGTH} characters)` });
    }
    if (linkUrl) {
      try {
        const u = new URL(linkUrl);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        return void res.status(400).json({ error: "Only valid http/https links are allowed" });
      }
    }
    // A linked course must belong to the posting teacher (admins may link any)
    let linkedCourseId: number | null = null;
    if (courseId) {
      const cid = parseInt(courseId);
      const [course] = await db.select({ teacherId: coursesTable.teacherId })
        .from(coursesTable).where(eq(coursesTable.id, cid)).limit(1);
      if (!course) return void res.status(400).json({ error: "Linked course not found" });
      if (role !== "admin" && course.teacherId !== userId) {
        return void res.status(403).json({ error: "You can only link your own courses" });
      }
      linkedCourseId = cid;
    }

    const [post] = await db.insert(teacherPostsTable).values({
      teacherId: userId,
      content: content.trim(),
      imageUrl: imageUrl || null,
      imagePublicId: imagePublicId || null,
      linkUrl: linkUrl || null,
      courseId: linkedCourseId,
    }).returning();

    // Notify followers (in-app + push). Failures must never fail the post.
    try {
      const followers = await db.select({ followerId: followsTable.followerId })
        .from(followsTable).where(eq(followsTable.teacherId, userId));
      if (followers.length > 0) {
        const [author] = await db.select({ fullName: usersTable.fullName, fullNameAr: usersTable.fullNameAr })
          .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        const name = author?.fullName || "A teacher";
        const nameAr = author?.fullNameAr || author?.fullName || "معلم";
        const preview = content.trim().slice(0, 120);

        await db.insert(notificationsTable).values(followers.map((f) => ({
          userId: f.followerId,
          type: "new_post" as const,
          title: `${name} shared a new post`,
          titleAr: `${nameAr} نشر منشورًا جديدًا`,
          message: preview,
          messageAr: preview,
          referenceId: post.id,
        })));

        await sendPushToUsers(
          followers.map((f) => f.followerId),
          `${nameAr} | ${name}`,
          preview,
          { type: "new_post", postId: post.id, teacherId: userId },
        );
      }
    } catch (notifyErr) {
      console.error("Post follower notification failed (non-fatal):", notifyErr);
    }

    res.status(201).json(post);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Delete a post (author or admin) ──────────────────────────────────────────
router.delete("/posts/:id", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid post id" });

    const [post] = await db.select().from(teacherPostsTable)
      .where(eq(teacherPostsTable.id, id)).limit(1);
    if (!post) return void res.status(404).json({ error: "Post not found" });
    if (role !== "admin" && post.teacherId !== userId) {
      return void res.status(403).json({ error: "You can only delete your own posts" });
    }

    if (post.imageUrl) await deleteFromCloudinaryByUrl(post.imageUrl);
    await db.delete(teacherPostsTable).where(eq(teacherPostsTable.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Follow state: public count + whether the caller follows ─────────────────
router.get("/follow/state/:teacherId", async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId as string);
    if (isNaN(teacherId)) return void res.status(400).json({ error: "Invalid teacher id" });

    const [{ value: followersCount }] = await db.select({ value: count() })
      .from(followsTable).where(eq(followsTable.teacherId, teacherId));

    let following = false;
    const callerId = optionalUserId(req);
    if (callerId) {
      const [row] = await db.select({ id: followsTable.id }).from(followsTable)
        .where(and(eq(followsTable.followerId, callerId), eq(followsTable.teacherId, teacherId)))
        .limit(1);
      following = !!row;
    }

    res.json({ followersCount: Number(followersCount), following });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Follow / unfollow a teacher ──────────────────────────────────────────────
router.post("/follow/:teacherId", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const teacherId = parseInt(req.params.teacherId as string);
    if (isNaN(teacherId)) return void res.status(400).json({ error: "Invalid teacher id" });
    if (teacherId === userId) return void res.status(400).json({ error: "You cannot follow yourself" });

    const [target] = await db.select({ role: usersTable.role }).from(usersTable)
      .where(eq(usersTable.id, teacherId)).limit(1);
    if (!target || target.role !== "teacher") {
      return void res.status(404).json({ error: "Teacher not found" });
    }

    await db.insert(followsTable)
      .values({ followerId: userId, teacherId })
      .onConflictDoNothing();

    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.delete("/follow/:teacherId", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const teacherId = parseInt(req.params.teacherId as string);
    if (isNaN(teacherId)) return void res.status(400).json({ error: "Invalid teacher id" });

    await db.delete(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.teacherId, teacherId)));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
