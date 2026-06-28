import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMediaActivity } from '@/contexts/MediaActivityContext';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Radio, Clock, PauseCircle, AlertTriangle
} from 'lucide-react';
import { ScreenProtection } from '@/components/ScreenProtection';
import { WatermarkOverlay } from '@/components/WatermarkOverlay';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useMisbehaveRecording } from '@/hooks/useMisbehaveRecording';
import { FeedbackModal } from '@/components/FeedbackModal';

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
  const api = useApi(); // INT-010: need api in this scope for timer/resume

  // Resume timer when teacher reconnects
  useEffect(() => {
    if (!isTeacher || sessionType !== 'request') return;
    const handleConnected = async () => {
      try {
        // INT-010: use api.post() instead of raw fetch() for correct base URL + auth
        await api.post(`/tutoring/requests/${requestId}/timer/resume`, {});
      } catch { /* best-effort */ }
    };
    room.on('connected', handleConnected);
    return () => { room.off('connected', handleConnected); };
  }, [room, isTeacher, requestId, sessionType, api]);

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
  const [showFeedback, setShowFeedback] = useState(false);
  const [showTeacherWaiting, setShowTeacherWaiting] = useState(false);
  const waitingPopupShownRef = useRef(false);
  const [showMisbehaveConfirm, setShowMisbehaveConfirm] = useState(false);
  const [misbehaveReason, setMisbehaveReason] = useState('inappropriate_behavior');
  const { startRecording, stopRecording } = useAudioRecording(requestId);
  const { isSubmitting: isMisbehaveSubmitting, startBuffer, stopBuffer, triggerMisbehave } = useMisbehaveRecording(requestId);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/tutoring', sessionType, requestId],
    queryFn: () => sessionType === 'listing'
      ? api.get(`/tutoring-listings/applications/${requestId}`)
      : api.get(`/tutoring/requests/${requestId}`), // INT-002: fetch single request by ID
    enabled: !!requestId && !!user,
    refetchInterval: (!hasJoined && sessionType === 'request') ? 3000 : false,
  });

  // Extract session object — for listing type it's the direct response object;
  // for request type it's the single request object returned directly.
  const resolvedSession = sessionType === 'listing'
    ? (session && !Array.isArray(session) ? session : null)
    : (session && !Array.isArray(session) ? session : null);

  useEffect(() => {
    if (hasJoined) setMediaActive(true);
    else setMediaActive(false);
    return () => setMediaActive(false);
  }, [hasJoined, setMediaActive]);

  useEffect(() => {
    if (!hasJoined && sessionType === 'request' && resolvedSession && user && resolvedSession.teacherId !== user.id) {
      if (resolvedSession.teacherJoinedAt && !waitingPopupShownRef.current) {
        waitingPopupShownRef.current = true;
        setShowTeacherWaiting(true);
      }
    }
  }, [hasJoined, sessionType, resolvedSession, user]);

  // INT-003: track when session ends via timer so handleDisconnected doesn't override redirect
  const sessionEndedRef = useRef(false);

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
    // INT-003: if the session ended normally (timer expired), handleSessionEnd already
    // redirected the user — skip the /leave call and navigation override.
    if (sessionEndedRef.current) return;
    if (sessionType === 'request') {
      try {
        await api.post(`/tutoring/requests/${requestId}/leave`, {});
      } catch { /* ignore */ }
    }
    setLocation('/tutoring');
  }, [api, requestId, sessionType, setLocation]);

  const handleSessionEnd = useCallback(async () => {
    stopRecording();
    sessionEndedRef.current = true; // INT-003: prevent handleDisconnected override
    try {
      if (sessionType === 'request') {
        await api.post(`/tutoring/requests/${requestId}/complete`, {});
      }
    } catch (e) {
      console.error('Error completing session', e);
    }
    if (!isTeacher && sessionType === 'request') {
      // Show feedback modal in-page instead of redirecting with query param
      setShowFeedback(true);
    } else {
      setLocation('/tutoring');
    }
  }, [api, requestId, sessionType, isTeacher, setLocation, stopRecording]);

  const handleFeedbackSubmit = async (rating: number, comment: string) => {
    await api.post(`/feedback/tutoring/${requestId}`, { rating, comment });
    setLocation('/tutoring');
  };

  const handleSessionStart = useCallback(() => {
    if (isTeacher && sessionType === 'request') {
      startRecording();
    }
    // Start 2-min rolling buffer for ALL participants once session is live
    startBuffer();
  }, [isTeacher, sessionType, startRecording, startBuffer]);

  // ── Misbehave handler ──────────────────────────────────────────────────────
  const handleMisbehave = useCallback(async () => {
    setShowMisbehaveConfirm(false);
    try {
      stopRecording();
      sessionEndedRef.current = true; // prevent handleDisconnected from firing redundantly
      await triggerMisbehave(misbehaveReason, 'Session forcefully terminated via Misbehave button.');
      toast({ title: '🚨 Report submitted', description: 'The session has been terminated and an admin will review the recording.', variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      stopBuffer();
      setLocation('/tutoring');
    }
  }, [triggerMisbehave, misbehaveReason, stopRecording, stopBuffer, toast, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <Radio className="w-12 h-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (!resolvedSession) {
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
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-white/10 shrink-0 z-10 shadow-sm min-h-[56px]">
        <div className="flex items-center gap-4 min-w-0">
          {/* INT-011: call /leave before navigating if already joined */}
          <Button variant="ghost" size="icon" className="shrink-0" onClick={async () => {
            if (hasJoined && sessionType === 'request') {
              try { await api.post(`/tutoring/requests/${requestId}/leave`, {}); } catch { /* ignore */ }
            }
            setLocation('/tutoring');
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasJoined ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-widest ${hasJoined ? 'text-red-400' : 'text-amber-400'}`}>
                {hasJoined ? 'Live' : 'Waiting Room'}
              </span>
            </div>
            <h1 className="font-bold text-base truncate">Tutoring: {resolvedSession.subject}</h1>
          </div>
        </div>

        {/* Misbehave Panic Button — only visible once session is live */}
        {hasJoined && (
          <Button
            id="misbehave-btn"
            variant="destructive"
            size="sm"
            className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold border border-red-400 shadow-lg animate-pulse shrink-0"
            onClick={() => setShowMisbehaveConfirm(true)}
            disabled={isMisbehaveSubmitting}
          >
            <AlertTriangle className="w-4 h-4" />
            {isMisbehaveSubmitting ? 'Reporting...' : 'Misbehave'}
          </Button>
        )}
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
                data-recording-container="true"
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

      {/* Tutoring Session Feedback Modal — shown to students on session completion */}
      <FeedbackModal
        open={showFeedback}
        onClose={() => { setShowFeedback(false); setLocation('/tutoring'); }}
        onSubmit={handleFeedbackSubmit}
        title="How was your tutoring session?"
        subtitle="Your feedback helps your teacher and the platform improve."
      />

      {/* ── Misbehave Confirmation Dialog ────────────────────────────────────── */}
      {showMisbehaveConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/60 rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg">Report Misbehaviour</h2>
                <p className="text-red-300 text-sm">This will immediately close the session for everyone.</p>
              </div>
            </div>

            <p className="text-white/70 text-sm mb-4">
              The last 2 minutes of this session will be recorded and submitted to an admin for review.
              The student's payment will be held pending admin decision.
            </p>

            <div className="mb-4">
              <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5 block">Reason</label>
              <select
                id="misbehave-reason-select"
                value={misbehaveReason}
                onChange={(e) => setMisbehaveReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/20 text-white text-sm"
              >
                <option value="inappropriate_behavior">Inappropriate behaviour</option>
                <option value="offensive">Offensive / abusive language</option>
                <option value="no_show">No-show / abandonment</option>
                <option value="technical_issue">Technical issue caused by other party</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                id="misbehave-confirm-btn"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
                disabled={isMisbehaveSubmitting}
                onClick={handleMisbehave}
              >
                <AlertTriangle className="w-4 h-4" />
                {isMisbehaveSubmitting ? 'Submitting...' : 'Confirm & End Session'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
                onClick={() => setShowMisbehaveConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Teacher Waiting Popup ───────────────────────────────────────────── */}
      {showTeacherWaiting && !hasJoined && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-primary/50 rounded-2xl shadow-[0_0_40px_-10px_rgba(124,58,237,0.5)] p-8 w-full max-w-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-indigo-500 animate-pulse" />
            
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <Clock className="w-10 h-10 text-primary relative z-10" />
            </div>
            
            <h2 className="font-bold text-white text-2xl mb-2">Teacher is waiting!</h2>
            <p className="text-white/70 mb-8">
              Your teacher has joined the session. The session timer has started.
            </p>
            
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-lg py-6"
                onClick={() => {
                  setShowTeacherWaiting(false);
                  // The user can now click "Join" on the LiveKit PreJoin screen, 
                  // or if we have their choices, we could auto-join.
                  // Since PreJoin requires explicit click, we just dismiss the popup so they can click it.
                  const joinBtn = document.querySelector('.lk-prejoin .lk-button');
                  if (joinBtn) (joinBtn as HTMLElement).click();
                }}
              >
                Enter Room
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
