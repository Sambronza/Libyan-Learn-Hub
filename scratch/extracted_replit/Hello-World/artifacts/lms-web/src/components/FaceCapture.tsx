import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Button } from './ui/button';
import { Camera, CheckCircle, Loader2 } from 'lucide-react';

interface FaceCaptureProps {
  onCapture: (descriptor: number[], imageBase64: string) => void;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelsLoaded(true);
      } catch (err: any) {
        setError('Failed to load face recognition models: ' + err.message);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!isModelsLoaded) return;
    
    let stream: MediaStream | null = null;
    let mounted = true;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsCameraReady(true);
        }
      } catch (err: any) {
        if (mounted) setError('Camera access denied or unavailable: ' + err.message);
      }
    };
    
    startCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isModelsLoaded]);

  const captureAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) return;
    
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Draw video frame to canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      const imageBase64 = canvas.toDataURL('image/jpeg');

      // Detect face and compute descriptor
      const detection = await faceapi.detectSingleFace(
        video, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        // Convert Float32Array to standard number array
        const descriptor = Array.from(detection.descriptor);
        onCapture(descriptor, imageBase64);
      } else {
        setError('No face detected. Please look directly at the camera and ensure good lighting.');
      }
    } catch (err: any) {
      setError('Error processing face: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg flex flex-col items-center">
        <p className="text-center mb-4">{error}</p>
        <Button onClick={() => setError(null)} variant="outline">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <div className="relative w-full max-w-sm rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-primary/20">
        {!isCameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 z-10">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm">Initializing Camera...</span>
          </div>
        )}
        <video 
          ref={videoRef} 
          muted 
          playsInline
          className={`w-full h-full object-cover ${isCameraReady ? 'opacity-100' : 'opacity-0'}`} 
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay targeting box */}
        {isCameraReady && (
          <div className="absolute inset-0 border-4 border-dashed border-white/50 m-8 rounded-full pointer-events-none" />
        )}
      </div>
      
      <Button 
        onClick={captureAndProcess} 
        disabled={!isCameraReady || isProcessing}
        className="w-full max-w-sm"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing Face...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4 mr-2" /> Capture Verification Photo
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center max-w-sm">
        Please look directly at the camera. This data is securely processed to verify your identity.
      </p>
    </div>
  );
};
