import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMediaActivity } from '@/contexts/MediaActivityContext';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Radio, Clock, PauseCircle
} from 'lucide-react';
import { ScreenProtection } from '@/components/ScreenProtection';
import { WatermarkOverlay } from '@/components/WatermarkOverlay';
import { useAudioRecording } from '@/hooks/useAudioRecording';

import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  PreJoin,
  LocalUserChoices,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';

// ─── Server-Synced Timer Overlay ──────────────────────────────────────────────
// Polls /timer/sync every 5 s.  Starts when both participants join.
// Pauses on teacher leave; resumes when teacher rejoins.
function ServerSyncedTimer({
  requestId,
  sessionType,
  onEnd,
  onStart,
  isTeacher,
}: {
  requestId: number;
  sessionType: string;
  onEnd: () => void;
  onStart?: () => void;
  isTeacher: boolean;
}) {
  const api = useApi();
  const participants = useParticipants();
  const participantCount = participants.length;

  // Local display state – updated from server
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const endedRef = useRef(false);
  const onStartFiredRef = useRef(false);
  const localTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fire onStart once when the timer first becomes active
  const fireOnStart = useCallback(() => {
    if (!onStartFiredRef.current) {
      onStartFiredRef.current = true;
      if (onStart) onStart();
    }
  }, [onStart]);

  // Poll the server every 5 s and update display state
  const poll = useCallback(async () => {
    if (sessionType !== 'request') return; // listing-type sessions don't use this timer
    try {
      const data = await api.post(`/tutoring/requests/${requestId}/timer/sync`, {
        participantCount,
      });

      const { elapsedSeconds, isPaused: paused, totalDurationSeconds } = data;
      const remaining = Math.max(totalDurationSeconds - elapsedSeconds, 0);

      setIsPaused(paused);

      if (elapsedSeconds > 0 || participantCount >= 2) {
        setStarted(true);
        fireOnStart();
      }

      setTimeLeft(remaining);

      // Stop local tick interval and recalibrate
      if (localTickRef.current) {
        clearInterval(localTickRef.current);
        localTickRef.current = null;
      }

      if (!paused && remaining > 0) {
        // Run a local tick between polls so the UI is smooth
        localTickRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(localTickRef.current!);
              localTickRef.current = null;
              if (!endedRef.current) {
                endedRef.current = true;
                onEnd();
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }

      if (remaining === 0 && !endedRef.current) {
        endedRef.current = true;
        onEnd();
      }
    } catch {
      // Ignore network errors during poll — will retry
    }
  }, [api, requestId, sessionType, participantCount, onEnd, fireOnStart]);

  // Set up 5-second polling interval
  useEffect(() => {
    poll(); // immediate first call
    const interval = setInterval(poll, 5000);
    return () => {
      clearInterval(interval);
      if (localTickRef.current) clearInterval(localTickRef.current);
    };
  }, [poll]);

  if (!started || timeLeft === null) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isLow = timeLeft < 300 && !isPaused;

  return (
    <>
      {/* Timer pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        <div className={`bg-black/70 px-4 py-2 rounded-full border backdrop-blur-md flex items-center gap-2 shadow-xl transition-colors ${
          isPaused ? 'border-amber-400/60' : isLow ? 'border-red-400/60' : 'border-white/20'
        }`}>
          <Clock className={`w-4 h-4 ${isPaused ? 'text-amber-400' : isLow ? 'text-red-400 animate-pulse' : 'text-green-400'}`} />
          <span className={`font-mono font-bold ${isPaused ? 'text-amber-400' : isLow ? 'text-red-400' : 'text-white'}`}>
            {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Pause banner – shown when teacher is absent */}
        {isPaused && (
          <div className="bg-amber-500/90 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-sm pointer-events-none">
            <PauseCircle className="w-3.5 h-3.5" />
            Timer paused — waiting for teacher
          </div>
        )}
      </div>
    </>
  );
}

// ─── Inner LiveKit wrapper that has access to room context ───────────────────
// We need this because useRoomContext() only works inside <LiveKitRoom>.
function RoomContent({
  requestId,
  sessionType,
  isTeacher,
  session,
  onEnd,
  onStart,
}: {
  requestId: number;
  sessionType: string;
  isTeacher: boolean;
  session: any;
  onEnd: () => void;
  onStart: () => void;
}) {
  const room = useRoomContext();

  // Resume timer when teacher reconnects
  useEffect(() => {
    if (!isTeacher || sessionType !== 'request') return;
    const handleConnected = async () => {
      try {
        await fetch(`/api/tutoring/requests/${requestId}/timer/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
      } catch { /* best-effort */ }
    };
    room.on('connected', handleConnected);
    return () => { room.off('connected', handleConnected); };
  }, [room, isTeacher, requestId, sessionType]);

  return (
    <>
      <ServerSyncedTimer
        requestId={requestId}
        sessionType={sessionType}
        onEnd={onEnd}
        onStart={onStart}
        isTeacher={isTeacher}
      />
      <VideoConference />
      <RoomAudioRenderer />
    </>
  );
}

// ─── Main TutoringRoom Page ───────────────────────────────────────────────────
export default function TutoringRoom() {
  const [, params] = useRoute('/tutoring/room/:id');
  const requestId = parseInt(params?.id || '0');
  const searchParams = new URLSearchParams(window.location.search);
  const sessionType = searchParams.get('type') === 'listing' ? 'listing' : 'request';
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const { toast } = useToast();
  const { setMediaActive } = useMediaActivity();

  const [hasJoined, setHasJoined] = useState(false);
  const [userChoices, setUserChoices] = useState<LocalUserChoices | undefined>(undefined);
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null);
  const [liveKitUrl, setLiveKitUrl] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const { startRecording, stopRecording } = useAudioRecording(requestId);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: requestList, isLoading } = useQuery({
    queryKey: ['/api/tutoring', sessionType, requestId],
    queryFn: () => sessionType === 'listing'
      ? api.get(`/tutoring-listings/applications/${requestId}`)
      : api.get(`/tutoring/requests`),
    enabled: !!requestId && !!user,
  });

  const session = sessionType === 'listing'
    ? (requestList && !Array.isArray(requestList) ? requestList : null)
    : (Array.isArray(requestList) ? requestList.find((r: any) => r.id === requestId) : null);

  useEffect(() => {
    if (hasJoined) setMediaActive(true);
    else setMediaActive(false);
    return () => setMediaActive(false);
  }, [hasJoined, setMediaActive]);

  const joinSession = async () => {
    try {
      const joinEndpoint = sessionType === 'listing'
        ? `/tutoring-listings/applications/${requestId}/join`
        : `/tutoring/requests/${requestId}/join`;
      const data = await api.post(joinEndpoint, {});
      setLiveKitToken(data.token);
      setLiveKitUrl(data.livekitUrl);
      setIsTeacher(data.isTeacher);
      setHasJoined(true);
    } catch (err: any) {
      toast({ title: 'Error joining', description: err.message, variant: 'destructive' });
    }
  };

  // Called when participant intentionally or unintentionally disconnects from LiveKit
  const handleDisconnected = useCallback(async () => {
    if (sessionType === 'request') {
      try {
        // best-effort: tell server this participant left so timer can be paused / early-termination flagged
        await api.post(`/tutoring/requests/${requestId}/leave`, {});
      } catch { /* ignore */ }
    }
    setLocation('/tutoring');
  }, [api, requestId, sessionType, setLocation]);

  const handleSessionEnd = useCallback(async () => {
    stopRecording();
    try {
      if (sessionType === 'request') {
        await api.post(`/tutoring/requests/${requestId}/complete`, {});
      }
    } catch (e) {
      console.error('Error completing session', e);
    }
    if (!isTeacher && sessionType === 'request') {
      setLocation(`/tutoring?feedbackFor=${requestId}`);
    } else {
      setLocation('/tutoring');
    }
  }, [api, requestId, sessionType, isTeacher, setLocation, stopRecording]);

  const handleSessionStart = useCallback(() => {
    if (isTeacher && sessionType === 'request') {
      startRecording();
    }
  }, [isTeacher, sessionType, startRecording]);

  if (authLoading || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <Radio className="w-12 h-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4">
        <p className="text-xl font-bold">Session not found or not authorized</p>
        <Button onClick={() => setLocation('/tutoring')}>Back to Tutoring</Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden font-sans">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-white/10 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/tutoring')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${hasJoined ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-widest ${hasJoined ? 'text-red-400' : 'text-amber-400'}`}>
                {hasJoined ? 'Live' : 'Waiting Room'}
              </span>
            </div>
            <h1 className="font-bold text-base">Tutoring: {session.subject}</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col bg-black">
        {!hasJoined ? (
          <div className="flex-1 overflow-y-auto bg-slate-800" data-lk-theme="default">
            <div className="min-h-full flex flex-col justify-center items-center p-4 py-8">
              <PreJoin
                defaults={{ videoEnabled: true, audioEnabled: true }}
                onSubmit={(choices) => {
                  setUserChoices(choices);
                  joinSession();
                }}
                className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 w-full max-w-md mx-auto"
              />
            </div>
          </div>
        ) : (
          <ScreenProtection>
            {liveKitToken && liveKitUrl && userChoices ? (
              <LiveKitRoom
                video={userChoices.videoEnabled}
                audio={userChoices.audioEnabled}
                token={liveKitToken}
                serverUrl={liveKitUrl}
                className="absolute inset-0 w-full h-full"
                data-lk-theme="default"
                style={{ height: '100%', '--lk-bg': '#020817' } as React.CSSProperties}
                onDisconnected={handleDisconnected}
              >
                <RoomContent
                  requestId={requestId}
                  sessionType={sessionType}
                  isTeacher={isTeacher}
                  session={session}
                  onEnd={handleSessionEnd}
                  onStart={handleSessionStart}
                />
              </LiveKitRoom>
            ) : (
              <div className="flex items-center justify-center h-full bg-slate-900">
                <Radio className="w-10 h-10 text-primary animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 z-[200] pointer-events-none">
              <WatermarkOverlay />
            </div>
          </ScreenProtection>
        )}
      </div>
    </div>
  );
}
