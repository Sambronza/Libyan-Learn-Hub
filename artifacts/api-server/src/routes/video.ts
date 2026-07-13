import { Router } from "express";
import { serverError } from "../lib/http.js";
import { db } from "@workspace/db";
import { lessonsTable, enrollmentsTable, coursesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import https from "https";
import http from "http";
import { requireAuth, getJwtSecret } from "../lib/auth.js";
import { requireActiveEnrollment, SUBSCRIPTION_EXPIRED_ERROR, NOT_ENROLLED_ERROR } from "../lib/subscriptions.js";

const router = Router();
const JWT_SECRET = getJwtSecret();

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
        const payload = jwt.verify(token, JWT_SECRET) as any;
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
    serverError(res, err);
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
//
// Two-phase approach:
//   Phase 1 – follow any Cloudinary redirect to discover the final CDN URL.
//   Phase 2 – proxy the actual bytes from that URL, forwarding Range headers
//              so Chrome's PDF viewer (PDFium) receives proper 206 responses
//              and can render the file without "Failed to load PDF document".
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

    const isPdfDoc = (lesson.documentFileName || "").toLowerCase().endsWith(".pdf") ||
                     lesson.documentFilePath.toLowerCase().includes(".pdf");

    // ── Phase 1: resolve the final URL (follow Cloudinary redirects) ──────
    const resolveRedirects = (url: string, left: number): Promise<string> =>
      new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const client = parsed.protocol === "https:" ? https : http;
        const req2 = client.request(url, { method: "HEAD" }, (r) => {
          r.resume();
          if ((r.statusCode ?? 0) >= 300 && (r.statusCode ?? 0) < 400 && r.headers.location && left > 0) {
            resolve(resolveRedirects(new URL(r.headers.location, url).toString(), left - 1));
          } else {
            resolve(url);
          }
        });
        req2.on("error", reject);
        req2.end();
      });

    let finalUrl: string;
    try {
      finalUrl = await resolveRedirects(lesson.documentFilePath, 5);
    } catch {
      // If HEAD fails (some CDNs reject HEAD), fall back to the original URL
      finalUrl = lesson.documentFilePath;
    }

    // ── Phase 2: proxy bytes from the final CDN URL ───────────────────────
    const rangeHeader = (req.headers.range as string) || undefined;
    const parsed = new URL(finalUrl);
    const client = parsed.protocol === "https:" ? https : http;

    const upstreamReq = client.get(
      finalUrl,
      {
        headers: {
          ...(rangeHeader ? { Range: rangeHeader } : {}),
          "User-Agent": (req.headers["user-agent"] as string) || "Libyan-Learn-Hub-Proxy",
          // Tell Cloudinary CDN to deliver as a raw byte stream
          Accept: "*/*",
        },
      },
      (remoteRes) => {
        const status = remoteRes.statusCode || 200;

        // If CDN still redirects, just fail gracefully
        if (status >= 300 && status < 400) {
          if (!res.headersSent) res.status(502).send("Too many redirects from storage");
          remoteRes.resume();
          return;
        }

        const outHeaders: Record<string, string | string[]> = {};

        // Forward range-related headers so Chrome can seek
        for (const h of ["content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
          if (remoteRes.headers[h]) outHeaders[h] = remoteRes.headers[h]!;
        }
        // Always advertise byte-range support
        if (!outHeaders["accept-ranges"]) outHeaders["accept-ranges"] = "bytes";

        // Force the correct MIME type so the browser renders instead of downloading
        if (isPdfDoc) {
          outHeaders["content-type"] = "application/pdf";
        } else {
          outHeaders["content-type"] = (remoteRes.headers["content-type"] as string) || "application/octet-stream";
        }

        // Inline view — never force a download dialog
        outHeaders["content-disposition"] = `inline; filename="${encodeURIComponent(lesson.documentFileName || 'document')}"` ;

        // Block browser and CDN caching of secured content
        outHeaders["cache-control"] = "no-store, no-cache, must-revalidate";

        // Required for iframe embedding: allow same-origin framing
        outHeaders["x-frame-options"] = "SAMEORIGIN";
        outHeaders["content-security-policy"] = "frame-ancestors 'self'";

        res.writeHead(status, outHeaders);
        remoteRes.pipe(res);
      }
    );

    upstreamReq.on("error", (err) => {
      console.error("Document proxy error:", err);
      if (!res.headersSent) res.status(500).send("Error streaming document");
    });

    req.on("close", () => upstreamReq.destroy());
    return;
  } catch (err: any) {
    return void res.status(500).send("Server Error");
  }
});

export default router;
