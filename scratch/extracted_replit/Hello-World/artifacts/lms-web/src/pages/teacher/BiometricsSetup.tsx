import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Mic, CheckCircle, ShieldCheck } from "lucide-react";
import * as faceapi from "@vladmandic/face-api";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type Pose = "front" | "left" | "right" | "up" | "down";

const POSES: Array<{ id: Pose; label: string; hint: string }> = [
  { id: "front", label: "Look Straight",  hint: "Face the camera directly" },
  { id: "left",  label: "Look Left",      hint: "Turn your head to the left" },
  { id: "right", label: "Look Right",     hint: "Turn your head to the right" },
  { id: "up",    label: "Look Up",        hint: "Tilt your head upward" },
  { id: "down",  label: "Look Down",      hint: "Tilt your head downward" },
];

export default function BiometricsSetup() {
  const { user, refetchUser } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const { toast } = useToast();

  const [step, setStep] = useState<"intro" | "face" | "voice" | "done">("intro");

  // ── Face Phase ─────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedDescriptors, setCapturedDescriptors] = useState<Record<string, number[]>>({});
  const [isProcessingFace, setIsProcessingFace] = useState(false);

  // Refs to avoid stale closures inside async interval
  const capturedRef = useRef<Record<string, number[]>>({});
  const submittingRef = useRef(false);

  // ── Voice Phase ────────────────────────────────────────────────────────────
  const [script, setScript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already verified
  useEffect(() => {
    if (user?.biometricsVerified) {
      setLocation("/teacher/dashboard");
    }
  }, [user, setLocation]);

  // ── Load face-api models when entering face step ───────────────────────────
  useEffect(() => {
    if (step !== "face") return;
    (async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelsLoaded(true);
      } catch {
        toast({ title: "Error loading face-recognition models. Please reload.", variant: "destructive" });
      }
    })();
  }, [step]);

  // ── Start / stop camera when face step is active ───────────────────────────
  useEffect(() => {
    if (step !== "face") return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsCameraReady(true);
        }
      })
      .catch(() => toast({ title: "Camera access denied or unavailable.", variant: "destructive" }));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsCameraReady(false);
    };
  }, [step]);

  // ── Face Tracking Loop ─────────────────────────────────────────────────────
  //
  // Design decisions that avoid common bugs:
  //  1. capturedRef / submittingRef are used instead of state inside the loop.
  //     Reading React state inside an async callback always returns the stale
  //     value from when the effect ran — using refs avoids this entirely.
  //  2. setInterval (200ms) instead of requestAnimationFrame: rAF fires at 60fps
  //     but faceapi.detectSingleFace takes ~100-200ms. Using rAF would queue
  //     dozens of overlapping async calls. setInterval naturally rate-limits.
  //  3. Side-effects (toast, api.post, setStep) are invoked directly, NEVER
  //     inside a setState updater. setState updaters must be pure.
  //  4. submittingRef guards against double API submission if the interval fires
  //     again before the first submission has finished.
  useEffect(() => {
    if (step !== "face" || !isModelsLoaded || !isCameraReady) return;

    // Reset state each time we enter the face step (in case user retries)
    capturedRef.current = {};
    submittingRef.current = false;
    setCapturedDescriptors({});
    setIsProcessingFace(false);

    let active = true;

    const detect = async () => {
      if (!active || submittingRef.current || !videoRef.current) return;

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        // Check if still active after the async await (user may have navigated away)
        if (!active || submittingRef.current) return;

        if (detection) {
          const landmarks = detection.landmarks;
          const nose      = landmarks.getNose()[3];   // nose tip
          const noseBridge = landmarks.getNose()[0];  // nose bridge
          const jawline   = landmarks.getJawOutline();
          const leftJaw   = jawline[0];
          const rightJaw  = jawline[16];
          const chin      = jawline[8];

          // Yaw: if nose-tip is closer to left jaw → head turned left
          const distLeft  = Math.hypot(nose.x - leftJaw.x,  nose.y - leftJaw.y);
          const distRight = Math.hypot(nose.x - rightJaw.x, nose.y - rightJaw.y);
          const yawRatio  = distLeft / distRight;

          // Pitch: if chin is relatively close to nose → head tilted down
          const distTop    = Math.hypot(nose.x - noseBridge.x, nose.y - noseBridge.y);
          const distBottom = Math.hypot(nose.x - chin.x,       nose.y - chin.y);
          const pitchRatio = distBottom / distTop;

          let detectedPose: Pose | null = null;
          if      (yawRatio < 0.6)   detectedPose = "left";
          else if (yawRatio > 1.6)   detectedPose = "right";
          else if (pitchRatio < 0.85) detectedPose = "down"; // Relaxed threshold for 'down'
          else if (pitchRatio > 1.8) detectedPose = "up";
          else if (yawRatio > 0.8 && yawRatio < 1.2 && pitchRatio > 0.9 && pitchRatio < 1.4) {
            detectedPose = "front";
          }

          if (detectedPose && !capturedRef.current[detectedPose]) {
            // Capture this new pose
            const descriptor = Array.from(detection.descriptor);
            capturedRef.current = { ...capturedRef.current, [detectedPose]: descriptor };

            const label = POSES.find(p => p.id === detectedPose)?.label ?? detectedPose;
            toast({ title: `✓ ${label} captured!` });

            // Update UI state (reads capturedRef, not stale state)
            setCapturedDescriptors({ ...capturedRef.current });

            // All 5 poses collected → submit
            if (Object.keys(capturedRef.current).length === POSES.length) {
              // Prevent double submission if interval fires again before await finishes
              if (submittingRef.current) return;
              submittingRef.current = true;
              active = false; // stop the loop
              setIsProcessingFace(true);

              try {
                await api.post("/biometrics/setup-face", { faceDescriptors: capturedRef.current });
                streamRef.current?.getTracks().forEach((t) => t.stop());
                toast({ title: "✅ Face setup complete!" });
                setStep("voice");
              } catch (err: any) {
                toast({ title: "Error submitting face data: " + (err?.message ?? "unknown"), variant: "destructive" });
                // Allow retry
                submittingRef.current = false;
                setIsProcessingFace(false);
                active = true;
              }
            }
          }
        }
      } catch (err) {
        console.error("Face tracking error:", err);
      }
    };

    // 200ms is fast enough to feel instant, slow enough to avoid overlapping calls
    const intervalId = setInterval(detect, 200);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [step, isModelsLoaded, isCameraReady]);

  // ── Fetch voice script when entering voice step ────────────────────────────
  useEffect(() => {
    if (step !== "voice") return;
    api.get("/biometrics/voice-script").then((res: any) => setScript(res.script ?? ""));
  }, [step]);

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Microphone access denied.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const submitVoice = async () => {
    if (!audioBlob) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("lms_token");
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice_sample.webm");
      formData.append("scriptText", script);

      const res = await fetch("/api/biometrics/setup-voice", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.details ? `${err.error}: ${err.details}` : (err.error ?? res.statusText));
      }

      await refetchUser();
      toast({ title: "✅ Biometric setup complete! You are now verified." });
      setStep("done");
    } catch (err: any) {
      toast({ title: "Failed to upload voice sample: " + (err?.message ?? "unknown"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const capturedCount = Object.keys(capturedDescriptors).length;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
        <h1 className="text-3xl font-bold">Teacher Identity Verification</h1>
        <p className="text-muted-foreground text-sm">One-time biometric setup — required to create and upload content</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-3">
        {(["intro", "face", "voice", "done"] as const).map((s, i) => (
          <React.Fragment key={s}>
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                step === s
                  ? "bg-primary scale-125"
                  : (["intro", "face", "voice", "done"] as const).indexOf(step) > i
                    ? "bg-green-500"
                    : "bg-muted"
              }`}
            />
            {i < 3 && <div className="w-8 h-0.5 bg-muted" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── INTRO ── */}
      {step === "intro" && (
        <div className="text-center space-y-6 bg-card p-8 rounded-xl border shadow-sm">
          <p className="text-muted-foreground leading-relaxed">
            To protect platform integrity, we require a one-time biometric setup.
            You will <strong>slowly move your head</strong> in 5 directions while the camera captures you automatically,
            then record a short <strong>voice sample</strong>.
            This data is stored securely and never shared.
          </p>
          <Button size="lg" onClick={() => setStep("face")} className="gap-2">
            <Camera className="w-4 h-4" /> Start Verification
          </Button>
        </div>
      )}

      {/* ── FACE ── */}
      {step === "face" && (
        <div className="flex flex-col items-center space-y-5 bg-card p-8 rounded-xl border shadow-sm">
          <div className="text-center">
            <h2 className="text-2xl font-semibold">Step 1 of 2 — Facial Recognition</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Slowly look in all directions — the camera captures each pose automatically
            </p>
          </div>

          {/* Camera feed */}
          <div className="relative w-full max-w-sm bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border-2 border-primary/20">
            {!isCameraReady && (
              <div className="flex flex-col items-center gap-2 text-white/70">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">{isModelsLoaded ? "Starting camera…" : "Loading AI models…"}</span>
              </div>
            )}
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-full object-cover transition-opacity ${isCameraReady ? "opacity-100" : "opacity-0"}`}
            />
            {/* Oval guide overlay */}
            {isCameraReady && (
              <>
                <div
                  className={`absolute inset-2 border-4 border-dashed rounded-[100%] pointer-events-none transition-colors duration-500 ${
                    capturedCount === POSES.length ? "border-green-500/80 bg-green-500/10" : "border-primary/40"
                  }`}
                />
                {/* Progress ring label */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <span className="text-white/90 text-xs bg-black/50 px-2 py-0.5 rounded-full">
                    {capturedCount}/{POSES.length} captured
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Per-pose checklist */}
          <div className="grid grid-cols-5 gap-3 w-full">
            {POSES.map((p) => {
              const isCaptured = !!capturedDescriptors[p.id];
              return (
                <div key={p.id} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCaptured ? "bg-green-500 scale-110" : "bg-muted animate-pulse"
                    }`}
                  >
                    {isCaptured
                      ? <CheckCircle className="w-5 h-5 text-white" />
                      : <Camera className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <span className={`text-xs font-medium text-center ${isCaptured ? "text-green-500" : "text-muted-foreground"}`}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hint for next uncaptured pose */}
          {isCameraReady && !isProcessingFace && (
            <p className="text-sm text-primary font-medium animate-pulse">
              {capturedCount < POSES.length
                ? `👉 ${POSES.find(p => !capturedDescriptors[p.id])?.hint}`
                : "All poses captured!"}
            </p>
          )}

          {isProcessingFace && (
            <div className="text-sm text-primary flex items-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" /> Finalizing face setup…
            </div>
          )}
        </div>
      )}

      {/* ── VOICE ── */}
      {step === "voice" && (
        <div className="flex flex-col items-center space-y-5 bg-card p-8 rounded-xl border shadow-sm">
          <h2 className="text-2xl font-semibold text-center">Step 2 of 2 — Voice Recognition</h2>
          <p className="text-muted-foreground text-center text-sm">
            Read the script below clearly, then click <strong>Stop Recording</strong>.
          </p>

          <div className="bg-muted/60 border rounded-xl p-6 w-full text-center text-lg font-medium italic leading-relaxed">
            {script ? `"${script}"` : <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
          </div>

          <div className="flex gap-4 flex-wrap justify-center">
            {!isRecording ? (
              <Button
                size="lg"
                onClick={startRecording}
                variant={audioBlob ? "outline" : "default"}
                disabled={!script}
                className="gap-2"
              >
                <Mic className="w-4 h-4" />
                {audioBlob ? "Re-record" : "Start Recording"}
              </Button>
            ) : (
              <Button size="lg" onClick={stopRecording} variant="destructive" className="gap-2">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                Stop Recording
              </Button>
            )}
          </div>

          {audioBlob && (
            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
              <Button size="lg" className="w-full gap-2" onClick={submitVoice} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Submit Voice Sample</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── DONE ── */}
      {step === "done" && (
        <div className="flex flex-col items-center space-y-5 bg-card p-8 rounded-xl border shadow-sm text-center">
          <CheckCircle className="w-20 h-20 text-green-500" />
          <h2 className="text-2xl font-semibold">Verification Complete 🎉</h2>
          <p className="text-muted-foreground max-w-sm">
            Your biometric identity profile has been successfully saved. You can now create and upload courses.
          </p>
          <Button size="lg" onClick={() => setLocation("/teacher/dashboard")} className="gap-2">
            Go to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
