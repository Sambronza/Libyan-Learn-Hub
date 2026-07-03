import { useState, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useApi } from './useApi';

export function useLocalRecording(sessionName: string, onRecordingSaved?: (url: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = useCallback(async () => {
    try {
      // 1. Capture screen and tab audio (the remote participants' voices)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true
      });

      // 2. Capture teacher's microphone
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
      } catch (err) {
        console.warn("Could not capture microphone, recording will proceed without it.", err);
        toast.error("Could not capture microphone for recording.");
      }

      // 3. Mix the audio streams
      const audioContext = new AudioContext();
      const dest = audioContext.createMediaStreamDestination();

      if (displayStream.getAudioTracks().length > 0) {
        const displaySource = audioContext.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]));
        displaySource.connect(dest);
      }

      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]]));
        micSource.connect(dest);
      }

      // 4. Combine video from screen and mixed audio
      const tracks = [
        ...displayStream.getVideoTracks(),
        ...dest.stream.getTracks()
      ];
      
      const combinedStream = new MediaStream(tracks);

      // Handle user stopping screen share natively from browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      // 5. Initialize MediaRecorder, preferring MP4 if supported
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          mimeType = 'video/mp4;codecs=avc1';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType
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
        
        // Cleanup tracks and audio context
        displayStream.getTracks().forEach(t => t.stop());
        if (micStream) {
          micStream.getTracks().forEach(t => t.stop());
        }
        audioContext.close();
        setIsRecording(false);

        // Upload to server
        setIsUploading(true);
        const loadingToast = toast.loading("Saving recording to Cloudinary... Please wait.");
        try {
          const formData = new FormData();
          const safeName = sessionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const fileName = `Recording-${safeName}-${new Date().toISOString().slice(0,10)}.${fileExtension}`;
          formData.append('video', blob, fileName);

          const token = localStorage.getItem('lms_token');
          const res = await fetch(`/api/upload/video`, {
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
          toast.success("Recording saved successfully!", { id: loadingToast });
          if (onRecordingSaved) {
            onRecordingSaved(data.url);
          }
        } catch (err: any) {
          console.error("Upload error:", err);
          toast.error(`Failed to save recording: ${err.message}`, { id: loadingToast });
          
          // Fallback to local download if upload fails
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `Fallback-Recording-${Date.now()}.${fileExtension}`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        } finally {
          setIsUploading(false);
        }
      };

      // Start recording with 1s chunks
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast.error("Screen recording was cancelled or blocked.");
      } else if (err.name === 'TypeError' || !navigator.mediaDevices?.getDisplayMedia) {
        toast.error("Screen recording is not supported on this device (e.g., mobile/tablet browsers). Please use a desktop computer.");
      } else {
        toast.error("Failed to start recording.");
        console.error("Recording error:", err);
      }
    }
  }, [sessionName, onRecordingSaved]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const isSupported = typeof navigator !== 'undefined' && 
    !!navigator.mediaDevices && 
    !!navigator.mediaDevices.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined';

  return { isRecording, isUploading, startRecording, stopRecording, isSupported };
}
