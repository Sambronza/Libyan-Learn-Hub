import { Router } from "express";
import { serverError } from "../lib/http.js";
import { db } from "@workspace/db";
import { couponsTable, coursesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validateCoupon, generateCouponCode, ensureReferralCode } from "../lib/promotions.js";

const router = Router();

/** Validate a coupon for a course at checkout (returns the discounted price). */
router.post("/validate", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const { code, courseId, amount } = req.body;
    if (!code || !courseId || amount === undefined) {
      res.status(400).json({ error: "code, courseId and amount are required" });
      return;
    }
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }

    const result = await validateCoupon(code, userId, courseId, course.teacherId, parseFloat(amount));
    if (!result.ok) {
      res.status(400).json(result.error);
      return;
    }
    res.json({
      valid: true,
      discount: result.discount,
      finalAmount: result.finalAmount,
      type: result.coupon!.type,
      value: parseFloat(result.coupon!.value),
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

/** Teacher/admin: create a coupon. Teachers can only scope to their own courses. */
router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = req.user!;
    const { code, type, value, courseId, maxUses, expiresAt } = req.body;

    if (!["percent", "fixed"].includes(type)) { res.status(400).json({ error: "type must be percent or fixed" }); return; }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0 || (type === "percent" && numValue > 100)) {
      res.status(400).json({ error: "Invalid coupon value" });
      return;
    }

    // Teachers: coupon is bound to them; optional courseId must be their own course
    let teacherId: number | null = null;
    if (role === "teacher") {
      teacherId = userId;
      if (courseId) {
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
        if (!course || course.teacherId !== userId) {
          res.status(403).json({ error: "You can only create coupons for your own courses" });
          return;
        }
      }
    }

    const finalCode = (code ? String(code).trim().toUpperCase() : generateCouponCode()).slice(0, 40);
    const [existing] = await db.select().from(couponsTable).where(eq(couponsTable.code, finalCode)).limit(1);
    if (existing) { res.status(400).json({ error: "Coupon code already exists" }); return; }

    const [coupon] = await db.insert(couponsTable).values({
      code: finalCode,
      type,
      value: numValue.toFixed(2),
      courseId: courseId || null,
      teacherId,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: userId,
    }).returning();

    res.status(201).json(coupon);
  } catch (err: any) {
    serverError(res, err);
  }
});

/** Teacher: own coupons; admin: all coupons. */
router.get("/my", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = req.user!;
    const coupons = role === "admin"
      ? await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt))
      : await db.select().from(couponsTable).where(eq(couponsTable.createdBy, userId)).orderBy(desc(couponsTable.createdAt));
    res.json(coupons);
  } catch (err: any) {
    serverError(res, err);
  }
});

/** Deactivate a coupon (creator or admin). */
router.post("/:id/deactivate", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = req.user!;
    const id = parseInt(req.params.id as string);
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.id, id)).limit(1);
    if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
    if (role !== "admin" && coupon.createdBy !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    await db.update(couponsTable).set({ isActive: false }).where(eq(couponsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    serverError(res, err);
  }
});

/** My referral code + share link (lazily generated). */
router.get("/referral/my-code", requireAuth, async (req, res) => {
  try {
    const { userId } = req.user!;
    const code = await ensureReferralCode(userId);
    res.json({
      code,
      message: "Share this code — when a friend registers with it and makes their first purchase, you both get a wallet bonus.",
      messageAr: "شارك هذا الرمز — عندما يسجّل صديقك به ويقوم بأول عملية شراء، تحصلان معًا على رصيد في المحفظة.",
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
