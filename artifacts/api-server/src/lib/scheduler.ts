import { db, pool } from "@workspace/db";
import { liveSessionsTable, sessionRegistrationsTable, notificationsTable } from "@workspace/db";
import { eq, and, lte, gt } from "drizzle-orm";
import { sendExpoPushNotifications } from "./expo-notifications.js";

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
        
        // TODO: In a production scenario, we would also fetch userPushTokensTable
        // here for these users and dispatch via sendExpoPushNotifications().
      }
      
    } catch (error) {
      console.error("Error in scheduler:", error);
    }
  }, POLL_INTERVAL);
}
