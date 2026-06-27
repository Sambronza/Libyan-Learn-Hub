import { useState, useRef, useCallback, useEffect } from 'react';

const ROLLING_BUFFER_SECONDS = 120; // 2 minutes
const CANVAS_FPS = 15;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

/**
 * useMisbehaveRecording
 *
 * Maintains a continuous rolling buffer of the last 2 minutes of the session.
 * Records video + audio WITHOUT triggering any browser permission dialog by:
 *  - Compositing the LiveKit <video> elements onto a canvas via drawImage()
 *    (canvas.captureStream() requires zero permissions — these are local streams)
 *  - Mixing microphone audio (already granted since the user is in the room)
 *
 * Exposes:
 *  - `isRecording`: whether the rolling buffer is running
 *  - `triggerMisbehave(reason, description)`: flush the buffer → POST /misbehave
 *  - `startBuffer()` / `stopBuffer()`: lifecycle helpers called by TutoringRoom
 */
export function useMisbehaveRecording(requestId: number) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rolling circular buffer of MediaRecorder data chunks
  const chunksRef = useRef<{ blob: Blob; timestamp: number }[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Canvas compositing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Individual streams (so we can stop each cleanly)
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const mimeTypeRef = useRef<string>('');

  // ── Prune chunks older than ROLLING_BUFFER_SECONDS ─────────────────────────
  const pruneOldChunks = useCallback(() => {
    const cutoff = Date.now() - ROLLING_BUFFER_SECONDS * 1000;
    chunksRef.current = chunksRef.current.filter((c) => c.timestamp >= cutoff);
  }, []);

  // ── Find LiveKit video elements in the DOM ──────────────────────────────────
  // We look inside [data-recording-container] first, then fall back to all <video>s.
  const getLiveKitVideos = useCallback((): HTMLVideoElement[] => {
    const container =
      document.querySelector('[data-recording-container]') ?? document.body;
    const videos = Array.from(
      container.querySelectorAll<HTMLVideoElement>('video')
    ).filter(
      (v) =>
        !v.paused &&
        v.readyState >= 2 && // HAVE_CURRENT_DATA
        v.videoWidth > 0 &&
        v.videoHeight > 0
    );
    return videos;
  }, []);

  // ── Draw a composite frame onto the canvas ──────────────────────────────────
  const drawFrame = useCallback(
    (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const videos = getLiveKitVideos();

      ctx.fillStyle = '#020817'; // match LiveKit dark bg
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (videos.length === 0) {
        // Nothing to draw yet — blank dark frame
        return;
      }

      if (videos.length === 1) {
        // Single participant — fill the whole canvas
        ctx.drawImage(videos[0], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        // Multiple participants — tile side by side (up to 4)
        const cols = videos.length <= 2 ? 2 : 2;
        const rows = Math.ceil(videos.length / cols);
        const cellW = CANVAS_WIDTH / cols;
        const cellH = CANVAS_HEIGHT / rows;

        videos.slice(0, cols * rows).forEach((v, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = col * cellW;
          const y = row * cellH;

          // Letterbox inside the cell to preserve aspect ratio
          const vAspect = v.videoWidth / v.videoHeight;
          const cellAspect = cellW / cellH;
          let drawW: number, drawH: number, drawX: number, drawY: number;
          if (vAspect > cellAspect) {
            drawW = cellW;
            drawH = cellW / vAspect;
            drawX = x;
            drawY = y + (cellH - drawH) / 2;
          } else {
            drawH = cellH;
            drawW = cellH * vAspect;
            drawX = x + (cellW - drawW) / 2;
            drawY = y;
          }

          ctx.drawImage(v, drawX, drawY, drawW, drawH);
        });
      }
    },
    [getLiveKitVideos]
  );

  // ── Start the rolling buffer ────────────────────────────────────────────────
  const startBuffer = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
      // ── 1. Canvas video stream (NO permission dialog) ─────────────────────
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      canvasRef.current = canvas;

      // Start drawing frames
      frameTimerRef.current = setInterval(
        () => drawFrame(canvas, ctx),
        1000 / CANVAS_FPS
      );

      // Give LiveKit a moment to render its first frames before we start capturing
      await new Promise((r) => setTimeout(r, 500));

      const canvasStream = canvas.captureStream(CANVAS_FPS);
      canvasStreamRef.current = canvasStream;

      // ── 2. Mic audio (already granted — user is in the LiveKit session) ───
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStreamRef.current = micStream;
      } catch {
        // If mic access fails (unlikely since LiveKit already has it), continue video-only
        console.warn('[MisbehaveRecording] Mic unavailable — recording video only.');
      }

      // ── 3. Combine into a single MediaStream ─────────────────────────────
      const tracks: MediaStreamTrack[] = [
        ...canvasStream.getVideoTracks(),
        ...(micStream ? micStream.getAudioTracks() : []),
      ];
      const combinedStream = new MediaStream(tracks);

      // ── 4. Pick the best supported MIME type ─────────────────────────────
      const preferredMimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const mimeType =
        preferredMimeTypes.find(
          (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
        ) ?? '';
      mimeTypeRef.current = mimeType;

      // ── 5. Start MediaRecorder ────────────────────────────────────────────
      const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push({ blob: e.data, timestamp: Date.now() });
          pruneOldChunks();
        }
      };

      // Collect a chunk every second for fine-grained rolling buffer
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.warn('[MisbehaveRecording] Could not start rolling buffer:', err);
    }
  }, [pruneOldChunks, drawFrame]);

  // ── Stop canvas compositing and clean up streams ────────────────────────────
  const stopCompositing = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach((t) => t.stop());
      canvasStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    canvasRef.current = null;
  }, []);

  // ── Stop and clean up the rolling buffer ───────────────────────────────────
  const stopBuffer = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    stopCompositing();
    chunksRef.current = [];
    setIsRecording(false);
  }, [stopCompositing]);

  // ── Flush buffer and POST to /misbehave ─────────────────────────────────────
  const triggerMisbehave = useCallback(
    async (reason = 'inappropriate_behavior', description = '') => {
      setIsSubmitting(true);

      // Stop the recorder first so we get any final partial chunk
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        // Give browser a tick to fire onstop / ondataavailable
        await new Promise((r) => setTimeout(r, 300));
        mediaRecorderRef.current = null;
      }

      // Stop compositing so no more frames are drawn
      stopCompositing();

      // Prune and assemble the evidence blob from the rolling buffer
      pruneOldChunks();
      const blobParts = chunksRef.current.map((c) => c.blob);
      const evidenceBlob =
        blobParts.length > 0
          ? new Blob(blobParts, { type: mimeTypeRef.current || 'video/webm' })
          : null;

      chunksRef.current = [];
      setIsRecording(false);

      // Build FormData
      const formData = new FormData();
      formData.append('reason', reason);
      formData.append(
        'description',
        description || 'Session forcefully terminated via Misbehave button.'
      );
      if (evidenceBlob) {
        const ext = (mimeTypeRef.current || 'video/webm').includes('mp4') ? 'mp4' : 'webm';
        formData.append('recording', evidenceBlob, `misbehave-${requestId}.${ext}`);
      }

      const token = localStorage.getItem('lms_token');
      const res = await fetch(`/api/tutoring/requests/${requestId}/misbehave`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      setIsSubmitting(false);

      if (!res.ok) {
        // 409 = session already terminated by the other participant — treat as success
        if (res.status === 409) {
          return { success: true, alreadyTerminated: true };
        }
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.error ?? err.message ?? 'Failed to submit misbehave report');
      }

      return res.json();
    },
    [requestId, pruneOldChunks, stopCompositing]
  );

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      stopBuffer();
    };
  }, [stopBuffer]);

  return { isRecording, isSubmitting, startBuffer, stopBuffer, triggerMisbehave };
}
