import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, deviceSwitchRequestsTable, notificationsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { signToken, requireAuth, invalidateDeviceCheckCache } from "../lib/auth.js";
import { rateLimit } from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import {
  bestMatchDistance,
  getFaceMatchThreshold,
  hasFaceProfile,
  extractDescriptorFromImage,
  decodeBase64Image,
  type StoredFaceProfile,
} from "../lib/face.js";
import {
  getTrustedDevice,
  performDeviceSwitch,
  blockStudentAccount,
  advanceReverification,
  needsReverification,
  ACCOUNT_BLOCKED_ERROR,
  FACE_MISMATCH_ERROR,
} from "../lib/device-security.js";

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // face verification attempts are sensitive — keep this tight
  message: { error: "Too many verification attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

function safeParseProfile(raw: string | null): { face?: StoredFaceProfile } {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function uploadSnapshot(base64: string, folder: string): Promise<string | null> {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const dataUri = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder });
    return result.secure_url;
  } catch (err) {
    console.error("Snapshot upload failed:", err);
    return null;
  }
}

/**
 * Resolve a live 128-d descriptor from the request body:
 * - web sends `faceDescriptor` (array, computed client-side with face-api)
 * - mobile sends `faceImage` (base64 JPEG) for server-side extraction
 */
async function resolveDescriptor(body: any): Promise<number[] | null> {
  if (Array.isArray(body.faceDescriptor) && body.faceDescriptor.length > 0) {
    return body.faceDescriptor.map(Number);
  }
  if (typeof body.faceImage === "string" && body.faceImage.length > 0) {
    try {
      return await extractDescriptorFromImage(decodeBase64Image(body.faceImage));
    } catch (err) {
      console.error("Server-side face extraction failed:", err);
      throw new Error("FACE_EXTRACTION_UNAVAILABLE");
    }
  }
  return null;
}

async function notifyAdminsOfReviewRequest(studentName: string, requestId: number) {
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  if (admins.length === 0) return;
  await db.insert(notificationsTable).values(
    admins.map((admin) => ({
      userId: admin.id,
      type: "device_switch_review" as const,
      title: "Device Switch Review Needed",
      titleAr: "مطلوب مراجعة تغيير جهاز",
      message: `Student ${studentName} failed a face identity check while switching devices. Review the request.`,
      messageAr: `فشل الطالب ${studentName} في فحص التعرف على الوجه أثناء تغيير الجهاز. يرجى مراجعة الطلب.`,
      referenceId: requestId,
    })),
  );
}

/**
 * POST /auth/device-switch/verify
 * Called after login returned 409 NEW_DEVICE and the student confirmed the
 * warning. Verifies credentials + live face vs the stored signup face.
 */
router.post("/device-switch/verify", verifyLimiter, async (req, res) => {
  try {
    if (typeof req.body.email === "string") req.body.email = req.body.email.toLowerCase();
    const { email, password, deviceFingerprint, deviceName, devicePlatform, snapshot } = req.body;

    if (!email || !password || !deviceFingerprint) {
      res.status(400).json({ error: "email, password and deviceFingerprint are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(ilike(usersTable.email, email)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (user.role !== "student") {
      res.status(400).json({ error: "Device switching applies to student accounts only" });
      return;
    }
    if (user.accountBlocked) {
      res.status(403).json(ACCOUNT_BLOCKED_ERROR);
      return;
    }

    const profile = safeParseProfile(user.biometricProfile);
    if (!hasFaceProfile(profile.face)) {
      res.status(400).json({
        code: "NO_FACE_PROFILE",
        error: "No face profile on record",
        message: "Your account has no registered face profile. Please contact support.",
        messageAr: "لا يوجد ملف وجه مسجّل لحسابك. يرجى التواصل مع الدعم.",
      });
      return;
    }

    let descriptor: number[] | null;
    try {
      descriptor = await resolveDescriptor(req.body);
    } catch {
      res.status(503).json({
        error: "Face verification unavailable",
        message: "Face verification is temporarily unavailable. Please try again later or contact support.",
        messageAr: "التحقق من الوجه غير متاح مؤقتًا. يرجى المحاولة لاحقًا أو التواصل مع الدعم.",
      });
      return;
    }
    if (!descriptor) {
      res.status(400).json({
        error: "No face detected",
        message: "We couldn't detect a face. Make sure your face is clearly visible and try again.",
        messageAr: "لم نتمكن من اكتشاف وجه. تأكد من ظهور وجهك بوضوح وحاول مرة أخرى.",
      });
      return;
    }

    const distance = bestMatchDistance(descriptor, profile.face!);
    const threshold = await getFaceMatchThreshold();

    if (distance <= threshold) {
      // ── MATCH: switch devices (old device is blocklisted) ──
      await performDeviceSwitch({
        studentId: user.id,
        newFingerprint: deviceFingerprint,
        deviceName: deviceName || null,
        platform: devicePlatform || null,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      });
      invalidateDeviceCheckCache(user.id);

      const trusted = await getTrustedDevice(user.id);
      const token = signToken({ userId: user.id, role: user.role, deviceId: trusted?.id });
      res.json({
        success: true,
        token,
        message: "Identity confirmed. This device is now your trusted device; your previous device has been blocked.",
        messageAr: "تم تأكيد هويتك. هذا الجهاز هو الآن جهازك الموثوق؛ تم حظر جهازك السابق.",
        reverifyNotice: {
          message: "For security, you'll be asked to re-verify your face periodically over the next two weeks.",
          messageAr: "لأغراض الأمان، سيُطلب منك إعادة التحقق من وجهك بشكل دوري خلال الأسبوعين القادمين.",
        },
      });
      return;
    }

    // ── MISMATCH: block account + create admin review request ──
    const oldDevice = await getTrustedDevice(user.id);
    const attemptSnapshotUrl = typeof snapshot === "string" && snapshot
      ? await uploadSnapshot(snapshot, "lms_device_switch_attempts")
      : null;

    const [request] = await db.insert(deviceSwitchRequestsTable).values({
      studentId: user.id,
      oldDeviceId: oldDevice?.id ?? null,
      newFingerprint: deviceFingerprint,
      newDeviceName: deviceName || null,
      newUserAgent: (req.headers["user-agent"] as string) || null,
      newIp: req.ip || null,
      newPlatform: devicePlatform || null,
      originalFaceSnapshotUrl: user.facePhotoUrl || null,
      attemptFaceSnapshotUrl: attemptSnapshotUrl,
      attemptDescriptor: JSON.stringify(descriptor),
      distance: distance.toFixed(4),
      status: "pending",
    }).returning();

    await blockStudentAccount(user.id, "face_mismatch");
    invalidateDeviceCheckCache(user.id);
    await notifyAdminsOfReviewRequest(user.fullName, request.id);

    res.status(403).json(FACE_MISMATCH_ERROR);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

/**
 * POST /auth/reverify-face
 * Periodic identity re-verification during the post-switch window.
 * Accepts credentials (login was refused with REVERIFY_REQUIRED, so no token yet).
 */
router.post("/reverify-face", verifyLimiter, async (req, res) => {
  try {
    if (typeof req.body.email === "string") req.body.email = req.body.email.toLowerCase();
    const { email, password, deviceFingerprint, snapshot } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(ilike(usersTable.email, email)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (user.accountBlocked) {
      res.status(403).json(ACCOUNT_BLOCKED_ERROR);
      return;
    }

    const trusted = await getTrustedDevice(user.id);
    if (!trusted || (deviceFingerprint && trusted.deviceFingerprint !== deviceFingerprint)) {
      res.status(403).json({
        error: "Untrusted device",
        message: "Re-verification must be done from your trusted device.",
        messageAr: "يجب إجراء إعادة التحقق من جهازك الموثوق.",
      });
      return;
    }

    const profile = safeParseProfile(user.biometricProfile);
    if (!hasFaceProfile(profile.face)) {
      res.status(400).json({ error: "No face profile on record" });
      return;
    }

    let descriptor: number[] | null;
    try {
      descriptor = await resolveDescriptor(req.body);
    } catch {
      res.status(503).json({ error: "Face verification unavailable" });
      return;
    }
    if (!descriptor) {
      res.status(400).json({
        error: "No face detected",
        message: "We couldn't detect a face. Try again in better lighting.",
        messageAr: "لم نتمكن من اكتشاف وجه. حاول مرة أخرى في إضاءة أفضل.",
      });
      return;
    }

    const distance = bestMatchDistance(descriptor, profile.face!);
    const threshold = await getFaceMatchThreshold();

    if (distance <= threshold) {
      await advanceReverification(user);
      const token = signToken({ userId: user.id, role: user.role, deviceId: trusted.id });
      res.json({ success: true, token });
      return;
    }

    // Failed re-verification: block + review request
    const attemptSnapshotUrl = typeof snapshot === "string" && snapshot
      ? await uploadSnapshot(snapshot, "lms_device_switch_attempts")
      : null;
    const [request] = await db.insert(deviceSwitchRequestsTable).values({
      studentId: user.id,
      oldDeviceId: trusted.id,
      newFingerprint: trusted.deviceFingerprint,
      newDeviceName: trusted.deviceName,
      newUserAgent: (req.headers["user-agent"] as string) || null,
      newIp: req.ip || null,
      newPlatform: trusted.platform,
      originalFaceSnapshotUrl: user.facePhotoUrl || null,
      attemptFaceSnapshotUrl: attemptSnapshotUrl,
      attemptDescriptor: JSON.stringify(descriptor),
      distance: distance.toFixed(4),
      status: "pending",
    }).returning();

    await blockStudentAccount(user.id, "face_mismatch");
    invalidateDeviceCheckCache(user.id);
    await notifyAdminsOfReviewRequest(user.fullName, request.id);

    res.status(403).json(FACE_MISMATCH_ERROR);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

/**
 * POST /auth/enroll-face
 * Grandfathered students (registered before face capture existed) store their
 * face profile after logging in. Mirrors biometrics /setup-face but for students.
 */
router.post("/enroll-face", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    if (role !== "student") {
      res.status(403).json({ error: "Only students enroll a face profile here" });
      return;
    }

    let faceDescriptors = req.body.faceDescriptors;

    // Mobile path: 5 pose images for server-side extraction
    if (!faceDescriptors && req.body.faceImages) {
      const images = req.body.faceImages; // { front, left, right, up, down } base64
      const poses = ["front", "left", "right", "up", "down"] as const;
      faceDescriptors = {};
      try {
        for (const pose of poses) {
          if (typeof images[pose] !== "string") continue;
          const d = await extractDescriptorFromImage(decodeBase64Image(images[pose]));
          if (d) faceDescriptors[pose] = d;
        }
      } catch {
        res.status(503).json({ error: "Face extraction unavailable" });
        return;
      }
    }

    if (!faceDescriptors || !faceDescriptors.front || !faceDescriptors.left || !faceDescriptors.right || !faceDescriptors.up || !faceDescriptors.down) {
      res.status(400).json({ error: "Missing all 5 face descriptors (front, left, right, up, down)." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const profile = safeParseProfile(user.biometricProfile);
    (profile as any).face = faceDescriptors;

    const facePhotoUrl = typeof req.body.facePhotoUrl === "string" && req.body.facePhotoUrl.startsWith("data:")
      ? await uploadSnapshot(req.body.facePhotoUrl, "lms_student_faces")
      : (typeof req.body.facePhotoUrl === "string" ? req.body.facePhotoUrl : null);

    await db.update(usersTable)
      .set({
        biometricProfile: JSON.stringify(profile),
        ...(facePhotoUrl ? { facePhotoUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Face profile saved." });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

/** GET /auth/device-status — current device/verification state for the logged-in student. */
router.get("/device-status", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;
    if (role !== "student") {
      res.json({ deviceBindingApplies: false });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const trusted = await getTrustedDevice(userId);
    const profile = safeParseProfile(user.biometricProfile);
    res.json({
      deviceBindingApplies: true,
      hasTrustedDevice: !!trusted,
      hasFaceProfile: hasFaceProfile(profile.face),
      accountBlocked: user.accountBlocked,
      reverifyRequired: needsReverification(user),
      reverifyUntil: user.reverifyUntil,
      nextReverifyAt: user.nextReverifyAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
