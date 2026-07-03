import { Router } from "express";
import { db } from "@workspace/db";
import {
  paymentsTable,
  teacherEarningsTable,
  enrollmentsTable,
  coursesTable,
  liveSessionsTable,
  usersTable,
  platformSettingsTable,
  redeemCardsTable,
  withdrawalRequestsTable,
  tutoringRequestsTable,
} from "@workspace/db";
import { eq, and, or, sum, count, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { PLANS } from "../lib/plans.js";
import type { TeacherTier } from "../lib/plans.js";

const router = Router();

async function creditTeacher(paymentId: number, teacherId: number, amount: number, courseId?: number, sessionId?: number, currency = "LYD") {
  let platformFeePercent = 20; // Default
  try {
    const [setting] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "teacher_commission_percent")).limit(1);
    if (setting && setting.value) {
      const parsed = parseFloat(setting.value);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        platformFeePercent = parsed;
      }
    } else {
      // Auto-seed if missing
      await db.insert(platformSettingsTable).values({ key: "teacher_commission_percent", value: "20", description: "Default platform commission fee percentage" });
    }
  } catch (err) {
    console.error("Failed to read platform settings", err);
  }

  const platformFee = parseFloat((amount * platformFeePercent / 100).toFixed(2));
  const netAmount = parseFloat((amount - platformFee).toFixed(2));
  await db.transaction(async (tx) => {
    await tx.insert(teacherEarningsTable).values({
      teacherId,
      paymentId,
      courseId: courseId || null,
      sessionId: sessionId || null,
      grossAmount: amount.toFixed(2),
      platformFeePercent: platformFeePercent.toFixed(2),
      platformFee: platformFee.toFixed(2),
      netAmount: netAmount.toFixed(2),
      currency,
      status: "available",
    });

    const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
    if (teacher) {
      const newBalance = (parseFloat(teacher.balance as string) || 0) + netAmount;
      await tx.update(usersTable)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(usersTable.id, teacherId));
    }
  });
}

// --- Automated Payment Gateway Simulation ---

router.post("/create-session", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { type, itemId } = req.body; // type: 'course' or 'session', itemId: number

    let amount = 0;
    let currency = "LYD";
    let course = null;
    let session = null;

    if (type === "course") {
      [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, itemId)).limit(1);
      if (!course) { res.status(404).json({ error: "Course not found" }); return; }
      
      const existing = await db.select().from(enrollmentsTable)
        .where(and(eq(enrollmentsTable.courseId, itemId), eq(enrollmentsTable.userId, userId)))
        .limit(1);
      if (existing.length > 0) { res.status(400).json({ error: "Already enrolled" }); return; }
      
      amount = parseFloat(course.price);
      currency = course.currency || "LYD";
    } else if (type === "session") {
      [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, itemId)).limit(1);
      if (!session) { res.status(404).json({ error: "Session not found" }); return; }
      amount = parseFloat(session.price);
    } else {
      res.status(400).json({ error: "Invalid type" }); return;
    }

    if (amount === 0) {
      // Free item, auto-enroll
      if (type === "course") {
        await db.insert(enrollmentsTable).values({ courseId: itemId, userId, progress: "0" });
      }
      return void res.json({ url: "/dashboard?success=true" });
    }

    const method = req.body.method || "bank_transfer";

    if (method === "wallet") {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const balance = parseFloat(student?.balance as string) || 0;
      
      if (balance < amount) {
        res.status(400).json({ error: "Insufficient wallet balance" });
        return;
      }

      await db.transaction(async (tx) => {
        // Deduct balance
        const newBalance = balance - amount;
        await tx.update(usersTable).set({ balance: newBalance.toFixed(2), updatedAt: new Date() }).where(eq(usersTable.id, userId));

        // Create payment
        const [payment] = await tx.insert(paymentsTable).values({
          userId,
          courseId: type === "course" ? itemId : null,
          sessionId: type === "session" ? itemId : null,
          amount: amount.toFixed(2),
          currency,
          method: "wallet",
          status: "completed",
          reference: `WALLET-${Date.now()}`,
        }).returning();

        // Enroll or credit teacher
        if (type === "course") {
          await tx.insert(enrollmentsTable).values({ courseId: itemId, userId, progress: "0" });
          if (course) {
             let platformFeePercent = 20;
             try {
               const [setting] = await tx.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "teacher_commission_percent")).limit(1);
               if (setting && setting.value) platformFeePercent = parseFloat(setting.value);
             } catch (e) {}
             const platformFee = parseFloat((amount * platformFeePercent / 100).toFixed(2));
             const netAmount = parseFloat((amount - platformFee).toFixed(2));
             await tx.insert(teacherEarningsTable).values({
               teacherId: course.teacherId, paymentId: payment.id, courseId: course.id,
               grossAmount: amount.toFixed(2), platformFeePercent: platformFeePercent.toFixed(2), platformFee: platformFee.toFixed(2), netAmount: netAmount.toFixed(2), currency: course.currency || "LYD", status: "available"
             });
             const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
             if (teacher) {
               const newBalance = (parseFloat(teacher.balance as string) || 0) + netAmount;
               await tx.update(usersTable).set({ balance: newBalance.toFixed(2), updatedAt: new Date() }).where(eq(usersTable.id, course.teacherId));
             }
          }
        }
        
        if (type === "session" && session) {
             let platformFeePercent = 20;
             try {
               const [setting] = await tx.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "teacher_commission_percent")).limit(1);
               if (setting && setting.value) platformFeePercent = parseFloat(setting.value);
             } catch (e) {}
             const platformFee = parseFloat((amount * platformFeePercent / 100).toFixed(2));
             const netAmount = parseFloat((amount - platformFee).toFixed(2));
             await tx.insert(teacherEarningsTable).values({
               teacherId: session.teacherId, paymentId: payment.id, sessionId: session.id,
               grossAmount: amount.toFixed(2), platformFeePercent: platformFeePercent.toFixed(2), platformFee: platformFee.toFixed(2), netAmount: netAmount.toFixed(2), currency: "LYD", status: "available"
             });
             const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, session.teacherId)).limit(1);
             if (teacher) {
               const newBalance = (parseFloat(teacher.balance as string) || 0) + netAmount;
               await tx.update(usersTable).set({ balance: newBalance.toFixed(2), updatedAt: new Date() }).where(eq(usersTable.id, session.teacherId));
             }
        }
      });
      return void res.json({ url: "/dashboard?success=true" });
    }

    // Paid item, create pending payment session
    const [payment] = await db.insert(paymentsTable).values({
      userId,
      courseId: type === "course" ? itemId : null,
      sessionId: type === "session" ? itemId : null,
      amount: amount.toFixed(2),
      currency,
      method: "bank_transfer",
      status: "pending",
      reference: `SESS-${Date.now()}`,
    }).returning();

    // In a real integration (Stripe/Sadad), this URL is returned from the provider's API.
    // Here we generate our local simulation URL.
    const checkoutUrl = `/api/payments/mock-gateway?paymentId=${payment.id}`;
    
    res.json({ url: checkoutUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// --- Subscription Plan Upgrades ---
router.post("/upgrade-plan", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { targetTier } = req.body;

    if (!targetTier || !["bronze", "golden", "diamond"].includes(targetTier)) {
      res.status(400).json({ error: "Invalid target tier" });
      return;
    }

    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!teacher || teacher.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can upgrade plans" });
      return;
    }

    const currentTier = (teacher.tier as TeacherTier) || "free";
    const currentPrice = PLANS[currentTier].pricePerMonthLYD;
    const targetPrice = PLANS[targetTier as TeacherTier].pricePerMonthLYD;

    const difference = targetPrice - currentPrice;

    if (difference <= 0) {
      res.status(400).json({ error: "Cannot upgrade to a lower or equal tier. Please contact support to downgrade." });
      return;
    }

    // Create a pending payment session for the difference
    const [payment] = await db.insert(paymentsTable).values({
      userId,
      amount: difference.toFixed(2),
      currency: "LYD",
      method: "bank_transfer",
      status: "pending",
      reference: `UPGRADE-${targetTier}`,
    }).returning();

    const checkoutUrl = `/api/payments/mock-gateway?paymentId=${payment.id}`;
    res.json({ url: checkoutUrl, amount: difference });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/mock-gateway", requireAuth, (req, res) => {
  const paymentId = req.query.paymentId;
  // This serves a small HTML page to simulate an external provider like Sadad or Stripe.
  res.send(`
    <html>
      <head>
        <title>Secure Payment Gateway</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f9fafb; margin: 0; }
          .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; width: 100%; border-top: 4px solid #0ea5e9; }
          h2 { margin-top: 0; color: #0f172a; }
          button { background: #0ea5e9; color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.1rem; font-weight: bold; cursor: pointer; width: 100%; margin-top: 1rem; }
          button:hover { background: #0284c7; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Secure Payment</h2>
          <p>You are about to authorize a payment for Libyan Learn Hub.</p>
          <form action="/api/payments/callback" method="GET">
            <input type="hidden" name="paymentId" value="${paymentId}" />
            <input type="hidden" name="status" value="success" />
            <button type="submit">Pay Now</button>
          </form>
          <form action="/api/payments/callback" method="GET" style="margin-top: 0.5rem;">
            <input type="hidden" name="paymentId" value="${paymentId}" />
            <input type="hidden" name="status" value="cancel" />
            <button type="submit" style="background: white; color: #64748b; border: 1px solid #cbd5e1;">Cancel</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

router.get("/callback", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const paymentId = parseInt(req.query.paymentId as string);
    const status = req.query.status as string; // 'success' or 'cancel'

    if (isNaN(paymentId)) { res.status(400).send("Invalid payment ID"); return; }

    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).limit(1);
    if (!payment) { res.status(404).send("Payment not found"); return; }
    // Security: ensure the callback is for this user's own payment
    if (payment.userId !== userId) { res.status(403).send("Forbidden"); return; }
    if (payment.status === "completed") { res.redirect('/dashboard?success=true'); return; }

    if (status === "cancel") {
      await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.id, paymentId));
      res.redirect('/dashboard?error=payment_cancelled'); return;
    }

    // Success flow
    await db.update(paymentsTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(paymentsTable.id, paymentId));

    const amount = parseFloat(payment.amount);

    if (payment.courseId) {
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      const alreadyEnrolled = await db.select().from(enrollmentsTable)
        .where(and(eq(enrollmentsTable.courseId, payment.courseId), eq(enrollmentsTable.userId, payment.userId)))
        .limit(1);
      
      if (alreadyEnrolled.length === 0) {
        await db.insert(enrollmentsTable).values({ courseId: payment.courseId, userId: payment.userId, progress: "0" });
      }
      if (course) {
        await creditTeacher(paymentId, course.teacherId, amount, course.id, undefined, course.currency);
      }
    }

    if (payment.sessionId) {
      const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, payment.sessionId)).limit(1);
      if (session) {
        await creditTeacher(paymentId, session.teacherId, amount, undefined, session.id, "LYD");
      }
    }

    // Handle Subscription Upgrades
    if (payment.reference && payment.reference.startsWith("UPGRADE-")) {
      const newTier = payment.reference.replace("UPGRADE-", "") as TeacherTier;
      await db.update(usersTable)
        .set({ tier: newTier, updatedAt: new Date() })
        .where(eq(usersTable.id, payment.userId));
    }

    // Redirect to frontend success page
    res.redirect('/dashboard?success=true');
  } catch (err: any) {
    res.status(500).send("Server Error");
  }
});

// ─── REDEEM CARDS ─────────────────────────────────────────────────────────────

router.post("/redeem-code", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const [card] = await db.select().from(redeemCardsTable).where(and(eq(redeemCardsTable.code, code), eq(redeemCardsTable.status, "active"))).limit(1);

    if (!card) {
      res.status(400).json({ error: "Invalid or already redeemed card code" });
      return;
    }

    // Process redemption
    await db.transaction(async (tx) => {
      // 1. Mark card as redeemed
      await tx.update(redeemCardsTable)
        .set({ status: "redeemed", redeemedBy: userId, redeemedAt: new Date() })
        .where(eq(redeemCardsTable.id, card.id));

      // 2. Add balance to user
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const newBalance = (parseFloat(user.balance as string) || 0) + parseFloat(card.value as string);
      
      await tx.update(usersTable)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(usersTable.id, userId));

      // 3. Optional: Add a payment record for history
      await tx.insert(paymentsTable).values({
        userId,
        amount: card.value,
        currency: "LYD",
        method: "redeem_card",
        status: "completed",
        reference: `REDEEM-${card.code}`,
      });
    });

    res.json({ success: true, message: "Card redeemed successfully", value: card.value });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ─── TEACHER WITHDRAWALS ──────────────────────────────────────────────────────

router.post("/withdrawals", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { amount, paymentMethod, details } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }
    if (!details) {
      res.status(400).json({ error: "Payment details are required" });
      return;
    }

    // Verify teacher role
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!teacher || teacher.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can request withdrawals" });
      return;
    }

    // Subtract any existing pending withdrawal requests
    const pendingRequests = await db.select().from(withdrawalRequestsTable)
      .where(and(eq(withdrawalRequestsTable.teacherId, userId), eq(withdrawalRequestsTable.status, "pending")));
    const pendingWithdrawalsAmount = pendingRequests.reduce((s, r) => s + parseFloat(r.amount as string), 0);

    // Available to withdraw is the wallet balance minus any pending withdrawal requests
    const netAvailable = parseFloat(teacher.balance as string || "0") - pendingWithdrawalsAmount;

    if (parseFloat(amount) > netAvailable) {
      res.status(400).json({ error: `Insufficient available balance. Available: ${netAvailable.toFixed(2)} LYD` });
      return;
    }

    const [request] = await db.insert(withdrawalRequestsTable).values({
      teacherId: userId,
      amount: parseFloat(amount).toFixed(2),
      paymentMethod: paymentMethod || "bank_transfer",
      details,
      status: "pending",
    }).returning();

    res.status(201).json({ success: true, request });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/withdrawals/me", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const requests = await db
      .select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.teacherId, userId))
      .orderBy(desc(withdrawalRequestsTable.createdAt));

    res.json(requests.map(r => ({
      ...r,
      amount: parseFloat(r.amount as string),
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});


router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.userId, userId));
    res.json(payments.map(p => ({ ...p, amount: parseFloat(p.amount) })));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/earnings", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    
    // Get teacher's wallet balance
    const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const balance = parseFloat(teacher.balance as string || "0");

    // Get pending withdrawals
    const pendingRequests = await db.select().from(withdrawalRequestsTable)
      .where(and(eq(withdrawalRequestsTable.teacherId, userId), eq(withdrawalRequestsTable.status, "pending")));
    const pendingWithdrawalsAmount = pendingRequests.reduce((s, r) => s + parseFloat(r.amount as string), 0);

    const earnings = await db.select().from(teacherEarningsTable).where(eq(teacherEarningsTable.teacherId, userId));
    
    // Total earned is the sum of all earnings
    const totalEarnings = earnings.reduce((s, e) => s + parseFloat(e.netAmount), 0);
    // Available to withdraw is the actual wallet balance minus pending withdrawals
    const available = balance - pendingWithdrawalsAmount;
    
    const pending = earnings.filter(e => e.status === "pending").reduce((s, e) => s + parseFloat(e.netAmount), 0);
    
    // Total withdrawn is the sum of all approved/paid withdrawal requests
    const approvedRequests = await db.select().from(withdrawalRequestsTable)
      .where(and(eq(withdrawalRequestsTable.teacherId, userId), or(eq(withdrawalRequestsTable.status, "approved"), eq(withdrawalRequestsTable.status, "paid"))));
    const paid = approvedRequests.reduce((s, r) => s + parseFloat(r.amount as string), 0);
    
    const entries = await Promise.all(earnings.map(async (e) => {
      let itemName = "–";
      if (e.courseId) {
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1);
        itemName = course?.title || `Course #${e.courseId}`;
      } else if (e.sessionId) {
        const [session] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, e.sessionId)).limit(1);
        itemName = session?.title || `Live Session #${e.sessionId}`;
      } else if (e.tutoringRequestId) {
        const [tutoring] = await db.select().from(tutoringRequestsTable).where(eq(tutoringRequestsTable.id, e.tutoringRequestId)).limit(1);
        itemName = tutoring?.subject || `1-to-1 Tutoring #${e.tutoringRequestId}`;
      }
      return {
        id: e.id,
        courseId: e.courseId,
        sessionId: e.sessionId,
        tutoringRequestId: e.tutoringRequestId,
        itemName,
        gross: parseFloat(e.grossAmount),
        platformFee: parseFloat(e.platformFee),
        net: parseFloat(e.netAmount),
        currency: e.currency,
        status: e.status,
        createdAt: e.createdAt,
      };
    }));

    res.json({
      total: parseFloat(totalEarnings.toFixed(2)),
      available: parseFloat(available.toFixed(2)),
      pending: parseFloat(pending.toFixed(2)),
      paid: parseFloat(paid.toFixed(2)),
      entries,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
