import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth, requireRole } from "../lib/auth.js";
import { Readable } from "stream";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getEffectiveStorageLimit } from "../lib/plans.js";
import type { TeacherTier } from "../lib/plans.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");

// Ensure local uploads directory exists for development fallback
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function saveFileLocally(buffer: Buffer, originalName: string, type: string): Promise<any> {
  const ext = path.extname(originalName) || (type === "video" ? ".mp4" : ".pdf");
  const fileName = `${type}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(filePath, buffer);
  
  return {
    secure_url: `http://localhost:5001/uploads/${fileName}`,
    public_id: `local-${fileName}`,
    fileName: originalName,
    bytes: buffer.length,
    duration: type === "video" ? 60 : 0, // Mock duration
    format: ext.replace(".", ""),
  };
}

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage (files go straight to Cloudinary, not disk)
const storage = multer.memoryStorage();

const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files (MP4, WebM, MOV, AVI) are allowed"));
    }
  },
});

const documentUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/x-pdf",
      "application/octet-stream",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word documents are allowed"));
    }
  },
});

// Helper: upload buffer to Cloudinary
function uploadToCloudinary(
  buffer: Buffer,
  options: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

// ── Upload Video ─────────────────────────────────────────────────
router.post(
  "/video",
  requireAuth,
  requireRole("teacher", "admin"),
  (req, res, next) => {
    videoUpload.single("video")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No video file provided" });
        return;
      }

      // ── Storage limit check ───────────────────────────────────
      const teacher = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, (req as any).user.id),
        columns: { tier: true, storageUsed: true, isBonusUnlocked: true },
      });
      if (teacher) {
        const limit = getEffectiveStorageLimit(teacher.tier as TeacherTier, teacher.isBonusUnlocked);
        if ((teacher.storageUsed ?? 0) + req.file.size > limit) {
          const limitGB = (limit / (1024 ** 3)).toFixed(0);
          res.status(403).json({
            error: `Storage limit reached (${limitGB} GB). Please upgrade your plan to upload more content.`,
          });
          return;
        }
      }
      // ─────────────────────────────────────────────────────────

      let result;
      try {
        result = await uploadToCloudinary(req.file.buffer, {
          resource_type: "video",
          folder: "libyan-learn-hub/videos",
          eager: [
            { streaming_profile: "hd", format: "m3u8" }
          ],
          eager_async: false,
        });

        // Check resolution (Cloudinary returns width/height)
        if (result.width && result.height) {
          if (result.width < 1280 || result.height < 720) {
            await cloudinary.uploader.destroy(result.public_id, { resource_type: "video" });
            res.status(400).json({
              error: "Video resolution must be at least HD (1280×720)",
              actualWidth: result.width,
              actualHeight: result.height,
            });
            return;
          }
        }
      } catch (cloudinaryErr: any) {
        console.warn("⚠️ Cloudinary upload failed, falling back to local storage:", cloudinaryErr.message || cloudinaryErr);
        result = await saveFileLocally(req.file.buffer, req.file.originalname, "video");
      }

      // ── Update storageUsed in DB ───────────────────────────────
      await db.update(usersTable)
        .set({ storageUsed: (teacher?.storageUsed ?? 0) + result.bytes })
        .where(eq(usersTable.id, (req as any).user.id));
      // ─────────────────────────────────────────────────────────

      res.json({
        url: result.eager?.[0]?.secure_url || result.secure_url,
        publicId: result.public_id,
        duration: Math.round(result.duration || 0),
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      });
    } catch (err: any) {
      console.error("Video upload error:", err);
      res.status(500).json({ error: "Failed to upload video", message: err.message });
    }
  }
);

// ── Upload Document ──────────────────────────────────────────────
router.post(
  "/document",
  requireAuth,
  requireRole("teacher", "admin"),
  (req, res, next) => {
    documentUpload.single("document")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No document file provided" });
        return;
      }

      // ── Storage limit check ───────────────────────────────────
      const teacher = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, (req as any).user.id),
        columns: { tier: true, storageUsed: true, isBonusUnlocked: true },
      });
      if (teacher) {
        const limit = getEffectiveStorageLimit(teacher.tier as TeacherTier, teacher.isBonusUnlocked);
        if ((teacher.storageUsed ?? 0) + req.file.size > limit) {
          const limitGB = (limit / (1024 ** 3)).toFixed(0);
          res.status(403).json({
            error: `Storage limit reached (${limitGB} GB). Please upgrade your plan to upload more content.`,
          });
          return;
        }
      }
      // ─────────────────────────────────────────────────────────

      let result;
      try {
        result = await uploadToCloudinary(req.file.buffer, {
          resource_type: "raw",
          folder: "libyan-learn-hub/documents",
        });
      } catch (cloudinaryErr: any) {
        console.warn("⚠️ Cloudinary document upload failed, falling back to local storage:", cloudinaryErr.message || cloudinaryErr);
        result = await saveFileLocally(req.file.buffer, req.file.originalname, "document");
      }

      // ── Update storageUsed in DB ───────────────────────────────
      await db.update(usersTable)
        .set({ storageUsed: (teacher?.storageUsed ?? 0) + result.bytes })
        .where(eq(usersTable.id, (req as any).user.id));
      // ─────────────────────────────────────────────────────────

      res.json({
        url: result.secure_url,
        publicId: result.public_id,
        fileName: req.file.originalname,
        size: result.bytes,
        format: result.format,
      });
    } catch (err: any) {
      console.error("Document upload error:", err);
      res.status(500).json({ error: "Failed to upload document", message: err.message });
    }
  }
);

// ── Delete uploaded file ─────────────────────────────────────────
router.delete(
  "/:publicId",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res) => {
    try {
      const publicId = req.params.publicId as string;
      const resourceType = (req.query.type as string) || "video";
      const fileSizeBytes = parseInt((req.query.size as string) || "0", 10);

      if (publicId.startsWith("local-")) {
        const fileName = publicId.replace("local-", "");
        const filePath = path.join(uploadsDir, fileName);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
      } else {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });
      }

      // ── Decrement storageUsed on delete ───────────────────────
      if (fileSizeBytes > 0) {
        const teacher = await db.query.usersTable.findFirst({
          where: eq(usersTable.id, (req as any).user.id),
          columns: { storageUsed: true },
        });
        const newUsage = Math.max(0, (teacher?.storageUsed ?? 0) - fileSizeBytes);
        await db.update(usersTable)
          .set({ storageUsed: newUsage })
          .where(eq(usersTable.id, (req as any).user.id));
      }
      // ─────────────────────────────────────────────────────────

      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete upload error:", err);
      res.status(500).json({ error: "Failed to delete file", message: err.message });
    }
  }
);

export default router;
