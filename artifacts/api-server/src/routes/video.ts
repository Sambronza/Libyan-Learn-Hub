import { Router } from "express";
import { db } from "@workspace/db";
import { lessonsTable, enrollmentsTable, coursesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import https from "https";
import http from "http";
import { requireAuth } from "../lib/auth.js";
import { requireActiveEnrollment, SUBSCRIPTION_EXPIRED_ERROR, NOT_ENROLLED_ERROR } from "../lib/subscriptions.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_jwt_key_for_dev_only";

// 1. Endpoint to generate a short-lived playback token for a specific lesson
router.post("/generate-token", async (req, res) => {
  try {
    const { lessonId, courseId } = req.body;
    
    // Optional Auth Parsing
    const authHeader = req.headers.authorization;
    let userId = null;
    let role = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        // Fallback to auth.ts secret if JWT_SECRET missing
        const SECRET = process.env.JWT_SECRET || "lms-libya-secret-2024-dev";
        const payload = jwt.verify(token, SECRET) as any;
        userId = payload.userId;
        role = payload.role;
      } catch {}
    }

    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, parseInt(lessonId))).limit(1);
    if (!lesson) { res.status(404).json({ error: "Lesson not found" }); return; }

    if (!lesson.isFree) {
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // Enrollment must exist AND the subscription must not be expired.
      const access = await requireActiveEnrollment(userId, parseInt(courseId), role);
      if (!access.ok) {
        res.status(403).json(access.reason === "expired" ? SUBSCRIPTION_EXPIRED_ERROR : NOT_ENROLLED_ERROR);
        return;
      }
    }

    // Generate a short-lived token (e.g., 6 hours) specifically for this user and lesson
    const playbackToken = jwt.sign(
      { userId: userId || 0, lessonId: parseInt(lessonId), action: "playback" },
      JWT_SECRET,
      { expiresIn: "6h" }
    );

    // Return the HLS m3u8 URL directly for Cloudinary-hosted videos.
    // The sp_hd streaming profile generates a master playlist; hls.js handles
    // quality selection in the browser. Falls back to secure-stream proxy for
    // external videoUrl lessons.
    // CONTENT PROTECTION: never expose the raw storage URL to the client.
    // Encrypted lessons play via AES-128 HLS (playlist + tokenized key
    // endpoint); everything else streams through the secure proxy.
    const playbackUrl = lesson.hlsEncrypted
      ? `/api/video/hls-playlist/${lessonId}?token=${playbackToken}`
      : `/api/video/secure-stream/${lessonId}?token=${playbackToken}`;
    const isHls = !!lesson.hlsEncrypted;

    res.json({ 
      token: playbackToken, 
      url: playbackUrl,
      isHls 
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// 2. The actual streaming endpoint that validates the token and pipes the video
router.get("/secure-stream/:lessonId", async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const token = req.query.token as string;

    if (!token) return res.status(401).send("No playback token provided");

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).send("Invalid or expired playback token");
    }

    if (payload.lessonId !== lessonId || payload.action !== "playback") {
      return res.status(403).send("Token mismatch or invalid action");
    }

    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
    if (!lesson) return res.status(404).send("Video not found");

    // Resolve the actual source: Cloudinary upload (force plain MP4 — the HLS
    // transcode corrupts timestamps on short videos) or an external URL.
    // Never redirect: redirecting would expose the raw URL to the client.
    const sourceUrl = lesson.videoFilePath
      ? lesson.videoFilePath.replace('/sp_hd/', '/').replace('/f_m3u8/', '/').replace('.m3u8', '.mp4')
      : lesson.videoUrl;
    if (!sourceUrl) return res.status(404).send("Video not found");

    // Block caching to enhance DRM simulation
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Disposition", "inline"); // Play inline, don't trigger download

    // Proxy the video chunk by chunk
    const url = new URL(sourceUrl);
    const client = url.protocol === "https:" ? https : http;

    const options = {
      headers: {
        'Range': req.headers.range || 'bytes=0-',
        'User-Agent': req.headers['user-agent'] || 'Libyan-Learn-Hub-Proxy',
      }
    };

    client.get(sourceUrl, options, (remoteRes) => {
      const statusCode = remoteRes.statusCode || 200;
      // Copy essential headers like Content-Type, Content-Length, Content-Range, Accept-Ranges
      const headersToCopy = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
      const headers: Record<string, string | string[]> = {};
      
      for (const h of headersToCopy) {
        if (remoteRes.headers[h]) headers[h] = remoteRes.headers[h]!;
      }

      res.writeHead(statusCode, headers);
      remoteRes.pipe(res);
    }).on('error', (err) => {
      console.error("Video proxy error:", err);
      res.status(500).send("Error streaming secure video");
    });
    return;
  } catch (err: any) {
    return void res.status(500).send("Server Error");
  }
});

// ── AES-128 HLS endpoints (encrypted lessons) ────────────────────────────────

/** Serves the m3u8 playlist with the key URI bound to the caller's token. */
router.get("/hls-playlist/:lessonId", async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const token = req.query.token as string;
    if (!token) return void res.status(401).send("No playback token provided");

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return void res.status(401).send("Invalid or expired playback token");
    }
    if (payload.lessonId !== lessonId || payload.action !== "playback") {
      return void res.status(403).send("Token mismatch or invalid action");
    }

    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
    if (!lesson?.hlsEncrypted || !lesson.hlsPlaylist) return void res.status(404).send("Playlist not found");

    // Absolute key URI so native players (expo-av / Safari) can fetch it
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.get("host");
    const keyUri = `${proto}://${host}/api/video/hls-key/${lessonId}?token=${encodeURIComponent(token)}`;

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store");
    return void res.send(lesson.hlsPlaylist.replace("__KEY_URI__", keyUri));
  } catch {
    return void res.status(500).send("Server Error");
  }
});

/** Serves the 16-byte AES key — the ONLY way the key ever leaves the server. */
router.get("/hls-key/:lessonId", async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const token = req.query.token as string;
    if (!token) return void res.status(401).send("No token");

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return void res.status(401).send("Invalid or expired token");
    }
    if (payload.lessonId !== lessonId || payload.action !== "playback") {
      return void res.status(403).send("Token mismatch");
    }

    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
    if (!lesson?.hlsKeyHex) return void res.status(404).send("Key not found");

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    return void res.send(Buffer.from(lesson.hlsKeyHex, "hex"));
  } catch {
    return void res.status(500).send("Server Error");
  }
});

// 3. Tokenized document proxy — lesson documents (PDFs etc.) are teacher
// material too; the raw Cloudinary URL is never exposed to students.
router.get("/secure-doc/:lessonId", async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const token = req.query.token as string;
    if (!token) return res.status(401).send("No document token provided");

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).send("Invalid or expired document token");
    }
    if (payload.lessonId !== lessonId || payload.action !== "document") {
      return res.status(403).send("Token mismatch or invalid action");
    }

    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
    if (!lesson?.documentFilePath) return res.status(404).send("Document not found");

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Content-Disposition", "inline"); // view in browser, don't force download

    const isPdfDoc = (lesson.documentFileName || "").toLowerCase().endsWith(".pdf");

    // Stream the document from storage. Chrome's built-in PDF viewer (PDFium)
    // loads PDFs via HTTP Range requests (it reads the cross-reference table at
    // the end of the file), so we MUST forward the incoming Range header and
    // relay the upstream Accept-Ranges / Content-Range headers and 206 status.
    // Serving a plain 200 without range support makes the viewer fail with
    // "Failed to load PDF document". Cloudinary raw delivery may also redirect,
    // so follow up to a few redirects.
    const fetchDoc = (target: string, redirectsLeft: number): void => {
      const url = new URL(target);
      const client = url.protocol === "https:" ? https : http;
      const options = {
        headers: {
          Range: (req.headers.range as string) || "bytes=0-",
          "User-Agent": (req.headers["user-agent"] as string) || "Libyan-Learn-Hub-Proxy",
        },
      };
      client.get(target, options, (remoteRes) => {
        const statusCode = remoteRes.statusCode || 200;

        // Follow redirects (3xx) without exposing the raw storage URL to the client.
        if (statusCode >= 300 && statusCode < 400 && remoteRes.headers.location && redirectsLeft > 0) {
          remoteRes.resume(); // drain
          const next = new URL(remoteRes.headers.location, target).toString();
          return fetchDoc(next, redirectsLeft - 1);
        }

        const headers: Record<string, string | string[]> = {};
        for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          if (remoteRes.headers[h]) headers[h] = remoteRes.headers[h]!;
        }
        // Cloudinary raw files are often delivered as application/octet-stream,
        // which stops the browser from rendering them inline as a PDF. Force the
        // correct type for .pdf documents so the viewer activates.
        if (isPdfDoc) headers["content-type"] = "application/pdf";
        if (!headers["accept-ranges"]) headers["accept-ranges"] = "bytes";

        res.writeHead(statusCode, headers);
        remoteRes.pipe(res);
      }).on("error", (err) => {
        console.error("Document proxy error:", err);
        if (!res.headersSent) res.status(500).send("Error streaming document");
      });
    };

    fetchDoc(lesson.documentFilePath, 3);
    return;
  } catch (err: any) {
    return void res.status(500).send("Server Error");
  }
});

export default router;
