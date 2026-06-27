import { useState, useRef, useCallback, useEffect } from 'react';

const ROLLING_BUFFER_SECONDS = 120; // 2 minutes

/**
 * useMisbehaveRecording
 *
 * Maintains a continuous rolling buffer of the last 2 minutes of the session
 * (audio + screen, or audio only if screen-capture is not supported/permitted).
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
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>('');

  // ── Prune chunks older than ROLLING_BUFFER_SECONDS ─────────────────────────
  const pruneOldChunks = useCallback(() => {
    const cutoff = Date.now() - ROLLING_BUFFER_SECONDS * 1000;
    chunksRef.current = chunksRef.current.filter((c) => c.timestamp >= cutoff);
  }, []);

  // ── Start the rolling buffer ────────────────────────────────────────────────
  const startBuffer = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
      // Prefer screen+audio; fall back to mic-only if user denies screen permission
      let combinedStream: MediaStream;
      try {
        const [screenStream, micStream] = await Promise.all([
          navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
          navigator.mediaDevices.getUserMedia({ audio: true }),
        ]);
        // Mix both into one stream
        combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...screenStream.getAudioTracks(),
          ...micStream.getAudioTracks(),
        ]);
      } catch {
        // Fallback: audio-only
        combinedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = combinedStream;

      const preferredMimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      const mimeType =
        preferredMimeTypes.find(
          (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
        ) ?? '';

      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push({ blob: e.data, timestamp: Date.now() });
          pruneOldChunks();
        }
      };

      // Collect a chunk every second so the buffer has fine-grained granularity
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.warn('[MisbehaveRecording] Could not start rolling buffer:', err);
    }
  }, [pruneOldChunks]);

  // ── Stop and clean up the rolling buffer ───────────────────────────────────
  const stopBuffer = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  // ── Flush buffer and POST to /misbehave ─────────────────────────────────────
  const triggerMisbehave = useCallback(
    async (reason = 'inappropriate_behavior', description = '') => {
      setIsSubmitting(true);

      // Stop the recorder first so we get any final partial chunk
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        // Give browser a tick to fire onstop / ondataavailable
        await new Promise((r) => setTimeout(r, 200));
        mediaRecorderRef.current = null;
      }

      // Prune and assemble the evidence blob from the rolling buffer
      pruneOldChunks();
      const blobParts = chunksRef.current.map((c) => c.blob);
      const evidenceBlob =
        blobParts.length > 0
          ? new Blob(blobParts, { type: mimeTypeRef.current || 'video/webm' })
          : null;

      // Stop all tracks now
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      chunksRef.current = [];
      setIsRecording(false);

      // Build FormData
      const formData = new FormData();
      formData.append('reason', reason);
      formData.append('description', description || 'Session forcefully terminated via Misbehave button.');
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
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.error ?? err.message ?? 'Failed to submit misbehave report');
      }

      return res.json();
    },
    [requestId, pruneOldChunks]
  );

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      stopBuffer();
    };
  }, [stopBuffer]);

  return { isRecording, isSubmitting, startBuffer, stopBuffer, triggerMisbehave };
}
