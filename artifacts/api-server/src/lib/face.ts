import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createRequire } from "module";

/**
 * Face descriptor matching utilities.
 *
 * Web clients compute 128-d descriptors client-side with @vladmandic/face-api
 * (same pipeline as teacher biometrics) and send the raw arrays.
 * Mobile clients send a photo; the server extracts the descriptor via
 * @vladmandic/face-api + @tensorflow/tfjs-node (lazy-loaded so the server
 * still boots if the native TF binding is unavailable on the host).
 */

export const DEFAULT_FACE_MATCH_THRESHOLD = 0.55;

export interface StoredFaceProfile {
  front?: number[];
  left?: number[];
  right?: number[];
  up?: number[];
  down?: number[];
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Minimum distance between a live descriptor and any stored pose. */
export function bestMatchDistance(descriptor: number[], stored: StoredFaceProfile): number {
  const poses = [stored.front, stored.left, stored.right, stored.up, stored.down];
  let best = Infinity;
  for (const pose of poses) {
    if (Array.isArray(pose) && pose.length > 0) {
      const d = euclideanDistance(descriptor, pose);
      if (d < best) best = d;
    }
  }
  return best;
}

export function hasFaceProfile(stored: StoredFaceProfile | null | undefined): boolean {
  if (!stored) return false;
  const poses = ["front", "left", "right", "up", "down"] as const;
  return poses.every((p) => Array.isArray(stored[p]) && stored[p]!.length > 0);
}

export async function getFaceMatchThreshold(): Promise<number> {
  try {
    const [setting] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "face_match_threshold"))
      .limit(1);
    if (setting?.value) {
      const parsed = parseFloat(setting.value);
      if (!isNaN(parsed) && parsed > 0 && parsed < 2) return parsed;
    }
  } catch (err) {
    console.error("Failed to read face_match_threshold setting", err);
  }
  return DEFAULT_FACE_MATCH_THRESHOLD;
}

// ── Server-side descriptor extraction (mobile image uploads) ────────────────

let faceApiPromise: Promise<any> | null = null;

async function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      // Dynamic imports keep the heavy TF dependency out of the boot path.
      const tf = await import("@tensorflow/tfjs-node");
      const faceapi = await import("@vladmandic/face-api");
      // @vladmandic/face-api ships its model weights in the package's model/ dir
      // createRequire(__filename) works in both ESM (where esbuild injects __filename)
      // and native CJS, and avoids the import.meta.url which esbuild warns about.
      const _require = createRequire(__filename);
      const pkgPath = _require.resolve("@vladmandic/face-api/package.json");
      const { dirname, join } = await import("path");
      const modelPath = process.env.FACE_MODELS_PATH || join(dirname(pkgPath), "model");
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
      return { tf, faceapi };
    })();
  }
  return faceApiPromise;
}

/**
 * Extract a 128-d face descriptor from an image buffer (JPEG/PNG).
 * Returns null when no face is detected.
 * Throws if the TF runtime is unavailable on this host.
 */
export async function extractDescriptorFromImage(imageBuffer: Buffer): Promise<number[] | null> {
  const { tf, faceapi } = await loadFaceApi();
  const tensor = tf.node.decodeImage(imageBuffer, 3);
  try {
    const detection = await faceapi
      .detectSingleFace(tensor as any)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) return null;
    return Array.from(detection.descriptor);
  } finally {
    tensor.dispose();
  }
}

/** Decode a data-URL or raw base64 string into a Buffer. */
export function decodeBase64Image(input: string): Buffer {
  const base64 = input.includes(",") ? input.split(",")[1] : input;
  return Buffer.from(base64, "base64");
}
