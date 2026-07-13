import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import multer from "multer";
import { uploadToCloudinary } from "../lib/cloudinary.js";

const router = Router();

// Safe JSON parse helper — returns default if value is null/invalid
function safeParseJson(value: string | null | undefined, defaultValue: any = {}) {
  if (!value) return defaultValue;
  try { return JSON.parse(value); } catch { return defaultValue; }
}

const storage = multer.memoryStorage();
const audioUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio/video files are allowed"));
    }
  },
});

// 1. Setup Face Descriptors
router.post("/setup-face", requireAuth, requireRole("teacher"), async (req, res): Promise<any> => {
  try {
    const { faceDescriptors } = req.body;
    if (!faceDescriptors || !faceDescriptors.front || !faceDescriptors.left || !faceDescriptors.right || !faceDescriptors.up || !faceDescriptors.down) {
      return res.status(400).json({ error: "Missing all 5 face descriptors." });
    }

    // Get existing biometric profile or create new
    const reqUser = req.user!;
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, reqUser.userId),
    });

    let profile = safeParseJson(user?.biometricProfile, { face: {}, voice: {} });
    profile.face = faceDescriptors;

    await db
      .update(usersTable)
      .set({ biometricProfile: JSON.stringify(profile) })
      .where(eq(usersTable.id, reqUser.userId));

    res.json({ message: "Facial descriptors saved successfully." });
  } catch (error: any) {
    console.error("Setup Face Error:", error);
    res.status(500).json({ error: "Failed to save facial descriptors." });
  }
});

// 2. Get Voice Script
const SCRIPTS = [
  "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.",
  "The beautiful thing about learning is that no one can take it away from you.",
  "Develop a passion for learning. If you do, you will never cease to grow.",
  "Teachers can open the door, but you must enter it yourself."
];

router.get("/voice-script", requireAuth, requireRole("teacher"), (req, res) => {
  const script = SCRIPTS[Math.floor(Math.random() * SCRIPTS.length)];
  res.json({ script });
});

// 3. Setup Voice Recording
router.post("/setup-voice", requireAuth, requireRole("teacher"), audioUpload.single("audio"), async (req, res): Promise<any> => {
  try {
    const { scriptText } = req.body;
    if (!req.file || !scriptText) {
      return res.status(400).json({ error: "Audio file and script text are required." });
    }

    const reqUser = req.user!;
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, reqUser.userId),
    });

    // Upload audio to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "lms_voice_samples",
      resource_type: "video", // Cloudinary uses 'video' for audio
    });

    let profile = safeParseJson(user?.biometricProfile, { face: {}, voice: {} });
    profile.voice = {
      scriptText,
      audioUrl: result.secure_url,
      status: "verified",
    };

    // All 5 required face poses must be present before we mark as verified
    const requiredPoses = ["front", "left", "right", "up", "down"];
    const hasFace = profile.face && requiredPoses.every((p) => Array.isArray(profile.face[p]) && profile.face[p].length > 0);
    
    await db
      .update(usersTable)
      .set({ 
        voiceSampleUrl: result.secure_url,
        biometricProfile: JSON.stringify(profile),
        biometricsVerified: hasFace ? true : false,
        onboardingCompleted: hasFace ? true : false // Also mark onboarding as complete
      })
      .where(eq(usersTable.id, reqUser.userId));

    res.json({ 
      message: "Voice sample saved and biometrics verified.", 
      verified: hasFace 
    });
  } catch (error: any) {
    console.error("Setup Voice Error:", error);
    res.status(500).json({ 
      error: "Failed to save voice sample.", 
      details: error?.message || String(error)
    });
  }
});

export default router;
