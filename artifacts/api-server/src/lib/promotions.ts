import crypto from "crypto";
import { db } from "@workspace/db";
import {
  couponsTable,
  couponRedemptionsTable,
  usersTable,
  walletTransactionsTable,
  notificationsTable,
  paymentsTable,
  platformSettingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Coupon } from "@workspace/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Coupons ──────────────────────────────────────────────────────────────────

export interface CouponValidation {
  ok: boolean;
  coupon?: Coupon;
  discount?: number;
  finalAmount?: number;
  error?: { error: string; message: string; messageAr: string };
}

/** Validate a coupon for a user + course + base amount and compute the discount. */
export async function validateCoupon(
  code: string,
  userId: number,
  courseId: number,
  courseTeacherId: number,
  amount: number,
): Promise<CouponValidation> {
  const fail = (message: string, messageAr: string): CouponValidation => ({
    ok: false,
    error: { error: "Invalid coupon", message, messageAr },
  });

  const [coupon] = await db.select().from(couponsTable)
    .where(eq(couponsTable.code, code.trim().toUpperCase())).limit(1);

  if (!coupon || !coupon.isActive) return fail("This coupon code is not valid.", "رمز الخصم غير صالح.");
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) return fail("This coupon has expired.", "انتهت صلاحية رمز الخصم.");
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return fail("This coupon has reached its usage limit.", "وصل رمز الخصم إلى حد الاستخدام.");
  }
  // Scope checks
  if (coupon.courseId !== null && coupon.courseId !== courseId) {
    return fail("This coupon does not apply to this course.", "لا ينطبق رمز الخصم على هذه الدورة.");
  }
  if (coupon.teacherId !== null && coupon.teacherId !== courseTeacherId) {
    return fail("This coupon does not apply to this course.", "لا ينطبق رمز الخصم على هذه الدورة.");
  }
  // One use per user
  const [used] = await db.select().from(couponRedemptionsTable)
    .where(and(eq(couponRedemptionsTable.couponId, coupon.id), eq(couponRedemptionsTable.userId, userId)))
    .limit(1);
  if (used) return fail("You have already used this coupon.", "لقد استخدمت هذا الرمز من قبل.");

  const value = parseFloat(coupon.value);
  const discount = coupon.type === "percent"
    ? parseFloat(((amount * Math.min(value, 100)) / 100).toFixed(2))
    : Math.min(value, amount);
  const finalAmount = parseFloat(Math.max(0, amount - discount).toFixed(2));

  return { ok: true, coupon, discount, finalAmount };
}

/** Record a coupon redemption inside a payment transaction. */
export async function recordCouponRedemption(
  tx: Tx,
  opts: { couponId: number; userId: number; paymentId: number; discount: number },
): Promise<void> {
  await tx.insert(couponRedemptionsTable).values({
    couponId: opts.couponId,
    userId: opts.userId,
    paymentId: opts.paymentId,
    discount: opts.discount.toFixed(2),
  });
  const [coupon] = await tx.select().from(couponsTable).where(eq(couponsTable.id, opts.couponId)).limit(1);
  if (coupon) {
    await tx.update(couponsTable)
      .set({ usedCount: (coupon.usedCount ?? 0) + 1 })
      .where(eq(couponsTable.id, opts.couponId));
  }
}

export function generateCouponCode(prefix = "EDU"): string {
  return `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// ── Referrals ────────────────────────────────────────────────────────────────

export function generateReferralCode(): string {
  return `REF${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Get (or lazily create) the user's referral code. */
export async function ensureReferralCode(userId: number): Promise<string> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.referralCode) return user.referralCode;
  const code = generateReferralCode();
  await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, userId));
  return code;
}

async function getReferralBonus(): Promise<number> {
  try {
    const [setting] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "referral_bonus_lyd")).limit(1);
    if (setting?.value) {
      const parsed = parseFloat(setting.value);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    } else {
      await db.insert(platformSettingsTable)
        .values({ key: "referral_bonus_lyd", value: "10", description: "Wallet credit (LYD) for referrer and referred user on first purchase" })
        .onConflictDoNothing();
    }
  } catch {}
  return 10;
}

/**
 * On a referred user's FIRST completed purchase: credit both the new user and
 * their referrer with the referral bonus. Runs OUTSIDE the payment transaction
 * (best-effort; a failure here must not fail the purchase).
 */
export async function processReferralBonus(buyerId: number): Promise<void> {
  try {
    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, buyerId)).limit(1);
    if (!buyer?.referredBy || buyer.referralRewarded) return;

    const [referrer] = await db.select().from(usersTable).where(eq(usersTable.id, buyer.referredBy)).limit(1);
    if (!referrer) return;

    const bonus = await getReferralBonus();
    if (bonus <= 0) return;

    await db.transaction(async (tx) => {
      // Mark first, so concurrent purchases can't double-reward
      const updated = await tx.update(usersTable)
        .set({ referralRewarded: true })
        .where(and(eq(usersTable.id, buyerId), eq(usersTable.referralRewarded, false)))
        .returning({ id: usersTable.id });
      if (updated.length === 0) return; // already rewarded concurrently

      for (const person of [buyer, referrer]) {
        const [fresh] = await tx.select().from(usersTable).where(eq(usersTable.id, person.id)).limit(1);
        const newBalance = (parseFloat(fresh.balance as string) || 0) + bonus;
        await tx.update(usersTable)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(usersTable.id, person.id));
        await tx.insert(walletTransactionsTable).values({
          userId: person.id,
          amount: bonus.toFixed(2),
          type: "credit",
          referenceType: "referral_bonus",
          referenceId: buyerId,
          description: person.id === buyerId
            ? "Referral welcome bonus – first purchase"
            : `Referral bonus – ${buyer.fullName} made their first purchase`,
        });
      }
    });

    await db.insert(notificationsTable).values([
      {
        userId: buyerId,
        type: "system_alert" as const,
        title: "Referral Bonus!",
        titleAr: "مكافأة الإحالة!",
        message: `You received ${bonus} LYD in your wallet for joining through a friend's invite.`,
        messageAr: `حصلت على ${bonus} د.ل في محفظتك لانضمامك عبر دعوة صديق.`,
      },
      {
        userId: referrer.id,
        type: "system_alert" as const,
        title: "Referral Bonus!",
        titleAr: "مكافأة الإحالة!",
        message: `${buyer.fullName} made their first purchase — ${bonus} LYD was added to your wallet.`,
        messageAr: `قام ${buyer.fullName} بأول عملية شراء — أُضيف ${bonus} د.ل إلى محفظتك.`,
      },
    ]);
  } catch (err) {
    console.error("Referral bonus processing failed (non-fatal):", err);
  }
}
