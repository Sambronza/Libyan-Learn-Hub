import { Router } from "express";
import { serverError } from "../lib/http.js";
import { db } from "@workspace/db";
import {
  liveSessionsTable, sessionRegistrationsTable, sessionQuestionsTable, usersTable, paymentsTable
} from "@workspace/db";
import { eq, and, count, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";
import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";

const router = Router();

// Get session detail + registration status + seat count
router.get("/sessions/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const sessionId = parseParam(req.params.id);
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, sessionId)).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    const [registeredCount] = await db.select({ total: count() }).from(sessionRegistrationsTable)
      .where(eq(sessionRegistrationsTable.sessionId, sessionId));

    const existing = await db.select().from(sessionRegistrationsTable)
      .where(and(eq(sessionRegistrationsTable.sessionId, sessionId), eq(sessionRegistrationsTable.userId, userId)))
      .limit(1);

    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, session.teacherId)).limit(1);

    res.json({
      ...session,
      price: parseFloat(session.price),
      registeredCount: Number(registeredCount.total),
      seatsLeft: session.maxParticipants - Number(registeredCount.total),
      isFull: Number(registeredCount.total) >= session.maxParticipants,
      isRegistered: existing.length > 0 || session.teacherId === userId,
      teacherName: teacher?.fullName || "Unknown",
      isTeacher: session.teacherId === userId,
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

// Register for a session (claim a seat) — handles both free and paid sessions
router.post("/sessions/:id/register", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const sessionId = parseParam(req.params.id);
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, sessionId)).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    // Block registering for cancelled sessions
    if (session.status === "cancelled") {
      res.status(403).json({ error: "This session has been cancelled" }); return;
    }

    // Teachers don't register for their own sessions
    if (session.teacherId === userId) {
      res.json({ success: true, alreadyRegistered: true }); return;
    }

    // Check seat availability
    const [registeredCount] = await db.select({ total: count() }).from(sessionRegistrationsTable)
      .where(eq(sessionRegistrationsTable.sessionId, sessionId));
    if (Number(registeredCount.total) >= session.maxParticipants) {
      res.status(400).json({ error: "Session is full" }); return;
    }

    // Idempotency: already registered → return early
    const existing = await db.select().from(sessionRegistrationsTable)
      .where(and(eq(sessionRegistrationsTable.sessionId, sessionId), eq(sessionRegistrationsTable.userId, userId)))
      .limit(1);
    if (existing.length > 0) { res.json({ success: true, alreadyRegistered: true }); return; }

    const price = parseFloat(session.price || "0");

    if (price > 0) {
      // ── Paid session: check balance and deduct inside a transaction ──────
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const balance = parseFloat((user as any).balance ?? "0");

      if (balance < price) {
        res.status(402).json({
          error: "Insufficient wallet balance",
          required: price,
          available: balance,
        });
        return;
      }

      await db.transaction(async (tx) => {
        // Deduct from user's wallet balance
        await tx.update(usersTable)
          .set({ balance: sql`${usersTable.balance} - ${price}`, updatedAt: new Date() })
          .where(eq(usersTable.id, userId));

        // Record the payment
        await tx.insert(paymentsTable).values({
          userId,
          sessionId,
          amount: price.toFixed(2),
          currency: "LYD",
          method: "wallet",
          status: "completed",
          notes: `Live session registration: ${session.title}`,
        });

        // Claim the seat
        await tx.insert(sessionRegistrationsTable).values({ sessionId, userId });
      });
    } else {
      // ── Free session: just claim the seat ────────────────────────────────
      await db.insert(sessionRegistrationsTable).values({ sessionId, userId });
    }

    res.json({ success: true });
  } catch (err: any) {
    serverError(res, err);
  }
});

// Join session — returns embedded room info (only if registered or teacher)
router.post("/sessions/:id/join", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const sessionId = parseParam(req.params.id);
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, sessionId)).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    // Block joining cancelled sessions
    if (session.status === "cancelled") {
      res.status(403).json({ error: "This session has been cancelled", cancellationReason: session.cancellationReason });
      return;
    }

    // Block joining ended sessions
    if (session.status === "ended") {
      res.status(403).json({ error: "This session has already ended" });
      return;
    }

    const isTeacher = session.teacherId === userId;

    // ── Time-window guard: students cannot join more than 10 min early ───────
    if (!isTeacher && session.status === "scheduled") {
      const now = Date.now();
      const startMs = new Date(session.scheduledAt).getTime();
      const EARLY_ENTRY_MS = 10 * 60 * 1000; // 10 minutes
      if (now < startMs - EARLY_ENTRY_MS) {
        res.status(403).json({
          error: "Session has not started yet",
          scheduledAt: session.scheduledAt,
          startsInMs: startMs - now,
        });
        return;
      }
    }

    const existing = await db.select().from(sessionRegistrationsTable)
      .where(and(eq(sessionRegistrationsTable.sessionId, sessionId), eq(sessionRegistrationsTable.userId, userId)))
      .limit(1);

    if (!isTeacher && existing.length === 0 && parseFloat(session.price) > 0) {
      res.status(403).json({ error: "You must register for this session first" }); return;
    }

    // Auto-register if free and not registered
    if (!isTeacher && existing.length === 0) {
      const [registeredCount] = await db.select({ total: count() }).from(sessionRegistrationsTable)
        .where(eq(sessionRegistrationsTable.sessionId, sessionId));
      if (Number(registeredCount.total) >= session.maxParticipants) {
        res.status(400).json({ error: "Session is full" }); return;
      }
      await db.insert(sessionRegistrationsTable).values({ sessionId, userId, joinedAt: new Date() });
    } else if (existing.length > 0) {
      await db.update(sessionRegistrationsTable)
        .set({ joinedAt: new Date() })
        .where(and(eq(sessionRegistrationsTable.sessionId, sessionId), eq(sessionRegistrationsTable.userId, userId)));
    }

    // Generate a stable, deterministic room ID for this session.
    const roomId = session.meetingUrl || `edulibya-${sessionId}-${crypto.createHash("md5").update(sessionId.toString()).digest("hex").slice(0, 8)}`;

    // Persist the room ID and mark session as live when teacher joins
    if (isTeacher && session.status !== "live") {
      await db.update(liveSessionsTable)
        .set({ meetingUrl: roomId, status: "live" })
        .where(eq(liveSessionsTable.id, sessionId));
    } else if (!session.meetingUrl) {
      await db.update(liveSessionsTable)
        .set({ meetingUrl: roomId })
        .where(eq(liveSessionsTable.id, sessionId));
    }

    // Generate LiveKit token
    const livekitApiKey = process.env.LIVEKIT_API_KEY || "devkey";
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || "secret";
    const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880";

    // Fetch user display name from DB
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const displayName = user?.fullName || (isTeacher ? "Teacher" : "Student");

    // Build a signed JWT that grants the participant access to the room
    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: `user-${userId}`,
      name: displayName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      // Teachers can publish (camera + mic). Students can also publish to allow raising hand / mic.
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    res.json({ roomId, sessionId, isTeacher, token, livekitUrl });
  } catch (err: any) {
    serverError(res, err);
  }
});

// Q&A — get questions for a session
router.get("/sessions/:id/questions", requireAuth, async (req, res) => {
  try {
    const sessionId = parseParam(req.params.id);
    const questions = await db.select({
      id: sessionQuestionsTable.id,
      sessionId: sessionQuestionsTable.sessionId,
      userId: sessionQuestionsTable.userId,
      question: sessionQuestionsTable.question,
      upvotes: sessionQuestionsTable.upvotes,
      answered: sessionQuestionsTable.answered,
      createdAt: sessionQuestionsTable.createdAt,
      userName: usersTable.fullName
    })
    .from(sessionQuestionsTable)
    .leftJoin(usersTable, eq(sessionQuestionsTable.userId, usersTable.id))
    .where(eq(sessionQuestionsTable.sessionId, sessionId))
    .orderBy(desc(sessionQuestionsTable.upvotes));
    
    const result = questions.map(q => ({
      ...q,
      userName: q.userName || "Anonymous"
    }));
    
    res.json(result);
  } catch (err: any) {
    serverError(res, err);
  }
});

// Q&A — submit question
router.post("/sessions/:id/questions", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const sessionId = parseParam(req.params.id);
    const { question } = req.body;
    const [q] = await db.insert(sessionQuestionsTable).values({ sessionId, userId, question }).returning();
    res.status(201).json(q);
  } catch (err: any) {
    serverError(res, err);
  }
});

// Q&A — upvote question
router.post("/sessions/:id/questions/:qId/upvote", requireAuth, async (req, res) => {
  try {
    const qId = parseParam(req.params.qId);
    const [q] = await db.select().from(sessionQuestionsTable).where(eq(sessionQuestionsTable.id, qId)).limit(1);
    if (!q) { res.status(404).json({ error: "Question not found" }); return; }
    await db.update(sessionQuestionsTable)
      .set({ upvotes: sql`${sessionQuestionsTable.upvotes} + 1` })
      .where(eq(sessionQuestionsTable.id, qId));
    res.json({ success: true });
  } catch (err: any) {
    serverError(res, err);
  }
});

// Q&A — mark answered (teacher only)
router.post("/sessions/:id/questions/:qId/answer", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const sessionId = parseParam(req.params.id);
    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, sessionId)).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    if (session.teacherId !== userId) { res.status(403).json({ error: "Only the teacher can mark questions as answered" }); return; }

    await db.update(sessionQuestionsTable).set({ answered: true }).where(eq(sessionQuestionsTable.id, parseParam(req.params.qId)));
    res.json({ success: true });
  } catch (err: any) {
    serverError(res, err);
  }
});

// Save Recording URL
router.post("/sessions/:id/recording", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const sessionId = parseParam(req.params.id);
    const { recordingUrl } = req.body;

    const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, sessionId)).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    if (session.teacherId !== userId) {
      res.status(403).json({ error: "Only the teacher can save the recording" }); return;
    }

    await db.update(liveSessionsTable)
      .set({ recordingUrl })
      .where(eq(liveSessionsTable.id, sessionId));

    res.json({ success: true, recordingUrl });
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
