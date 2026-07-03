import { Router } from "express";
import { db } from "@workspace/db";
import { expensesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

router.get("/", async (_req, res) => {
  try {
    const expenses = await db.select().from(expensesTable).orderBy(desc(expensesTable.expenseDate));
    res.json(expenses.map(e => ({ ...e, amount: parseFloat(e.amount) })));
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { title, amount, currency, category, notes, expenseDate } = req.body;
    const [expense] = await db.insert(expensesTable).values({
      title, amount: amount.toString(), currency: currency || "LYD",
      category, notes, expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      createdById: userId,
    }).returning();
    res.status(201).json({ ...expense, amount: parseFloat(expense.amount) });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(expensesTable).where(eq(expensesTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
