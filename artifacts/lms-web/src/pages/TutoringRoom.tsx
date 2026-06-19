import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMediaActivity } from '@/contexts/MediaActivityContext';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Circle, Square, Radio, Clock
} from 'lucide-react';
import { useLocalRecording } from '@/hooks/useLocalRecording';
import { ScreenProtection } from '@/components/ScreenProtection';
import { WatermarkOverlay } from '@/components/WatermarkOverlay';

import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  PreJoin,
  LocalUserChoices,
  useParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';

function SessionTimerOverlay({ durationMinutes, onEnd }: { durationMinutes: number, onEnd: () => void }) {
  const participants = useParticipants();
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started && participants.length >= 2) {
      setStarted(true);
    }
  }, [participants.length, started]);

  useEffect(() => {
    if (!started) return;
    if (timeLeft <= 0) {
      onEnd();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [started, timeLeft, onEnd]);

  if (!started) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-black/60 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md flex items-center gap-2 shadow-xl">
      <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-green-400'}`} />
      <span className={`font-mono font-bold ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
        {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export default function TutoringRoom() {
  const [, params] = useRoute('/tutoring/room/:id');
  const requestId = parseInt(params?.id || '0');
  // Distinguish listing-based applications from tutoring requests via ?type=listing
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
  
  // For listing-based: the API returns a single application object directly
  // For request-based: the API returns an array; find by id
  const session = sessionType === 'listing'
    ? (requestList && !Array.isArray(requestList) ? requestList : null)
    : (Array.isArray(requestList) ? requestList.find((r: any) => r.id === requestId) : null);

  const handleRecordingSaved = async (url: string) => {
    try {
      await api.post(`/tutoring/requests/${requestId}/recording`, { recordingUrl: url });
      toast({ title: 'Recording saved successfully.' });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Failed to save recording URL', description: err.message, variant: 'destructive' });
    }
  };

  const { isRecording, isUploading, startRecording, stopRecording, isSupported } = useLocalRecording(session?.subject || 'TutoringSession', handleRecordingSaved);

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

  const handleSessionEnd = async () => {
    try {
      if (sessionType === 'request') {
        await api.post(`/tutoring/requests/${requestId}/complete`, {});
      }
    } catch(e) {
      console.error('Error completing session', e);
    }
    // Redirect to tutoring page, and open feedback modal if student
    if (!isTeacher && sessionType === 'request') {
      setLocation(`/tutoring?feedbackFor=${requestId}`);
    } else {
      setLocation('/tutoring');
    }
  };

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
        <div className="flex items-center gap-4">
          {hasJoined && isTeacher && (
            <div title={!isSupported ? "Screen recording is not supported on this device. Please use a desktop browser." : ""}>
              <Button 
                variant={isRecording ? 'outline' : 'secondary'} 
                size="sm" 
                className={`gap-2 h-8 ${isRecording ? 'border-red-500 text-red-500 animate-pulse bg-transparent hover:bg-red-500/10' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isUploading || !isSupported}
              >
                {isUploading ? <Radio className="w-4 h-4 animate-spin" /> : (isRecording ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4 fill-current text-red-500" />)}
                {isUploading ? 'Saving...' : (isRecording ? 'Stop Rec' : 'Record')}
              </Button>
            </div>
          )}
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
                onDisconnected={() => setLocation('/tutoring')}
              >
                <SessionTimerOverlay durationMinutes={session.durationMinutes || 60} onEnd={handleSessionEnd} />
                <VideoConference />
                <RoomAudioRenderer />
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
