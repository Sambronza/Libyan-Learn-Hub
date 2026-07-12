import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { Loader2, Camera, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Pose = "front" | "left" | "right" | "up" | "down";

const POSES: Array<{ id: Pose; label: string; labelAr: string; hint: string; hintAr: string }> = [
  { id: "front", label: "Look Straight", labelAr: "انظر للأمام", hint: "Face the camera directly", hintAr: "واجه الكاميرا مباشرة" },
  { id: "left", label: "Look Left", labelAr: "انظر لليسار", hint: "Turn your head to the left", hintAr: "أدر رأسك إلى اليسار" },
  { id: "right", label: "Look Right", labelAr: "انظر لليمين", hint: "Turn your head to the right", hintAr: "أدر رأسك إلى اليمين" },
  { id: "up", label: "Look Up", labelAr: "انظر للأعلى", hint: "Tilt your head upward", hintAr: "ارفع رأسك للأعلى" },
  { id: "down", label: "Look Down", labelAr: "انظر للأسفل", hint: "Tilt your head downward", hintAr: "اخفض رأسك للأسفل" },
];

interface FaceEnrollProps {
  /** Fires when all 5 poses are captured. snapshot = front-pose JPEG data-URL. */
  onComplete: (descriptors: Record<string, number[]>, snapshot: string | null) => void;
  onError?: (message: string) => void;
}

/**
 * 5-pose face enrollment widget for student signup (same auto-capture pipeline
 * as the teacher BiometricsSetup page). Descriptors are computed client-side
 * with @vladmandic/face-api models served from /models.
 */
export function FaceEnroll({ onComplete, onError }: FaceEnrollProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef<Record<string, number[]>>({});
  const snapshotRef = useRef<string | null>(null);
  const doneRef = useRef(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captured, setCaptured] = useState<Record<string, number[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch {
        onError?.(isAr ? "فشل تحميل نماذج التعرف على الوجه." : "Failed to load face-recognition models.");
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }
      })
      .catch(() => onError?.(isAr ? "تعذّر الوصول إلى الكاميرا." : "Camera access denied or unavailable."));

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const takeSnapshot = (): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  // 200ms polling loop — fast enough to feel instant, avoids overlapping detections
  useEffect(() => {
    if (!modelsLoaded || !cameraReady) return;
    capturedRef.current = {};
    doneRef.current = false;
    setCaptured({});

    let active = true;
    const detect = async () => {
      if (!active || doneRef.current || !videoRef.current) return;
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!active || doneRef.current || !detection) return;

        const landmarks = detection.landmarks;
        const nose = landmarks.getNose()[3];
        const noseBridge = landmarks.getNose()[0];
        const jawline = landmarks.getJawOutline();
        const yawRatio = Math.hypot(nose.x - jawline[0].x, nose.y - jawline[0].y) /
          Math.hypot(nose.x - jawline[16].x, nose.y - jawline[16].y);
        const pitchRatio = Math.hypot(nose.x - jawline[8].x, nose.y - jawline[8].y) /
          Math.hypot(nose.x - noseBridge.x, nose.y - noseBridge.y);

        let pose: Pose | null = null;
        if (yawRatio < 0.6) pose = "left";
        else if (yawRatio > 1.6) pose = "right";
        else if (pitchRatio < 0.85) pose = "down";
        else if (pitchRatio > 1.8) pose = "up";
        else if (yawRatio > 0.8 && yawRatio < 1.2 && pitchRatio > 0.9 && pitchRatio < 1.4) pose = "front";

        if (pose && !capturedRef.current[pose]) {
          capturedRef.current = { ...capturedRef.current, [pose]: Array.from(detection.descriptor) };
          if (pose === "front") snapshotRef.current = takeSnapshot();
          setCaptured({ ...capturedRef.current });

          if (Object.keys(capturedRef.current).length === POSES.length) {
            doneRef.current = true;
            active = false;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            onComplete(capturedRef.current, snapshotRef.current);
          }
        }
      } catch (err) {
        console.error("Face enroll error:", err);
      }
    };

    const intervalId = setInterval(detect, 200);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [modelsLoaded, cameraReady]);

  const capturedCount = Object.keys(captured).length;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-full max-w-sm bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border-2 border-primary/20">
        {!cameraReady && (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">
              {modelsLoaded ? (isAr ? "جارٍ تشغيل الكاميرا…" : "Starting camera…") : (isAr ? "جارٍ تحميل النماذج…" : "Loading AI models…")}
            </span>
          </div>
        )}
        <video
          ref={videoRef}
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity ${cameraReady ? "opacity-100" : "opacity-0"}`}
        />
        {cameraReady && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <span className="text-white/90 text-xs bg-black/50 px-2 py-0.5 rounded-full">
              {capturedCount}/{POSES.length}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 w-full max-w-sm">
        {POSES.map((p) => {
          const isCaptured = !!captured[p.id];
          return (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isCaptured ? "bg-success/100" : "bg-muted animate-pulse"}`}>
                {isCaptured ? <CheckCircle className="w-4 h-4 text-white" /> : <Camera className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <span className={`text-[10px] font-medium text-center ${isCaptured ? "text-success" : "text-muted-foreground"}`}>
                {isAr ? p.labelAr : p.label}
              </span>
            </div>
          );
        })}
      </div>

      {cameraReady && capturedCount < POSES.length && (
        <p className="text-sm text-primary font-medium animate-pulse text-center">
          {(() => {
            const next = POSES.find((p) => !captured[p.id]);
            return next ? `👉 ${isAr ? next.hintAr : next.hint}` : "";
          })()}
        </p>
      )}
    </div>
  );
}
