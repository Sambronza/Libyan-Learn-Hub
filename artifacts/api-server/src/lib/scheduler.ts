import { db, pool } from "@workspace/db";
import {
  liveSessionsTable,
  sessionRegistrationsTable,
  notificationsTable,
  enrollmentsTable,
  coursesTable,
  usersTable,
  userPushTokensTable,
} from "@workspace/db";
import { eq, and, lte, gt, isNull, isNotNull, inArray } from "drizzle-orm";
import { sendExpoPushNotifications, sendPushToUsers } from "./expo-notifications.js";
import { sendEmail } from "./email.js";

// Poll every 5 minutes
const POLL_INTERVAL = 5 * 60 * 1000;

// Ping Neon every 4 minutes (below its 5-minute auto-suspend threshold) to
// keep the compute node awake during low-traffic periods.
const KEEPALIVE_INTERVAL = 4 * 60 * 1000;

export function startScheduler() {
  console.log("Starting Live Session Notification Scheduler...");

  // Keep the Neon compute node awake by sending a lightweight ping every
  // 4 minutes. This prevents the 300ms–5s cold-start delay on the first
  // login attempt after a period of inactivity.
  setInterval(async () => {
    try {
      await pool.query("SELECT 1");
    } catch (err) {
      console.warn("[DB Keep-Alive] Ping failed:", err);
    }
  }, KEEPALIVE_INTERVAL);

  setInterval(async () => {
    try {
      const now = new Date();
      const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
      
      // Find sessions starting in the next 15 minutes that haven't sent notifications
      const upcomingSessions = await db.select()
        .from(liveSessionsTable)
        .where(
          and(
            eq(liveSessionsTable.status, "scheduled"),
            eq(liveSessionsTable.notificationSent, false),
            gt(liveSessionsTable.scheduledAt, now),
            lte(liveSessionsTable.scheduledAt, in15Minutes)
          )
        );
        
      if (upcomingSessions.length === 0) return;
      
      for (const session of upcomingSessions) {
        // Fetch all registered students for this session
        const registrations = await db.select()
          .from(sessionRegistrationsTable)
          .where(eq(sessionRegistrationsTable.sessionId, session.id));
          
        if (registrations.length === 0) continue;
        
        const notificationsToInsert = registrations.map(reg => ({
          userId: reg.userId,
          type: "live_session_starting" as const,
          title: "Live Session Starting Soon!",
          titleAr: "الجلسة المباشرة ستبدأ قريباً!",
          message: `Your session "${session.title}" starts in 15 minutes.`,
          messageAr: `جلستك "${session.titleAr}" ستبدأ خلال 15 دقيقة.`,
          referenceId: session.id,
        }));
        
        // Insert in-app notifications
        if (notificationsToInsert.length > 0) {
          await db.insert(notificationsTable).values(notificationsToInsert);
        }
        
        // Mark session as notification sent
        await db.update(liveSessionsTable)
          .set({ notificationSent: true })
          .where(eq(liveSessionsTable.id, session.id));
          
        console.log(`Sent notifications for upcoming live session: ${session.id}`);

        // Push notification to registered devices
        await sendPushToUsers(
          registrations.map((r) => r.userId),
          "Live Session Starting Soon! | الجلسة ستبدأ قريباً",
          `"${session.titleAr || session.title}" starts in 15 minutes | تبدأ خلال 15 دقيقة`,
          { type: "live_session_starting", sessionId: session.id },
        );
      }
      
    } catch (error) {
      console.error("Error in scheduler:", error);
    }
  }, POLL_INTERVAL);

  // Subscription expiry notifications (3-day warning + expired notice)
  setInterval(async () => {
    try {
      await notifyExpiringSubscriptions();
      await notifyExpiredSubscriptions();
    } catch (error) {
      console.error("Error in subscription expiry scheduler:", error);
    }
  }, POLL_INTERVAL);
}

/** Push an in-app notification + email + Expo push to one user. */
async function notifySubscriptionEvent(opts: {
  userId: number;
  type: "subscription_expiring" | "subscription_expired";
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  courseId: number;
}) {
  await db.insert(notificationsTable).values({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    titleAr: opts.titleAr,
    message: opts.message,
    messageAr: opts.messageAr,
    referenceId: opts.courseId,
  });

  // Email (best-effort)
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, opts.userId)).limit(1);
    if (user?.email) {
      const localizedMsg = user.language === "ar" ? opts.messageAr : opts.message;
      await sendEmail({
        to: user.email,
        subject: user.language === "ar" ? opts.titleAr : opts.title,
        text: localizedMsg,
        html: `<p>${localizedMsg}</p>`,
      });
    }
  } catch (err) {
    console.warn("[Scheduler] Subscription email failed:", err);
  }

  // Expo push (best-effort)
  try {
    const tokens = await db.select().from(userPushTokensTable).where(eq(userPushTokensTable.userId, opts.userId));
    if (tokens.length > 0) {
      await sendExpoPushNotifications(
        tokens.map((t) => ({
          to: t.token,
          title: opts.title,
          body: opts.message,
          data: { type: opts.type, courseId: opts.courseId },
        })),
      );
    }
  } catch (err) {
    console.warn("[Scheduler] Subscription push failed:", err);
  }
}

async function notifyExpiringSubscriptions() {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiring = await db
    .select({ enrollment: enrollmentsTable, course: coursesTable })
    .from(enrollmentsTable)
    .innerJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
    .where(
      and(
        isNotNull(enrollmentsTable.expiresAt),
        gt(enrollmentsTable.expiresAt, now),
        lte(enrollmentsTable.expiresAt, in3Days),
        isNull(enrollmentsTable.expiryNotifiedAt),
      ),
    )
    .limit(200);

  for (const { enrollment, course } of expiring) {
    const days = Math.max(1, Math.ceil((enrollment.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    await notifySubscriptionEvent({
      userId: enrollment.userId,
      type: "subscription_expiring",
      title: "Subscription Expiring Soon",
      titleAr: "اشتراكك سينتهي قريباً",
      message: `Your subscription to "${course.title}" expires in ${days} day(s). Renew now to keep your access.`,
      messageAr: `اشتراكك في دورة "${course.titleAr}" سينتهي خلال ${days} يوم. جدّد الآن للحفاظ على وصولك.`,
      courseId: course.id,
    });
    await db
      .update(enrollmentsTable)
      .set({ expiryNotifiedAt: now })
      .where(eq(enrollmentsTable.id, enrollment.id));
  }
  if (expiring.length > 0) console.log(`[Scheduler] Sent ${expiring.length} subscription expiry warnings.`);
}

async function notifyExpiredSubscriptions() {
  const now = new Date();

  const expired = await db
    .select({ enrollment: enrollmentsTable, course: coursesTable })
    .from(enrollmentsTable)
    .innerJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
    .where(
      and(
        isNotNull(enrollmentsTable.expiresAt),
        lte(enrollmentsTable.expiresAt, now),
        isNull(enrollmentsTable.expiredNotifiedAt),
      ),
    )
    .limit(200);

  for (const { enrollment, course } of expired) {
    await notifySubscriptionEvent({
      userId: enrollment.userId,
      type: "subscription_expired",
      title: "Subscription Expired",
      titleAr: "انتهى اشتراكك",
      message: `Your subscription to "${course.title}" has expired. Renew to regain access to the course content.`,
      messageAr: `انتهى اشتراكك في دورة "${course.titleAr}". جدّد الاشتراك لاستعادة الوصول إلى محتوى الدورة.`,
      courseId: course.id,
    });
    await db
      .update(enrollmentsTable)
      .set({ expiredNotifiedAt: now })
      .where(eq(enrollmentsTable.id, enrollment.id));
  }
  if (expired.length > 0) console.log(`[Scheduler] Sent ${expired.length} subscription expired notices.`);
}
