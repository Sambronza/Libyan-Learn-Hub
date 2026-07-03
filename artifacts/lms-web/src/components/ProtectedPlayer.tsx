import React, { useEffect, useRef, useState } from 'react';
import { ScreenProtection } from './ScreenProtection';
import { WatermarkOverlay } from './WatermarkOverlay';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ProtectedPlayerProps {
  url: string;
  courseId?: number;
  lessonId?: number;
  startAt?: number;
  onEnded?: () => void;
  onProgress?: (progress: { playedSeconds: number }) => void;
  /**
   * Certificate courses: disallow seeking forward past what has actually been
   * watched (no skip / no fast-forward). Rewinding is always allowed.
   */
  antiSkip?: boolean;
}

export function ProtectedPlayer({ url, courseId, lessonId, startAt = 0, onEnded, onProgress, antiSkip = false }: ProtectedPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Furthest point genuinely reached by continuous playback (anti-skip ceiling)
  const maxWatchedRef = useRef(startAt);
  const [secureUrl, setSecureUrl] = useState<string | null>(null);
  const [isHls, setIsHls] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateToken = () => {
    const token = localStorage.getItem('lms_token');
    setError(null);
    if (courseId && lessonId) {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(`/api/video/generate-token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ courseId, lessonId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setSecureUrl(data.url);
          setIsHls(!!data.isHls);
        } else if (data.error) {
          setError(data.error);
        } else {
          setSecureUrl(url);
          setIsHls(url.endsWith('.m3u8'));
        }
      })
      .catch(() => {
        setSecureUrl(url);
        setIsHls(url.endsWith('.m3u8'));
      });
    } else {
      setSecureUrl(url);
      setIsHls(url.endsWith('.m3u8'));
    }
  };

  useEffect(() => {
    generateToken();
  }, [courseId, lessonId, url]);

  // Attach HLS.js or load native video when secureUrl changes
  useEffect(() => {
    if (!secureUrl || !videoRef.current) return;

    const video = videoRef.current;

    const setupProgress = () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        if (!video.paused && onProgress) {
          onProgress({ playedSeconds: video.currentTime });
        }
      }, 10000);
    };

    const handleEnded = () => { if (onEnded) onEnded(); };
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', setupProgress);

    // ── Anti-skip enforcement (certificate courses) ──────────────────────
    // timeupdate advances the ceiling only through real playback (≤1.5s steps);
    // seeking beyond the ceiling snaps back to it.
    maxWatchedRef.current = Math.max(maxWatchedRef.current, startAt);
    const handleTimeUpdate = () => {
      if (!antiSkip) return;
      const t = video.currentTime;
      if (t > maxWatchedRef.current && t - maxWatchedRef.current <= 1.5) {
        maxWatchedRef.current = t;
      }
    };
    const handleSeeking = () => {
      if (!antiSkip) return;
      if (video.currentTime > maxWatchedRef.current + 1.5) {
        video.currentTime = maxWatchedRef.current;
      }
    };
    const handleRateChange = () => {
      // No fast-forward via playback speed either
      if (antiSkip && video.playbackRate > 1) video.playbackRate = 1;
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('ratechange', handleRateChange);

    if (startAt > 0) {
      const seekOnce = () => {
        video.currentTime = startAt;
        video.removeEventListener('loadedmetadata', seekOnce);
      };
      video.addEventListener('loadedmetadata', seekOnce);
    }

    let hlsInstance: any = null;

    if (isHls) {
      // Dynamically import HLS.js only when needed
      import('hls.js').then(({ default: Hls }) => {
        if (!videoRef.current) return;
        if (Hls.isSupported()) {
          hlsInstance = new Hls({ capLevelToPlayerSize: true });
          hlsInstance.loadSource(secureUrl);
          hlsInstance.attachMedia(videoRef.current);
          hlsInstance.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal) {
              console.error('HLS fatal error:', data);
              setError('Video playback error. Please try again.');
            }
          });
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS
          videoRef.current.src = secureUrl;
        } else {
          setError('Your browser does not support video streaming.');
        }
      });
    } else {
      // Plain MP4 — just set src directly
      video.src = secureUrl;
      video.load();
    }

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', setupProgress);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('ratechange', handleRateChange);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [secureUrl, isHls]);

  return (
    <ScreenProtection className="aspect-video bg-black rounded-2xl shadow-2xl">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/90 gap-3 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-300 font-medium">{error}</p>
          <button
            onClick={generateToken}
            className="flex items-center gap-2 text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : secureUrl ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full rounded-2xl"
          controls
          playsInline
          controlsList="nodownload"
          disablePictureInPicture
          onError={(e) => {
            const v = e.currentTarget;
            const code = v.error?.code;
            const msg = v.error?.message;
            console.error('Video error:', code, msg);
            setError(`Playback error (${code}). Please retry.`);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-white/60">Generating secure stream...</span>
          </div>
        </div>
      )}

      <WatermarkOverlay />
    </ScreenProtection>
  );
}
