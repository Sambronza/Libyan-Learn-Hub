import { useState, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export function useAudioRecording(requestId: number, onRecordingSaved?: (url: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    // Guard: don't double-start
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.warn('[AudioRecording] Already recording, ignoring duplicate start.');
      return;
    }
    try {
      // Capture microphone only
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = micStream;
      } catch (err) {
        toast.error("Microphone access is required for tutoring session recording.");
        return;
      }

      // Initialize MediaRecorder — pick best supported audio mime type
      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = preferredMimeTypes.find(
        (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
      );

      const mediaRecorder = new MediaRecorder(micStream, {
        ...(mimeType ? { mimeType } : {}), // omit mimeType entirely if none supported to use browser default
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const fileExtension = mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        chunksRef.current = [];
        
        // Cleanup tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        
        setIsRecording(false);

        // Upload to server
        setIsUploading(true);
        try {
          const formData = new FormData();
          const fileName = `session-${requestId}-audio.${fileExtension}`;
          formData.append('audio', blob, fileName);

          const token = localStorage.getItem('lms_token');
          const res = await fetch(`/api/tutoring/requests/${requestId}/upload-audio`, {
            method: 'POST',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(err.error ?? err.message ?? res.statusText);
          }

          const data = await res.json();
          if (onRecordingSaved) {
            onRecordingSaved(data.recordingUrl);
          }
        } catch (err: any) {
          console.error("Audio upload error:", err);
          // We fail silently or log to console. We do not want to block the user or show scary errors if temp audio fails unless absolutely needed.
          // But for admin transparency, we can show a subtle toast.
          toast.error("Failed to upload session audio securely.");
        } finally {
          setIsUploading(false);
        }
      };

      // Start recording with 1s chunks
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

    } catch (err: any) {
      toast.error("Failed to start audio recording.");
      console.error("Audio Recording error:", err);
    }
  }, [requestId, onRecordingSaved]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null; // clear ref so we can't double-stop
    }
  }, []);

  const isSupported = typeof navigator !== 'undefined' && 
    !!navigator.mediaDevices && 
    !!navigator.mediaDevices.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  return { isRecording, isUploading, startRecording, stopRecording, isSupported };
}
