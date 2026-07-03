export interface PushMessage {
  to: string | string[];
  sound?: 'default' | null;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  badge?: number;
}

export async function sendExpoPushNotifications(messages: PushMessage[]) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    if (!response.ok) {
      console.error('Error sending Expo push notifications:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
}

/**
 * Convenience: push a message to every registered device of the given users.
 * Reads tokens from user_push_tokens; failures are logged, never thrown.
 */
export async function sendPushToUsers(
  userIds: number[],
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const { db, userPushTokensTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");
    const tokens = await db.select().from(userPushTokensTable)
      .where(inArray(userPushTokensTable.userId, userIds));
    if (tokens.length === 0) return;
    await sendExpoPushNotifications(
      tokens.map((t) => ({ to: t.token, title, body, sound: "default" as const, data })),
    );
  } catch (err) {
    console.error("sendPushToUsers failed (non-fatal):", err);
  }
}
