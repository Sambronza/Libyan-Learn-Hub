import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { db, walletTransactionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// GET /api/wallet/balance
router.get("/balance", requireAuth, async (req, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, (req as any).user!.userId),
      columns: {
        balance: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const transactions = await db.query.walletTransactionsTable.findMany({
      where: eq(walletTransactionsTable.userId, (req as any).user!.userId),
      orderBy: [desc(walletTransactionsTable.createdAt)],
      limit: 50,
    });

    res.json({
      balance: user.balance,
      transactions,
    });
  } catch (error) {
    console.error("Failed to fetch wallet balance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
