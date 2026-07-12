import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import {
  db, teacherPostsTable, followsTable, usersTable, coursesTable, notificationsTable,
  postCommentsTable, postLikesTable, commentLikesTable, reportsTable,
} from "@workspace/db";
import { eq, and, desc, asc, count, inArray } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { requireAuth, requireRole } from "../lib/auth.js";
import { deleteFromCloudinaryByUrl } from "../lib/cloudinary.js";
import { sendPushToUsers } from "../lib/expo-notifications.js";

const router: IRouter = Router();

const MAX_POST_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 500;

// Per-IP limiter for comment creation to slow down spam bursts
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many comments, slow down a little.", errorAr: "تعليقات كثيرة خلال وقت قصير — تمهّل قليلًا." },
});

// Minimal profanity blocklist (Arabic + English). Deliberately conservative:
// admins handle the rest through comment reports.
const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "nigger",
  "كلب", "حيوان", "خنزير", "زبالة", "قحبة", "شرموطة", "كس امك", "يلعن",
];
function containsBlockedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

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
  commentsEnabled: teacherPostsTable.commentsEnabled,
  createdAt: teacherPostsTable.createdAt,
  teacherName: usersTable.fullName,
  teacherNameAr: usersTable.fullNameAr,
  teacherAvatarUrl: usersTable.avatarUrl,
  teacherSlug: usersTable.profileSlug,
};

/** Attach likesCount / commentsCount / likedByMe to a page of posts. */
async function enrichPosts<T extends { id: number }>(posts: T[], callerId: number | null) {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);

  const likeCounts = await db.select({ postId: postLikesTable.postId, value: count() })
    .from(postLikesTable).where(inArray(postLikesTable.postId, ids)).groupBy(postLikesTable.postId);
  const commentCounts = await db.select({ postId: postCommentsTable.postId, value: count() })
    .from(postCommentsTable).where(inArray(postCommentsTable.postId, ids)).groupBy(postCommentsTable.postId);
  const myLikes = callerId
    ? await db.select({ postId: postLikesTable.postId }).from(postLikesTable)
        .where(and(inArray(postLikesTable.postId, ids), eq(postLikesTable.userId, callerId)))
    : [];

  const likeMap = new Map(likeCounts.map((r) => [r.postId, Number(r.value)]));
  const commentMap = new Map(commentCounts.map((r) => [r.postId, Number(r.value)]));
  const likedSet = new Set(myLikes.map((r) => r.postId));

  return posts.map((p) => ({
    ...p,
    likesCount: likeMap.get(p.id) || 0,
    commentsCount: commentMap.get(p.id) || 0,
    likedByMe: likedSet.has(p.id),
  }));
}

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

    res.json(await enrichPosts(posts, optionalUserId(req)));
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

    res.json(await enrichPosts(posts, userId));
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

// ═══════════════════════ Phase 2: comments & reactions ═══════════════════════

// ── List comments for a post (public; likedByMe for authed callers) ─────────
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId as string);
    if (isNaN(postId)) return void res.status(400).json({ error: "Invalid post id" });

    const comments = await db.select({
      id: postCommentsTable.id,
      postId: postCommentsTable.postId,
      parentId: postCommentsTable.parentId,
      content: postCommentsTable.content,
      createdAt: postCommentsTable.createdAt,
      userId: postCommentsTable.userId,
      userName: usersTable.fullName,
      userNameAr: usersTable.fullNameAr,
      userAvatarUrl: usersTable.avatarUrl,
      userRole: usersTable.role,
    }).from(postCommentsTable)
      .innerJoin(usersTable, eq(postCommentsTable.userId, usersTable.id))
      .where(eq(postCommentsTable.postId, postId))
      .orderBy(asc(postCommentsTable.createdAt))
      .limit(200);

    // Like counts + caller's likes
    const ids = comments.map((c) => c.id);
    let likeMap = new Map<number, number>();
    let likedSet = new Set<number>();
    if (ids.length > 0) {
      const likeCounts = await db.select({ commentId: commentLikesTable.commentId, value: count() })
        .from(commentLikesTable).where(inArray(commentLikesTable.commentId, ids))
        .groupBy(commentLikesTable.commentId);
      likeMap = new Map(likeCounts.map((r) => [r.commentId, Number(r.value)]));
      const callerId = optionalUserId(req);
      if (callerId) {
        const mine = await db.select({ commentId: commentLikesTable.commentId }).from(commentLikesTable)
          .where(and(inArray(commentLikesTable.commentId, ids), eq(commentLikesTable.userId, callerId)));
        likedSet = new Set(mine.map((r) => r.commentId));
      }
    }

    res.json(comments.map((c) => ({
      ...c,
      likesCount: likeMap.get(c.id) || 0,
      likedByMe: likedSet.has(c.id),
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Add a comment (any authenticated user) ───────────────────────────────────
router.post("/posts/:postId/comments", requireAuth, commentLimiter, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const postId = parseInt(req.params.postId as string);
    if (isNaN(postId)) return void res.status(400).json({ error: "Invalid post id" });

    const { content, parentId } = req.body || {};
    if (!content || typeof content !== "string" || !content.trim()) {
      return void res.status(400).json({ error: "Comment content is required" });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return void res.status(400).json({ error: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters)` });
    }
    if (containsBlockedWord(content)) {
      return void res.status(400).json({
        error: "Your comment contains inappropriate language",
        errorAr: "تعليقك يحتوي على ألفاظ غير لائقة",
      });
    }

    const [post] = await db.select({
      id: teacherPostsTable.id,
      teacherId: teacherPostsTable.teacherId,
      commentsEnabled: teacherPostsTable.commentsEnabled,
    }).from(teacherPostsTable).where(eq(teacherPostsTable.id, postId)).limit(1);
    if (!post) return void res.status(404).json({ error: "Post not found" });
    if (!post.commentsEnabled) {
      return void res.status(403).json({
        error: "Comments are disabled on this post",
        errorAr: "التعليقات مغلقة على هذا المنشور",
      });
    }

    // One-level threading: a reply must target a top-level comment on this post
    let validatedParentId: number | null = null;
    if (parentId) {
      const pid = parseInt(parentId);
      const [parent] = await db.select({ postId: postCommentsTable.postId, parentId: postCommentsTable.parentId })
        .from(postCommentsTable).where(eq(postCommentsTable.id, pid)).limit(1);
      if (!parent || parent.postId !== postId || parent.parentId !== null) {
        return void res.status(400).json({ error: "Invalid parent comment" });
      }
      validatedParentId = pid;
    }

    const [comment] = await db.insert(postCommentsTable).values({
      postId,
      userId,
      parentId: validatedParentId,
      content: content.trim(),
    }).returning();

    // Notify the post owner (skip self-comments); failures never block
    try {
      if (post.teacherId !== userId) {
        const [author] = await db.select({ fullName: usersTable.fullName, fullNameAr: usersTable.fullNameAr })
          .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        const name = author?.fullName || "Someone";
        const nameAr = author?.fullNameAr || author?.fullName || "شخص ما";
        const preview = content.trim().slice(0, 120);
        await db.insert(notificationsTable).values({
          userId: post.teacherId,
          type: "new_comment" as const,
          title: `${name} commented on your post`,
          titleAr: `${nameAr} علّق على منشورك`,
          message: preview,
          messageAr: preview,
          referenceId: postId,
        });
        await sendPushToUsers([post.teacherId], `${nameAr} | ${name}`, preview, {
          type: "new_comment", postId,
        });
      }
    } catch (notifyErr) {
      console.error("Comment notification failed (non-fatal):", notifyErr);
    }

    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Delete a comment (author, post owner, or admin) ──────────────────────────
router.delete("/comments/:id", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid comment id" });

    const [comment] = await db.select().from(postCommentsTable)
      .where(eq(postCommentsTable.id, id)).limit(1);
    if (!comment) return void res.status(404).json({ error: "Comment not found" });

    if (role !== "admin" && comment.userId !== userId) {
      // The post owner moderates their own comment section
      const [post] = await db.select({ teacherId: teacherPostsTable.teacherId })
        .from(teacherPostsTable).where(eq(teacherPostsTable.id, comment.postId)).limit(1);
      if (!post || post.teacherId !== userId) {
        return void res.status(403).json({ error: "You cannot delete this comment" });
      }
    }

    await db.delete(postCommentsTable).where(eq(postCommentsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Toggle like on a post ────────────────────────────────────────────────────
router.post("/posts/:postId/like", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const postId = parseInt(req.params.postId as string);
    if (isNaN(postId)) return void res.status(400).json({ error: "Invalid post id" });

    const [existing] = await db.select({ id: postLikesTable.id }).from(postLikesTable)
      .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId))).limit(1);

    if (existing) {
      await db.delete(postLikesTable).where(eq(postLikesTable.id, existing.id));
    } else {
      const [post] = await db.select({ id: teacherPostsTable.id }).from(teacherPostsTable)
        .where(eq(teacherPostsTable.id, postId)).limit(1);
      if (!post) return void res.status(404).json({ error: "Post not found" });
      await db.insert(postLikesTable).values({ postId, userId }).onConflictDoNothing();
    }

    const [{ value }] = await db.select({ value: count() }).from(postLikesTable)
      .where(eq(postLikesTable.postId, postId));
    res.json({ liked: !existing, likesCount: Number(value) });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Toggle like on a comment ─────────────────────────────────────────────────
router.post("/comments/:id/like", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const commentId = parseInt(req.params.id as string);
    if (isNaN(commentId)) return void res.status(400).json({ error: "Invalid comment id" });

    const [existing] = await db.select({ id: commentLikesTable.id }).from(commentLikesTable)
      .where(and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId))).limit(1);

    if (existing) {
      await db.delete(commentLikesTable).where(eq(commentLikesTable.id, existing.id));
    } else {
      const [comment] = await db.select({ id: postCommentsTable.id }).from(postCommentsTable)
        .where(eq(postCommentsTable.id, commentId)).limit(1);
      if (!comment) return void res.status(404).json({ error: "Comment not found" });
      await db.insert(commentLikesTable).values({ commentId, userId }).onConflictDoNothing();
    }

    const [{ value }] = await db.select({ value: count() }).from(commentLikesTable)
      .where(eq(commentLikesTable.commentId, commentId));
    res.json({ liked: !existing, likesCount: Number(value) });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Toggle comments on/off for a post (owner or admin) ───────────────────────
router.patch("/posts/:id/comments-enabled", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid post id" });

    const [post] = await db.select({ teacherId: teacherPostsTable.teacherId, commentsEnabled: teacherPostsTable.commentsEnabled })
      .from(teacherPostsTable).where(eq(teacherPostsTable.id, id)).limit(1);
    if (!post) return void res.status(404).json({ error: "Post not found" });
    if (role !== "admin" && post.teacherId !== userId) {
      return void res.status(403).json({ error: "You can only manage your own posts" });
    }

    const [updated] = await db.update(teacherPostsTable)
      .set({ commentsEnabled: !post.commentsEnabled, updatedAt: new Date() })
      .where(eq(teacherPostsTable.id, id))
      .returning({ commentsEnabled: teacherPostsTable.commentsEnabled });

    res.json({ commentsEnabled: updated.commentsEnabled });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Report a comment → existing admin reports queue ──────────────────────────
router.post("/comments/:id/report", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const commentId = parseInt(req.params.id as string);
    if (isNaN(commentId)) return void res.status(400).json({ error: "Invalid comment id" });

    const [comment] = await db.select({ userId: postCommentsTable.userId, content: postCommentsTable.content })
      .from(postCommentsTable).where(eq(postCommentsTable.id, commentId)).limit(1);
    if (!comment) return void res.status(404).json({ error: "Comment not found" });
    if (comment.userId === userId) return void res.status(400).json({ error: "You cannot report your own comment" });

    const { reason, description } = req.body || {};
    const validReasons = ["offensive", "spam", "inappropriate_behavior", "other"];
    const finalReason = validReasons.includes(reason) ? reason : "offensive";

    await db.insert(reportsTable).values({
      reporterId: userId,
      reportedUserId: comment.userId,
      type: "post_comment",
      reason: finalReason,
      // Keep a snapshot of the text so admins can judge even if it gets deleted
      description: `${description ? description + " | " : ""}Comment text: "${comment.content.slice(0, 300)}"`,
      targetId: commentId,
    });

    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
