import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { db, walletTransactionsTable, usersTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

/**
 * Parse an optional ISO date query param and return a Date set to the
 * start (isStart=true) or end (isStart=false) of that calendar day.
 * Returns undefined when the param is absent or invalid.
 */
function parseDateParam(value: unknown, isStart: boolean): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const d = new Date(value.trim());
  if (isNaN(d.getTime())) return undefined;
  if (isStart) {
    d.setHours(0, 0, 0, 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

// GET /api/wallet/balance
// Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD  (both optional)
router.get("/balance", requireAuth, async (req, res) => {
  try {
    const userId = req.user!!.userId;
    const from = parseDateParam(req.query.from, true);
    const to   = parseDateParam(req.query.to,   false);

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: { balance: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Build where clauses
    const whereClauses = [eq(walletTransactionsTable.userId, userId)];
    if (from) whereClauses.push(gte(walletTransactionsTable.createdAt, from));
    if (to)   whereClauses.push(lte(walletTransactionsTable.createdAt, to));

    const transactions = await db.query.walletTransactionsTable.findMany({
      where: and(...whereClauses),
      orderBy: [desc(walletTransactionsTable.createdAt)],
      limit: 200,
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

// GET /api/wallet/recharge-history
// Returns only credit (top-up) transactions.
// Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD  (both optional)
router.get("/recharge-history", requireAuth, async (req, res) => {
  try {
    const userId = req.user!!.userId;
    const from = parseDateParam(req.query.from, true);
    const to   = parseDateParam(req.query.to,   false);

    const whereClauses = [
      eq(walletTransactionsTable.userId, userId),
      eq(walletTransactionsTable.type, "credit"),
    ];
    if (from) whereClauses.push(gte(walletTransactionsTable.createdAt, from));
    if (to)   whereClauses.push(lte(walletTransactionsTable.createdAt, to));

    const transactions = await db.query.walletTransactionsTable.findMany({
      where: and(...whereClauses),
      orderBy: [desc(walletTransactionsTable.createdAt)],
      limit: 200,
    });

    // Enrich with a human-readable payment method label
    const enriched = transactions.map((tx) => ({
      ...tx,
      paymentMethod:
        tx.referenceType === "redeem_card"
          ? "Prepaid Card"
          : tx.referenceType ?? "Wallet Credit",
      transactionId: `TXN-${String(tx.id).padStart(6, "0")}`,
    }));

    res.json({ recharges: enriched });
  } catch (error) {
    console.error("Failed to fetch recharge history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
