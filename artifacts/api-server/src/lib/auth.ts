import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}

const SECRET = JWT_SECRET || "lms-libya-secret-2024-dev";

export interface AuthPayload {
  userId: number;
  role: string;
  /** Student tokens are bound to their trusted device (device-based login restriction). */
  deviceId?: number;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, SECRET) as AuthPayload;
}

// ── Device/block enforcement cache ──────────────────────────────────────────
// Avoids a DB round-trip on every request; entries live for 60s so a
// blocklisted device or blocked account dies within a minute at worst.
type DeviceCheckState = { ok: boolean; expires: number };
const deviceCheckCache = new Map<string, DeviceCheckState>();
const DEVICE_CHECK_TTL = 60 * 1000;

/** Drop cached entries for a student (call after blocking a device/account). */
export function invalidateDeviceCheckCache(userId: number) {
  for (const key of deviceCheckCache.keys()) {
    if (key.startsWith(`${userId}:`)) deviceCheckCache.delete(key);
  }
}

async function isStudentDeviceValid(userId: number, deviceId: number): Promise<boolean> {
  const key = `${userId}:${deviceId}`;
  const cached = deviceCheckCache.get(key);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.ok;

  let ok = false;
  try {
    const { db, usersTable, studentDevicesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const [user] = await db.select({ accountBlocked: usersTable.accountBlocked })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (user && !user.accountBlocked) {
      const [device] = await db.select({ status: studentDevicesTable.status })
        .from(studentDevicesTable)
        .where(and(eq(studentDevicesTable.id, deviceId), eq(studentDevicesTable.studentId, userId)))
        .limit(1);
      ok = device?.status === "trusted";
    }
  } catch (err) {
    // On DB failure, fail open so a transient outage doesn't lock everyone out
    console.error("Device check failed (failing open):", err);
    ok = true;
  }
  deviceCheckCache.set(key, { ok, expires: now + DEVICE_CHECK_TTL });
  return ok;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }
  const token = authHeader.slice(7);
  let payload: AuthPayload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    return;
  }

  // Device-bound student tokens: reject if the device was blocklisted or the
  // account blocked since the token was issued (kills old 24h tokens fast).
  if (payload.role === "student" && payload.deviceId) {
    const valid = await isStudentDeviceValid(payload.userId, payload.deviceId);
    if (!valid) {
      res.status(401).json({
        error: "Unauthorized",
        code: "DEVICE_REVOKED",
        message: "This device no longer has access to the account. Please log in again.",
        messageAr: "لم يعد هذا الجهاز يملك صلاحية الوصول إلى الحساب. يرجى تسجيل الدخول مرة أخرى.",
      });
      return;
    }
  }

  (req as any).user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthPayload | undefined;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}
