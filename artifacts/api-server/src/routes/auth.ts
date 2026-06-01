import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth.js";
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
    
    // Support phoneNumber in the validation gracefully
    const body = RegisterBody.passthrough().parse(req.body);
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, body.email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const passkeyHash = body.passkey ? await bcrypt.hash(body.passkey, 10) : null;
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

    const [user] = await db.insert(usersTable).values({
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
    const token = signToken({ userId: user.id, role: user.role });
    const plan = PLANS[(user.tier as TeacherTier) || "free"];

    if (!user.phoneNumber && user.email) {
      sendEmail({
        to: user.email,
        subject: "Welcome to Libyan Learn Hub - Verification Code",
        text: `Hello ${user.fullName},\n\nYour email verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.`,
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
        createdAt: user.createdAt,
      },
      token,
      otpCode,
      otpMessage: user.phoneNumber
        ? `Your verification code is: ${otpCode} (In production this would be sent via SMS to ${user.phoneNumber})`
        : `Your email verification code is: ${otpCode}`,
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

    if (!user.phoneNumber && user.email) {
      sendEmail({
        to: user.email,
        subject: "Libyan Learn Hub - Verification Code",
        text: `Hello ${user.fullName || "User"},\n\nYour new email verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.`,
      }).catch((err) => console.error("Failed to send OTP email:", err));
    }

    res.json({
      message: "OTP sent",
      otpCode,
      otpMessage: user.phoneNumber
        ? `Your verification code is: ${otpCode} (In production this would be sent via SMS to ${user.phoneNumber})`
        : `Your verification code is: ${otpCode}`,
    });
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
    const body = LoginBody.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, body.email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ userId: user.id, role: user.role });
    const plan = PLANS[(user.tier as TeacherTier) || "free"];
    res.json({
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
    createdAt: user.createdAt,
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

    const passkeyHash = await bcrypt.hash(passkey, 10);
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

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
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

    if (!user.phoneNumber && user.email) {
      sendEmail({
        to: user.email,
        subject: "Libyan Learn Hub - Password Reset",
        text: `Hello ${user.fullName || "User"},\n\nYour password reset code is: ${otpCode}\n\nThis code will expire in 15 minutes.`,
      }).catch((err) => console.error("Failed to send password reset email:", err));
    }

    res.json({
      message: "Reset code sent",
      otpCode, // Returned for dev purposes
      otpMessage: user.phoneNumber
        ? `Your password reset code is: ${otpCode} (Mock SMS to ${user.phoneNumber})`
        : `Your password reset code is: ${otpCode} (Mock Email to ${user.email})`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  try {
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
