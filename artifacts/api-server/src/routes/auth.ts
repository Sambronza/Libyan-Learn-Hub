import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth.js";
import {
  isDeviceEnforcementEnabled,
  getTrustedDevice,
  registerTrustedDevice,
  needsReverification,
  ACCOUNT_BLOCKED_ERROR,
  NEW_DEVICE_ERROR,
  REVERIFY_REQUIRED_ERROR,
} from "../lib/device-security.js";
import { hasFaceProfile } from "../lib/face.js";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { sendEmail } from "../lib/email.js";
import { rateLimit } from "express-rate-limit";
import { PLANS } from "../lib/plans.js";
import type { TeacherTier } from "../lib/plans.js";

const router = Router();

// ─── PUBLIC SETTINGS ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = [
  { key: "teacher_commission_percent", value: "20", description: "Platform fee percentage retained from teacher sales" },
];

router.get("/settings", async (_req, res) => {
  try {
    const { platformSettingsTable } = await import("@workspace/db");
    let settings = await db.select().from(platformSettingsTable);
    
    // Auto-seed defaults if the table is empty (first boot)
    if (settings.length === 0) {
      await db.insert(platformSettingsTable).values(DEFAULT_SETTINGS).onConflictDoNothing();
      settings = await db.select().from(platformSettingsTable);
    }
    
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many login/registration attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/register", authLimiter, async (req, res) => {
  try {
    // Safety check: if the body parser failed to parse (e.g., Content-Type
    // header was stripped by a proxy), req.body will be undefined.
    // We fall back to an empty object so Zod can give a proper validation error.
    if (req.body === undefined) {
      console.error("req.body is undefined. Headers:", req.headers);
      req.body = {};
    }
    
    if (typeof req.body.email === "string") {
      req.body.email = req.body.email.toLowerCase();
    }
    
    // Support phoneNumber in the validation gracefully
    const body = RegisterBody.passthrough().parse(req.body);
    const existingList = await db.select().from(usersTable).where(ilike(usersTable.email, body.email)).limit(1);
    const existing = existingList[0];
    
    if (existing) {
      if (existing.emailVerified || existing.phoneVerified) {
        res.status(400).json({ error: "Email already registered" });
        return;
      }
      // If the email exists but is not verified, we allow overwriting the unverified account.
    }
    
    const passwordHash = await bcrypt.hash(body.password, 10);
    const passkeyHash = body.passkey ? await bcrypt.hash(body.passkey, 8) : null;
    const otpCode = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const phoneNumber = req.body.phoneNumber || null;

    // Accept plan tier during teacher registration; students are always 'free'
    const requestedTier = req.body.tier as TeacherTier | undefined;
    const validTiers: TeacherTier[] = ["free", "bronze", "golden"];
    const tier: TeacherTier = (body.role === "teacher" && requestedTier && validTiers.includes(requestedTier))
      ? requestedTier
      : "free";

    if (body.role === "teacher") {
      if (req.body.agreedToCommission !== true && req.body.agreedToCommission !== "true") {
        res.status(400).json({ error: "You must agree to the platform commission terms to register as a teacher." });
        return;
      }
    }

    let user;
    if (existing) {
      [user] = await db.update(usersTable).set({
        passwordHash,
        fullName: body.fullName,
        fullNameAr: body.fullNameAr,
        role: body.role as any,
        passkeyHash,
        language: (body.language as any) || "ar",
        phoneNumber,
        otpCode,
        otpExpiry,
        tier,
      }).where(eq(usersTable.id, existing.id)).returning();
    } else {
      [user] = await db.insert(usersTable).values({
        email: body.email,
        passwordHash,
        fullName: body.fullName,
        fullNameAr: body.fullNameAr,
        role: body.role as any,
        passkeyHash,
        language: (body.language as any) || "ar",
        phoneNumber,
        otpCode,
        otpExpiry,
        tier,
      }).returning();
    }
    
    // ── Referral capture: link the new account to its referrer ───────────
    if (typeof req.body.referralCode === "string" && req.body.referralCode.trim() && !existing) {
      try {
        const [referrer] = await db.select().from(usersTable)
          .where(eq(usersTable.referralCode, req.body.referralCode.trim().toUpperCase())).limit(1);
        if (referrer && referrer.id !== user.id) {
          await db.update(usersTable).set({ referredBy: referrer.id }).where(eq(usersTable.id, user.id));
        }
      } catch (err) {
        console.error("Referral capture failed (non-fatal):", err);
      }
    }

    // ── Student device binding + face enrollment (signup) ────────────────
    let deviceId: number | undefined;
    if (user.role === "student") {
      // Store face descriptors captured at signup (same 5-pose shape as teacher biometrics)
      const faceDescriptors = req.body.faceDescriptors;
      if (faceDescriptors && faceDescriptors.front) {
        const profile = { face: faceDescriptors, voice: {} };
        const facePhotoUrl = typeof req.body.facePhotoUrl === "string" ? req.body.facePhotoUrl : undefined;
        await db.update(usersTable)
          .set({ biometricProfile: JSON.stringify(profile), ...(facePhotoUrl ? { facePhotoUrl } : {}) })
          .where(eq(usersTable.id, user.id));
      }
      // Register the signup device as the trusted device
      if (typeof req.body.deviceFingerprint === "string" && req.body.deviceFingerprint.length > 0) {
        const device = await registerTrustedDevice({
          studentId: user.id,
          fingerprint: req.body.deviceFingerprint,
          deviceName: req.body.deviceName || null,
          platform: req.body.devicePlatform || null,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
        });
        deviceId = device.id;
      }
    }

    const token = signToken({ userId: user.id, role: user.role, ...(deviceId ? { deviceId } : {}) });
    const plan = PLANS[(user.tier as TeacherTier) || "free"];

    if (user.email) {
      // Fire-and-forget: don't await, respond immediately
      sendEmail({
        to: user.email,
        subject: "Welcome to Libyan Learn Hub - Verification Code",
        text: `Hello ${user.fullName},\n\nYour account verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.`,
        html: `<div dir="ltr"><p>Hello ${user.fullName},</p><p>Your account verification code is: <strong style="font-size:1.5em;letter-spacing:2px;display:block;margin:10px 0;">${otpCode}</strong></p><p>It will expire in 10 minutes.</p></div>`,
      }).catch((err) => console.error("Failed to send welcome OTP email:", err));
    }

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        fullNameAr: user.fullNameAr,
        role: user.role,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        bioAr: user.bioAr,
        language: user.language,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.phoneVerified,
        emailVerified: user.emailVerified,
        tier: user.tier,
        storageUsed: user.storageUsed,
        storageLimitBytes: plan.storageLimitBytes,
        isBonusUnlocked: user.isBonusUnlocked,
        hasPasskey: !!user.passkeyHash,
        biometricsVerified: user.biometricsVerified,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err: any) {
    res.status(400).json({ error: "Validation failed", message: err.message });
  }
});

router.post("/send-otp", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const otpCode = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const [user] = await db.update(usersTable)
      .set({ otpCode, otpExpiry })
      .where(eq(usersTable.id, userId))
      .returning();

    if (user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Libyan Learn Hub - Verification Code",
          text: `Hello ${user.fullName || "User"},\n\nYour new verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.`,
          html: `<div dir="ltr"><p>Hello ${user.fullName || "User"},</p><p>Your new verification code is: <strong style="font-size:1.5em;letter-spacing:2px;display:block;margin:10px 0;">${otpCode}</strong></p><p>It will expire in 10 minutes.</p></div>`,
        });
      } catch (err) {
        console.error("Failed to send OTP email:", err);
      }
    }

    res.json({ message: "OTP sent" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/verify-otp", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { code, type } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (!user.otpCode || user.otpCode !== code) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }
    if (user.otpExpiry && new Date() > user.otpExpiry) {
      res.status(400).json({ error: "Verification code has expired" });
      return;
    }
    const updateData: any = { otpCode: null, otpExpiry: null };
    if (type === "phone") updateData.phoneVerified = true;
    else updateData.emailVerified = true;
    const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, userId)).returning();
    res.json({
      success: true,
      message: type === "phone" ? "Phone verified successfully" : "Email verified successfully",
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        phoneNumber: updated.phoneNumber,
        phoneVerified: updated.phoneVerified,
        emailVerified: updated.emailVerified,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    if (req.body === undefined) {
      console.error("req.body is undefined on /login. Headers:", req.headers);
      req.body = {};
    }
    if (typeof req.body.email === "string") {
      req.body.email = req.body.email.toLowerCase();
    }
    const body = LoginBody.parse(req.body);
    const [user] = await db.select().from(usersTable).where(ilike(usersTable.email, body.email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // ── Student device-based login restriction (teachers/admins unaffected) ──
    let deviceIdForToken: number | undefined;
    let faceEnrollmentRequired = false;
    if (user.role === "student" && (await isDeviceEnforcementEnabled())) {
      if (user.accountBlocked) {
        res.status(403).json(ACCOUNT_BLOCKED_ERROR);
        return;
      }

      const fingerprint = typeof req.body.deviceFingerprint === "string" ? req.body.deviceFingerprint : null;
      if (fingerprint) {
        const trusted = await getTrustedDevice(user.id);

        if (!trusted) {
          // Grandfathering: existing student with no registered device —
          // this first device becomes the trusted device.
          const device = await registerTrustedDevice({
            studentId: user.id,
            fingerprint,
            deviceName: req.body.deviceName || null,
            platform: req.body.devicePlatform || null,
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
          });
          deviceIdForToken = device.id;
          // Prompt face enrollment if they have no stored face profile yet
          let profile: any = null;
          try { profile = user.biometricProfile ? JSON.parse(user.biometricProfile) : null; } catch {}
          faceEnrollmentRequired = !hasFaceProfile(profile?.face);
        } else if (trusted.deviceFingerprint === fingerprint) {
          // Known trusted device
          const { db: dbi, studentDevicesTable } = await import("@workspace/db");
          await dbi.update(studentDevicesTable)
            .set({ lastUsedAt: new Date(), lastIp: req.ip || null })
            .where(eq(studentDevicesTable.id, trusted.id));
          deviceIdForToken = trusted.id;

          // Periodic re-verification after a recent device switch
          if (needsReverification(user)) {
            res.status(403).json(REVERIFY_REQUIRED_ERROR);
            return;
          }
        } else {
          // Different device: warn — old device will be blocklisted; face check required
          res.status(409).json(NEW_DEVICE_ERROR);
          return;
        }
      }
      // No fingerprint sent (outdated client): allow login without device binding
    }

    if (!user.emailVerified && !user.phoneVerified) {
      const otpCode = generateOtp();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await db.update(usersTable).set({ otpCode, otpExpiry }).where(eq(usersTable.id, user.id));
      
      if (user.email) {
        // Fire-and-forget: respond immediately, email in background
        sendEmail({
          to: user.email,
          subject: "Libyan Learn Hub - Verification Code",
          text: `Hello ${user.fullName || "User"},\n\nYour account verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.`,
          html: `<div dir="ltr"><p>Hello ${user.fullName || "User"},</p><p>Your account verification code is: <strong style="font-size:1.5em;letter-spacing:2px;display:block;margin:10px 0;">${otpCode}</strong></p><p>It will expire in 10 minutes.</p></div>`,
        }).catch((err) => console.error("Failed to send OTP email:", err));
      }
      const token = signToken({ userId: user.id, role: user.role, ...(deviceIdForToken ? { deviceId: deviceIdForToken } : {}) });

      res.status(200).json({
        requireVerification: true,
        token,
        user: { email: user.email, role: user.role, phoneNumber: user.phoneNumber },
      });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role, ...(deviceIdForToken ? { deviceId: deviceIdForToken } : {}) });
    const plan = PLANS[(user.tier as TeacherTier) || "free"];
    res.json({
      faceEnrollmentRequired,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        fullNameAr: user.fullNameAr,
        role: user.role,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        bioAr: user.bioAr,
        language: user.language,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.phoneVerified,
        emailVerified: user.emailVerified,
        tier: user.tier,
        storageUsed: user.storageUsed,
        storageLimitBytes: plan.storageLimitBytes,
        isBonusUnlocked: user.isBonusUnlocked,
        balance: user.balance ?? "0",
        hasPasskey: !!user.passkeyHash,
        biometricsVerified: user.biometricsVerified,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err: any) {
    res.status(400).json({ error: "Validation failed", message: err.message });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out" });
});

router.post("/update-password", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Missing password fields" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Incorrect current password" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const plan = PLANS[(user.tier as TeacherTier) || "free"];
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    fullNameAr: user.fullNameAr,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    bioAr: user.bioAr,
    language: user.language,
    phoneNumber: user.phoneNumber,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    tier: user.tier,
    storageUsed: user.storageUsed,
    storageLimitBytes: plan.storageLimitBytes,
    isBonusUnlocked: user.isBonusUnlocked,
    balance: user.balance ?? "0",
    hasPasskey: !!user.passkeyHash,
    biometricsVerified: user.biometricsVerified,
    certificatesApproved: user.certificatesApproved,
    isTutoringEnabled: user.isTutoringEnabled,
    tutoringHourlyRate: user.tutoringHourlyRate ?? "0",
    tutoringSubjects: user.tutoringSubjects ?? null,
    tutoringLevels: user.tutoringLevels ?? null,
    commissionAgreed: user.commissionAgreed,
    tutoringSuspendedUntil: user.tutoringSuspendedUntil ?? null,
    createdAt: user.createdAt,
    // Teacher registration / approval workflow
    onboardingCompleted: user.onboardingCompleted,
    teacherApprovalStatus: user.teacherApprovalStatus ?? "not_submitted",
    teacherRejectionReason: user.teacherRejectionReason ?? null,
  });
});

// ── Set / Change Passkey ──────────────────────────────────────────────────
router.post("/set-passkey", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { passkey, currentPasskey } = req.body;

    if (!passkey || !/^\d{4}$/.test(passkey)) {
      res.status(400).json({ error: "Passkey must be exactly 4 digits" });
      return;
    }

    // If user already has a passkey, verify their current one first
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.passkeyHash && !currentPasskey) {
      res.status(400).json({ error: "Current passkey is required to set a new one" });
      return;
    }

    if (user.passkeyHash && currentPasskey) {
      const valid = await bcrypt.compare(currentPasskey, user.passkeyHash);
      if (!valid) {
        res.status(401).json({ error: "Incorrect current passkey" });
        return;
      }
    }

    const passkeyHash = await bcrypt.hash(passkey, 8);
    await db.update(usersTable)
      .set({ passkeyHash, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Passkey set successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Remove Passkey ────────────────────────────────────────────────────────
router.post("/remove-passkey", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { currentPasskey } = req.body;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.passkeyHash) {
      res.status(400).json({ error: "No passkey is set" });
      return;
    }

    if (!currentPasskey) {
      res.status(400).json({ error: "Current passkey is required" });
      return;
    }

    const valid = await bcrypt.compare(currentPasskey, user.passkeyHash);
    if (!valid) {
      res.status(401).json({ error: "Incorrect passkey" });
      return;
    }

    await db.update(usersTable)
      .set({ passkeyHash: null, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Passkey removed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ── Verify Passkey (unlock session) ──────────────────────────────────────
router.post("/verify-passkey", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { passkey } = req.body;

    if (!passkey) {
      res.status(400).json({ error: "Passkey is required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.passkeyHash) {
      // No passkey set — just allow through
      res.json({ success: true });
      return;
    }

    const valid = await bcrypt.compare(passkey, user.passkeyHash);
    if (!valid) {
      res.status(401).json({ error: "Incorrect passkey" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({ success: true, token });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    if (typeof req.body.email === "string") {
      req.body.email = req.body.email.toLowerCase();
    }
    const { email, phoneNumber } = req.body;
    if (!email && !phoneNumber) {
      res.status(400).json({ error: "Email or phone number is required" });
      return;
    }

    const query = email 
      ? eq(usersTable.email, email)
      : eq(usersTable.phoneNumber, phoneNumber);

    const [user] = await db.select().from(usersTable).where(query).limit(1);
    if (!user) {
      // For security, normally don't reveal if user exists, but here we can be helpful for dev
      res.status(400).json({ error: "User not found. Please register first." });
      return;
    }

    const otpCode = generateOtp();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await db.update(usersTable)
      .set({ otpCode, otpExpiry })
      .where(eq(usersTable.id, user.id));

    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: "Password Reset Code",
          text: `Your password reset code is: ${otpCode}. It will expire in 15 minutes.`,
          html: `<p>Your password reset code is: <strong>${otpCode}</strong></p><p>It will expire in 15 minutes.</p>`,
        });
      } catch (emailErr) {
        console.error("Failed to send email:", emailErr);
      }
    }

    // Only return mock OTP in development mode
    if (process.env.NODE_ENV === "development") {
      res.json({
        message: "Reset code sent",
        otpCode,
        otpMessage: user.phoneNumber
          ? `Your password reset code is: ${otpCode} (Mock SMS to ${user.phoneNumber})`
          : `Your password reset code is: ${otpCode} (Email sent to ${user.email})`,
      });
    } else {
      res.json({
        message: "Reset code sent",
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    if (typeof req.body.email === "string") {
      req.body.email = req.body.email.toLowerCase();
    }
    const { email, phoneNumber, otpCode, newPassword } = req.body;
    if ((!email && !phoneNumber) || !otpCode || !newPassword) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const query = email 
      ? eq(usersTable.email, email)
      : eq(usersTable.phoneNumber, phoneNumber);

    const [user] = await db.select().from(usersTable).where(query).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.otpCode || user.otpCode !== otpCode) {
      res.status(400).json({ error: "Invalid reset code" });
      return;
    }

    if (user.otpExpiry && new Date() > user.otpExpiry) {
      res.status(400).json({ error: "Reset code has expired" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable)
      .set({ 
        passwordHash, 
        otpCode: null, 
        otpExpiry: null,
        updatedAt: new Date() 
      })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Password has been reset successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
