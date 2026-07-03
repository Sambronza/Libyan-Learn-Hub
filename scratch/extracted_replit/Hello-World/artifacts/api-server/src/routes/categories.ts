import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, coursesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    let cats = await db.select().from(categoriesTable);

    // Auto-seed default categories if the table is empty
    if (cats.length === 0) {
      console.log("Categories table is empty, auto-seeding...");
      const defaults = [
        { name: "Mathematics",       nameAr: "الرياضيات",          icon: "📐" },
        { name: "Sciences",          nameAr: "العلوم",              icon: "🔬" },
        { name: "Arabic Language",   nameAr: "اللغة العربية",       icon: "📖" },
        { name: "English Language",  nameAr: "اللغة الإنجليزية",    icon: "🇬🇧" },
        { name: "History",           nameAr: "التاريخ",             icon: "🏛️" },
        { name: "Physics",           nameAr: "الفيزياء",            icon: "⚛️" },
        { name: "Chemistry",         nameAr: "الكيمياء",            icon: "🧪" },
        { name: "Biology",           nameAr: "الأحياء",             icon: "🧬" },
        { name: "Computer Science",  nameAr: "علوم الحاسوب",        icon: "💻" },
        { name: "Islamic Studies",   nameAr: "الدراسات الإسلامية",  icon: "🌙" },
      ];
      try {
        await db.insert(categoriesTable).values(defaults);
        cats = await db.select().from(categoriesTable);
        console.log(`Auto-seeded ${cats.length} default categories`);
      } catch (seedErr: any) {
        console.error("Failed to auto-seed categories:", seedErr.message);
      }
    }

    const result = await Promise.all(
      cats.map(async (cat) => {
        const [{ value }] = await db.select({ value: count() }).from(coursesTable).where(eq(coursesTable.categoryId, cat.id));
        return { id: cat.id, name: cat.name, nameAr: cat.nameAr, icon: cat.icon, courseCount: Number(value) };
      })
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, nameAr, icon } = req.body;
    if (!name || !nameAr) { res.status(400).json({ error: "name and nameAr are required" }); return; }
    const [cat] = await db.insert(categoriesTable).values({ name, nameAr, icon }).returning();
    res.status(201).json({ ...cat, courseCount: 0 });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create category", message: err.message });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseParam(req.params.id);
    const { name, nameAr, icon } = req.body;
    const [updated] = await db.update(categoriesTable).set({ name, nameAr, icon }).where(eq(categoriesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Category not found" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update category", message: err.message });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseParam(req.params.id);
    const [{ value }] = await db.select({ value: count() }).from(coursesTable).where(eq(coursesTable.categoryId, id));
    if (Number(value) > 0) {
      res.status(400).json({ error: "Cannot delete category with courses. Move or delete courses first." });
      return;
    }
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to delete category", message: err.message });
  }
});

export default router;
