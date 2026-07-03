import { db } from "@workspace/db";
import {
  enrollmentsTable,
  coursesTable,
  usersTable,
  teacherEarningsTable,
  platformSettingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Course } from "@workspace/db";

export const SUBSCRIPTION_DURATIONS = [1, 3, 6, 12] as const;
export type SubscriptionDuration = (typeof SUBSCRIPTION_DURATIONS)[number];

export function isValidDuration(value: unknown): value is SubscriptionDuration {
  return typeof value === "number" && (SUBSCRIPTION_DURATIONS as readonly number[]).includes(value);
}

/** Price for the given duration, or null if the course has no price for it. */
export function getPlanPrice(course: Course, durationMonths: SubscriptionDuration): number | null {
  const raw =
    durationMonths === 1 ? course.priceMonth1 :
    durationMonths === 3 ? course.priceMonth3 :
    durationMonths === 6 ? course.priceMonth6 :
    course.priceMonth12;
  if (raw === null || raw === undefined) return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

/** A course is free when its legacy price is 0 (subscription prices are null on free courses). */
export function isFreeCourse(course: Course): boolean {
  return (parseFloat(course.price) || 0) === 0;
}

/**
 * Parse the subscription plan prices from a request body.
 * Returns normalized string values for DB storage, or an error payload if a
 * paid course is missing any of the 4 required plan prices.
 */
export function parsePlanPrices(body: any): {
  error?: { error: string; message: string; messageAr: string };
  values?: { price: string; priceMonth1: string | null; priceMonth3: string | null; priceMonth6: string | null; priceMonth12: string | null };
} {
  const p1 = body.priceMonth1 !== undefined && body.priceMonth1 !== null && body.priceMonth1 !== "" ? parseFloat(body.priceMonth1) : null;
  const p3 = body.priceMonth3 !== undefined && body.priceMonth3 !== null && body.priceMonth3 !== "" ? parseFloat(body.priceMonth3) : null;
  const p6 = body.priceMonth6 !== undefined && body.priceMonth6 !== null && body.priceMonth6 !== "" ? parseFloat(body.priceMonth6) : null;
  const p12 = body.priceMonth12 !== undefined && body.priceMonth12 !== null && body.priceMonth12 !== "" ? parseFloat(body.priceMonth12) : null;

  let anySet = [p1, p3, p6, p12].some((p) => p !== null && p > 0);

  // Backward compat: an older client sending only the legacy `price` field.
  // Derive the plan prices with the standard discount curve (same as migration).
  if (!anySet && body.price !== undefined && parseFloat(body.price) > 0) {
    const base = parseFloat(body.price);
    return {
      values: {
        price: base.toFixed(2),
        priceMonth1: base.toFixed(2),
        priceMonth3: (base * 2.7).toFixed(2),
        priceMonth6: (base * 5).toFixed(2),
        priceMonth12: (base * 9).toFixed(2),
      },
    };
  }

  const isFree = !anySet;

  if (isFree) {
    return { values: { price: "0", priceMonth1: null, priceMonth3: null, priceMonth6: null, priceMonth12: null } };
  }

  const allValid = [p1, p3, p6, p12].every((p) => p !== null && !isNaN(p) && p > 0);
  if (!allValid) {
    return {
      error: {
        error: "Missing subscription prices",
        message: "A paid course must set prices for all four subscription durations (1, 3, 6, and 12 months).",
        messageAr: "يجب تحديد أسعار جميع مدد الاشتراك الأربع (شهر، 3 أشهر، 6 أشهر، 12 شهرًا) للدورة المدفوعة.",
      },
    };
  }

  return {
    values: {
      price: p1!.toFixed(2), // legacy "from" price mirrors the 1-month price
      priceMonth1: p1!.toFixed(2),
      priceMonth3: p3!.toFixed(2),
      priceMonth6: p6!.toFixed(2),
      priceMonth12: p12!.toFixed(2),
    },
  };
}

/** True when a paid course is missing any of the 4 subscription prices (blocks publishing). */
export function hasIncompletePlanPrices(course: Course): boolean {
  if (isFreeCourse(course)) return false;
  return (
    !course.priceMonth1 || parseFloat(course.priceMonth1) <= 0 ||
    !course.priceMonth3 || parseFloat(course.priceMonth3) <= 0 ||
    !course.priceMonth6 || parseFloat(course.priceMonth6) <= 0 ||
    !course.priceMonth12 || parseFloat(course.priceMonth12) <= 0
  );
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Insert or extend a subscription enrollment inside an existing transaction.
 * - New enrollment: starts now, expires now + duration.
 * - Existing enrollment (renewal/upgrade): extends from max(now, current expiry) — paid time is never lost.
 * Resets notification stamps so expiry warnings fire again for the new period.
 */
export async function applyCourseSubscription(
  tx: Tx,
  opts: { userId: number; courseId: number; durationMonths: SubscriptionDuration; paymentId: number },
): Promise<void> {
  const { userId, courseId, durationMonths, paymentId } = opts;
  const now = new Date();

  const [existing] = await tx
    .select()
    .from(enrollmentsTable)
    .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)))
    .limit(1);

  if (existing) {
    const base =
      existing.expiresAt && existing.expiresAt > now ? new Date(existing.expiresAt) : new Date(now);
    base.setMonth(base.getMonth() + durationMonths);
    await tx
      .update(enrollmentsTable)
      .set({
        subscriptionMonths: durationMonths,
        startedAt: existing.startedAt ?? now,
        expiresAt: base,
        lastPaymentId: paymentId,
        renewalCount: (existing.renewalCount ?? 0) + 1,
        expiryNotifiedAt: null,
        expiredNotifiedAt: null,
      })
      .where(eq(enrollmentsTable.id, existing.id));
  } else {
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
    await tx.insert(enrollmentsTable).values({
      courseId,
      userId,
      progress: "0",
      subscriptionMonths: durationMonths,
      startedAt: now,
      expiresAt,
      lastPaymentId: paymentId,
    });
  }
}

/**
 * Credit a teacher for a completed payment INSIDE an existing transaction.
 * Extracted from the previously-duplicated blocks in payments.ts (wallet + callback flows).
 */
export async function creditTeacherInTx(
  tx: Tx,
  opts: {
    teacherId: number;
    paymentId: number;
    amount: number;
    courseId?: number | null;
    sessionId?: number | null;
    liveSessionCourseId?: number | null;
    currency?: string;
  },
): Promise<void> {
  let platformFeePercent = 20;
  try {
    const [setting] = await tx
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "teacher_commission_percent"))
      .limit(1);
    if (setting && setting.value) {
      const parsed = parseFloat(setting.value);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) platformFeePercent = parsed;
    }
  } catch (err) {
    console.error("Failed to read platform commission setting", err);
  }

  const platformFee = parseFloat(((opts.amount * platformFeePercent) / 100).toFixed(2));
  const netAmount = parseFloat((opts.amount - platformFee).toFixed(2));

  await tx.insert(teacherEarningsTable).values({
    teacherId: opts.teacherId,
    paymentId: opts.paymentId,
    courseId: opts.courseId ?? null,
    sessionId: opts.sessionId ?? null,
    liveSessionCourseId: opts.liveSessionCourseId ?? null,
    grossAmount: opts.amount.toFixed(2),
    platformFeePercent: platformFeePercent.toFixed(2),
    platformFee: platformFee.toFixed(2),
    netAmount: netAmount.toFixed(2),
    currency: opts.currency || "LYD",
    status: "available",
  });

  const [teacher] = await tx.select().from(usersTable).where(eq(usersTable.id, opts.teacherId)).limit(1);
  if (teacher) {
    const newBalance = (parseFloat(teacher.balance as string) || 0) + netAmount;
    await tx
      .update(usersTable)
      .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
      .where(eq(usersTable.id, opts.teacherId));
  }
}

export type EnrollmentAccessResult =
  | { ok: true; enrollment: typeof enrollmentsTable.$inferSelect | null }
  | { ok: false; reason: "not_enrolled" | "expired"; expiredAt?: Date };

/**
 * Check whether a user currently has access to a course's paid content.
 * Active = enrollment exists AND (no expiry OR expiry in the future).
 * The course's own teacher and admins always pass.
 */
export async function requireActiveEnrollment(
  userId: number,
  courseId: number,
  role?: string,
): Promise<EnrollmentAccessResult> {
  if (role === "admin") return { ok: true, enrollment: null };

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
  if (course && course.teacherId === userId) return { ok: true, enrollment: null };

  const [enrollment] = await db
    .select()
    .from(enrollmentsTable)
    .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)))
    .limit(1);

  if (!enrollment) return { ok: false, reason: "not_enrolled" };
  if (enrollment.expiresAt && enrollment.expiresAt <= new Date()) {
    return { ok: false, reason: "expired", expiredAt: enrollment.expiresAt };
  }
  return { ok: true, enrollment };
}

/** Standard bilingual 403 payload for expired subscriptions. */
export const SUBSCRIPTION_EXPIRED_ERROR = {
  code: "SUBSCRIPTION_EXPIRED",
  error: "Subscription expired",
  message: "Your subscription to this course has expired. Renew to regain access.",
  messageAr: "انتهى اشتراكك في هذه الدورة. جدّد الاشتراك لاستعادة الوصول.",
};

export const NOT_ENROLLED_ERROR = {
  code: "NOT_ENROLLED",
  error: "Not enrolled",
  message: "You are not enrolled in this course.",
  messageAr: "أنت غير مسجّل في هذه الدورة.",
};
