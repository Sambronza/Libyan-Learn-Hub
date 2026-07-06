import { Router, type IRouter } from "express";
import { db, libraryResourcesTable, usersTable, categoriesTable } from "@workspace/db";
import { eq, and, or, ilike, desc, type SQL } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { deleteFromCloudinaryByUrl } from "../lib/cloudinary.js";

const router: IRouter = Router();

const RESOURCE_TYPES = ["book", "article", "image", "link"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

// Allowed file extensions per resource type (files are uploaded through
// /api/upload/document or /api/upload/image first; this validates the result).
const ALLOWED_EXTENSIONS: Record<Exclude<ResourceType, "link">, string[]> = {
  book: [".pdf", ".doc", ".docx", ".epub"],
  article: [".pdf", ".doc", ".docx", ".txt"],
  image: [".jpg", ".jpeg", ".png"],
};

// ── Browse (public read: students, guests) ──────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { search, categoryId, gradeLevel, type } = req.query as Record<string, string | undefined>;

    const conditions: SQL[] = [];
    if (type && RESOURCE_TYPES.includes(type as ResourceType)) {
      conditions.push(eq(libraryResourcesTable.type, type as ResourceType));
    }
    if (categoryId && !isNaN(parseInt(categoryId))) {
      conditions.push(eq(libraryResourcesTable.categoryId, parseInt(categoryId)));
    }
    if (gradeLevel) {
      conditions.push(eq(libraryResourcesTable.gradeLevel, gradeLevel));
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(libraryResourcesTable.title, pattern),
          ilike(libraryResourcesTable.titleAr, pattern),
          ilike(libraryResourcesTable.author, pattern),
          ilike(libraryResourcesTable.description, pattern),
        )!,
      );
    }

    const rows = await db
      .select({
        id: libraryResourcesTable.id,
        title: libraryResourcesTable.title,
        titleAr: libraryResourcesTable.titleAr,
        author: libraryResourcesTable.author,
        description: libraryResourcesTable.description,
        type: libraryResourcesTable.type,
        categoryId: libraryResourcesTable.categoryId,
        categoryName: categoriesTable.name,
        categoryNameAr: categoriesTable.nameAr,
        gradeLevel: libraryResourcesTable.gradeLevel,
        fileUrl: libraryResourcesTable.fileUrl,
        fileName: libraryResourcesTable.fileName,
        fileSize: libraryResourcesTable.fileSize,
        externalUrl: libraryResourcesTable.externalUrl,
        uploadedBy: libraryResourcesTable.uploadedBy,
        uploaderName: usersTable.fullName,
        uploaderRole: usersTable.role,
        createdAt: libraryResourcesTable.createdAt,
      })
      .from(libraryResourcesTable)
      .leftJoin(usersTable, eq(libraryResourcesTable.uploadedBy, usersTable.id))
      .leftJoin(categoriesTable, eq(libraryResourcesTable.categoryId, categoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(libraryResourcesTable.createdAt));

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Create (admins and APPROVED teachers only) ──────────────────────────────
router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    // Teachers must be admin-approved to publish library material.
    // "approved" covers the current registration workflow; isVerified is the
    // legacy admin verification flag — accept either.
    if (role === "teacher") {
      const [teacher] = await db.select({
        isVerified: usersTable.isVerified,
        teacherApprovalStatus: usersTable.teacherApprovalStatus,
      }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const isApproved = teacher && (teacher.isVerified || teacher.teacherApprovalStatus === "approved");
      if (!isApproved) {
        res.status(403).json({
          error: "Only approved teachers can upload library resources",
          errorAr: "فقط المعلمون المعتمدون يمكنهم رفع موارد المكتبة",
        });
        return;
      }
    }

    const { title, titleAr, author, description, type, categoryId, gradeLevel,
      fileUrl, filePublicId, fileName, fileSize, externalUrl } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    if (!RESOURCE_TYPES.includes(type)) {
      res.status(400).json({ error: `Invalid resource type. Allowed: ${RESOURCE_TYPES.join(", ")}` });
      return;
    }

    if (type === "link") {
      let parsed: URL;
      try {
        parsed = new URL(externalUrl);
      } catch {
        res.status(400).json({ error: "A valid URL is required for link resources" });
        return;
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        res.status(400).json({ error: "Only http/https links are allowed" });
        return;
      }
    } else {
      if (!fileUrl || !fileName) {
        res.status(400).json({ error: "A file is required for this resource type" });
        return;
      }
      const ext = ("." + (fileName.split(".").pop() || "")).toLowerCase();
      const allowed = ALLOWED_EXTENSIONS[type as Exclude<ResourceType, "link">];
      if (!allowed.includes(ext)) {
        res.status(400).json({
          error: `Invalid file format for ${type}. Allowed: ${allowed.join(", ")}`,
        });
        return;
      }
    }

    const [created] = await db.insert(libraryResourcesTable).values({
      title: title.trim(),
      titleAr: titleAr?.trim() || null,
      author: author?.trim() || null,
      description: description?.trim() || null,
      type,
      categoryId: categoryId ? parseInt(categoryId) : null,
      gradeLevel: gradeLevel?.trim() || null,
      fileUrl: type === "link" ? null : fileUrl,
      filePublicId: type === "link" ? null : (filePublicId || null),
      fileName: type === "link" ? null : fileName,
      fileSize: type === "link" ? null : (fileSize ? parseInt(fileSize) : null),
      externalUrl: type === "link" ? externalUrl : null,
      uploadedBy: userId,
    }).returning();

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Delete (admin, or the teacher who uploaded it) ──────────────────────────
router.delete("/:id", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid resource id" });
      return;
    }

    const [resource] = await db.select().from(libraryResourcesTable)
      .where(eq(libraryResourcesTable.id, id)).limit(1);
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    if (role !== "admin" && resource.uploadedBy !== userId) {
      res.status(403).json({ error: "You can only delete your own resources" });
      return;
    }

    if (resource.fileUrl) await deleteFromCloudinaryByUrl(resource.fileUrl);
    await db.delete(libraryResourcesTable).where(eq(libraryResourcesTable.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
