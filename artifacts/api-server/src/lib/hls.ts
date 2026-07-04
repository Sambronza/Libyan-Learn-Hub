import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
import http from "http";
import ffmpegPath from "ffmpeg-static";
import { db } from "@workspace/db";
import { lessonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { cloudinary } from "./cloudinary.js";

/**
 * AES-128 HLS encryption pipeline (content protection, phase 2).
 *
 * On demand (new upload or backfill), a lesson's MP4 is downloaded, split by
 * ffmpeg into AES-128-encrypted ~10s segments, the segments are uploaded to
 * Cloudinary as raw files (useless without the key), and the rewritten m3u8
 * playlist is stored in the DB with a __KEY_URI__ placeholder. The 16-byte key
 * lives ONLY in the lessons row and is served exclusively through the
 * tokenized /api/video/hls-key endpoint (subscription + device checks).
 */

const queue: number[] = [];
const queued = new Set<number>();
let processing = false;

/** Fire-and-forget: enqueue a lesson for HLS encryption (deduplicated). */
export function enqueueHlsEncryption(lessonId: number): void {
  if (queued.has(lessonId)) return;
  queued.add(lessonId);
  queue.push(lessonId);
  void processQueue();
}

export function hlsQueueStatus() {
  return { pending: queue.length, processing };
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const lessonId = queue.shift()!;
      try {
        await encryptLessonVideo(lessonId);
        console.log(`[HLS] Lesson ${lessonId} encrypted successfully.`);
      } catch (err) {
        console.error(`[HLS] Failed to encrypt lesson ${lessonId} (non-fatal):`, err);
      } finally {
        queued.delete(lessonId);
      }
    }
  } finally {
    processing = false;
  }
}

function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadToFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", (err) => { file.close(); reject(err); });
  });
}

function runFfmpeg(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as unknown as string, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
    proc.on("error", reject);
  });
}

function uploadRawFile(filePath: string, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      { resource_type: "raw", public_id: publicId, overwrite: true },
      (err: any, result: any) => (err ? reject(err) : resolve(result.secure_url)),
    );
  });
}

/** Encrypt one lesson's video into AES-128 HLS. Idempotent (skips if done). */
export async function encryptLessonVideo(lessonId: number): Promise<void> {
  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId)).limit(1);
  if (!lesson) throw new Error("Lesson not found");
  if (lesson.hlsEncrypted) return; // already done
  const sourceUrl = lesson.videoFilePath
    ? lesson.videoFilePath.replace("/sp_hd/", "/").replace("/f_m3u8/", "/").replace(".m3u8", ".mp4")
    : lesson.videoUrl;
  if (!sourceUrl) throw new Error("Lesson has no video");

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `hls-${lessonId}-`));
  try {
    // 1. Download the source
    const input = path.join(workDir, "input.mp4");
    await downloadToFile(sourceUrl, input);

    // 2. Generate the AES-128 key + ffmpeg key-info file
    const key = crypto.randomBytes(16);
    const keyPath = path.join(workDir, "enc.key");
    fs.writeFileSync(keyPath, key);
    const keyInfoPath = path.join(workDir, "enc.keyinfo");
    // Line 1: the URI written into the playlist (placeholder, replaced at serve time)
    // Line 2: local path of the key for ffmpeg to encrypt with
    fs.writeFileSync(keyInfoPath, `__KEY_URI__\n${keyPath}\n`);

    // 3. Split + encrypt (stream copy — no re-encode, fast and lossless)
    await runFfmpeg([
      "-y", "-i", input,
      "-c", "copy",
      "-hls_time", "10",
      "-hls_playlist_type", "vod",
      "-hls_key_info_file", keyInfoPath,
      "-hls_segment_filename", path.join(workDir, "seg%04d.ts"),
      path.join(workDir, "index.m3u8"),
    ], workDir);

    // 4. Upload encrypted segments to Cloudinary (raw — undecodable without key)
    const segmentFiles = fs.readdirSync(workDir).filter((f) => f.endsWith(".ts")).sort();
    if (segmentFiles.length === 0) throw new Error("ffmpeg produced no segments");
    const urlBySegment = new Map<string, string>();
    for (const seg of segmentFiles) {
      const url = await uploadRawFile(path.join(workDir, seg), `lms_hls/lesson_${lessonId}/${seg}`);
      urlBySegment.set(seg, url);
    }

    // 5. Rewrite the playlist: segment names -> absolute Cloudinary URLs
    let playlist = fs.readFileSync(path.join(workDir, "index.m3u8"), "utf8");
    for (const [seg, url] of urlBySegment) {
      playlist = playlist.replace(new RegExp(`^${seg}$`, "m"), url);
    }

    // 6. Persist: playlist template + key (DB only) + flag
    await db.update(lessonsTable)
      .set({
        hlsEncrypted: true,
        hlsKeyHex: key.toString("hex"),
        hlsPlaylist: playlist,
        updatedAt: new Date(),
      })
      .where(eq(lessonsTable.id, lessonId));
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
