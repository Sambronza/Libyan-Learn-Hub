import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth.js";
import { db, prepaidCardsTable, walletTransactionsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// POST /api/prepaid-cards/redeem
router.post("/redeem", requireAuth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    // Wrap in a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // 1. Find and lock the card (FOR UPDATE equivalent if using raw SQL, but here we check status)
      // We assume Drizzle handles basic concurency if we update carefully.
      const user = await tx.query.usersTable.findFirst({
        where: eq(usersTable.id, (req as any).user!.userId),
      });

      const card = await tx.query.prepaidCardsTable.findFirst({
        where: eq(prepaidCardsTable.code, code),
      });

      if (!card) {
        throw new Error("Invalid card code");
      }

      if (card.status !== "active") {
        throw new Error(`Card is already ${card.status}`);
      }

      // 2. Mark card as used
      await tx.update(prepaidCardsTable)
        .set({
          status: "used",
          usedBy: (req as any).user!.userId,
          usedAt: new Date(),
        })
        .where(eq(prepaidCardsTable.id, card.id));

      // 3. Update user balance
      await tx.update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${card.value}`,
        })
        .where(eq(usersTable.id, (req as any).user!.userId));

      // 4. Log transaction
      await tx.insert(walletTransactionsTable).values({
        userId: (req as any).user!.userId,
        amount: card.value,
        type: "credit",
        referenceType: "prepaid_card",
        referenceId: card.id,
        description: `Redeemed Prepaid Card`,
      });
    });

    res.json({ success: true, message: "Card redeemed successfully" });
  } catch (error: any) {
    if (error.message === "Invalid card code" || error.message.includes("Card is already")) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Failed to redeem prepaid card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/prepaid-cards/generate
router.post("/generate", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { count, value } = req.body;

    if (!count || !value || count < 1 || value < 1) {
      res.status(400).json({ error: "Amount or count is invalid" });
      return;
    }

    // Generate N unique codes
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) code += "-";
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const newCards: any[] = [];
    for (let i = 0; i < count; i++) {
      newCards.push({
        code: generateCode(),
        value: value.toString(),
        status: "active",
      });
    }

    const inserted = await db.insert(prepaidCardsTable).values(newCards).returning();

    res.status(201).json(inserted);
  } catch (error) {
    console.error("Failed to generate prepaid cards:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
