import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, userPushTokensTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// Get unread and recent notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
      
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// Mark notification as read — scoped to the authenticated user
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const notificationId = parseInt(req.params.id as string);

    if (isNaN(notificationId)) {
      res.status(400).json({ error: "Invalid notification ID" });
      return;
    }

    const [updated] = await db.update(notificationsTable)
      .set({ isRead: true })
      // Ensure the notification belongs to this user
      .where(and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, userId)
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// Register push token
router.post("/register-token", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { token, deviceType } = req.body;
    
    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }
    
    // Check if token exists
    const existing = await db.select()
      .from(userPushTokensTable)
      .where(eq(userPushTokensTable.token, token))
      .limit(1);
      
    if (existing.length === 0) {
      await db.insert(userPushTokensTable).values({
        userId,
        token,
        deviceType: deviceType || "unknown"
      });
    } else if (existing[0].userId !== userId) {
      // Update token owner
      await db.update(userPushTokensTable)
        .set({ userId, updatedAt: new Date() })
        .where(eq(userPushTokensTable.token, token));
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
