import { db } from "@workspace/db";
import { studentDevicesTable, platformSettingsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { StudentDevice, User } from "@workspace/db";

/** Bilingual error payloads used by login and verification flows. */
export const ACCOUNT_BLOCKED_ERROR = {
  code: "ACCOUNT_BLOCKED",
  error: "Account blocked",
  message:
    "Your account has been blocked due to a failed identity check. Please contact support to regain access.",
  messageAr: "تم حظر حسابك بسبب فشل التحقق من الهوية. يرجى التواصل مع الدعم لاستعادة الوصول.",
};

export const NEW_DEVICE_ERROR = {
  code: "NEW_DEVICE",
  error: "New device detected",
  message:
    "You are logging in from a new device. If you continue, your previous device will be blocked from accessing this account, and you must pass a face identity check. You will also need to re-verify your identity periodically for the next two weeks.",
  messageAr:
    "أنت تسجّل الدخول من جهاز جديد. إذا تابعت، سيتم حظر جهازك السابق من الوصول إلى هذا الحساب، ويجب عليك اجتياز فحص التعرف على الوجه. كما ستحتاج إلى إعادة التحقق من هويتك بشكل دوري خلال الأسبوعين القادمين.",
};

export const REVERIFY_REQUIRED_ERROR = {
  code: "REVERIFY_REQUIRED",
  error: "Identity re-verification required",
  message: "Please complete a quick face check to confirm your identity before continuing.",
  messageAr: "يرجى إكمال فحص سريع للوجه لتأكيد هويتك قبل المتابعة.",
};

export const FACE_MISMATCH_ERROR = {
  code: "FACE_MISMATCH",
  error: "Face verification failed",
  message:
    "We could not confirm your identity. Your account has been blocked and a review request was sent to the administrators.",
  messageAr: "لم نتمكن من تأكيد هويتك. تم حظر حسابك وتم إرسال طلب مراجعة إلى المشرفين.",
};

async function getSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, key))
      .limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** Feature flag: device binding only enforced when platform setting is "on". */
export async function isDeviceEnforcementEnabled(): Promise<boolean> {
  return (await getSetting("student_device_enforcement")) === "on";
}

export async function getReverifySettings(): Promise<{ intervalDays: number; windowDays: number }> {
  const interval = parseInt((await getSetting("student_reverify_interval_days")) || "3");
  const window = parseInt((await getSetting("student_reverify_window_days")) || "14");
  return {
    intervalDays: isNaN(interval) || interval < 1 ? 3 : interval,
    windowDays: isNaN(window) || window < 1 ? 14 : window,
  };
}

export async function getTrustedDevice(studentId: number): Promise<StudentDevice | null> {
  const [device] = await db
    .select()
    .from(studentDevicesTable)
    .where(and(eq(studentDevicesTable.studentId, studentId), eq(studentDevicesTable.status, "trusted")))
    .limit(1);
  return device ?? null;
}

/** Register a device as the student's trusted device (used at signup / grandfathering). */
export async function registerTrustedDevice(opts: {
  studentId: number;
  fingerprint: string;
  deviceName?: string | null;
  platform?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<StudentDevice> {
  const [device] = await db
    .insert(studentDevicesTable)
    .values({
      studentId: opts.studentId,
      deviceFingerprint: opts.fingerprint,
      deviceName: opts.deviceName ?? null,
      platform: opts.platform ?? null,
      lastIp: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      status: "trusted",
      trustedAt: new Date(),
      lastUsedAt: new Date(),
    })
    .returning();
  return device;
}

/**
 * Perform a verified device switch: block the old trusted device, trust the new
 * one, and open the periodic re-verification window on the user.
 */
export async function performDeviceSwitch(opts: {
  studentId: number;
  newFingerprint: string;
  deviceName?: string | null;
  platform?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { intervalDays, windowDays } = await getReverifySettings();
  const now = new Date();

  await db.transaction(async (tx) => {
    // Block ALL currently-trusted devices (there should be exactly one)
    await tx
      .update(studentDevicesTable)
      .set({ status: "blocked", blockedAt: now })
      .where(and(eq(studentDevicesTable.studentId, opts.studentId), eq(studentDevicesTable.status, "trusted")));

    await tx.insert(studentDevicesTable).values({
      studentId: opts.studentId,
      deviceFingerprint: opts.newFingerprint,
      deviceName: opts.deviceName ?? null,
      platform: opts.platform ?? null,
      lastIp: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      status: "trusted",
      trustedAt: now,
      lastUsedAt: now,
    });

    // Open the re-verification window
    await tx
      .update(usersTable)
      .set({
        reverifyUntil: new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000),
        nextReverifyAt: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000),
        accountBlocked: false,
        accountBlockedReason: null,
        updatedAt: now,
      })
      .where(eq(usersTable.id, opts.studentId));
  });
}

/** Block a student account (face mismatch or admin action). */
export async function blockStudentAccount(studentId: number, reason: "face_mismatch" | "admin"): Promise<void> {
  await db
    .update(usersTable)
    .set({ accountBlocked: true, accountBlockedReason: reason, updatedAt: new Date() })
    .where(eq(usersTable.id, studentId));
}

/** Whether the user currently needs a periodic face re-verification. */
export function needsReverification(user: User): boolean {
  const now = new Date();
  return (
    !!user.reverifyUntil &&
    !!user.nextReverifyAt &&
    user.reverifyUntil > now &&
    user.nextReverifyAt <= now
  );
}

/** Advance the re-verification clock after a successful face check. */
export async function advanceReverification(user: User): Promise<void> {
  const { intervalDays } = await getReverifySettings();
  const now = new Date();
  if (user.reverifyUntil && user.reverifyUntil <= now) {
    // Window over — clear the re-verification state entirely
    await db
      .update(usersTable)
      .set({ reverifyUntil: null, nextReverifyAt: null, updatedAt: now })
      .where(eq(usersTable.id, user.id));
    return;
  }
  const next = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  await db
    .update(usersTable)
    .set({ nextReverifyAt: user.reverifyUntil && next > user.reverifyUntil ? user.reverifyUntil : next, updatedAt: now })
    .where(eq(usersTable.id, user.id));
}
