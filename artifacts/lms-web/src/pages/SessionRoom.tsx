import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMediaActivity } from '@/contexts/MediaActivityContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import {
  ThumbsUp, CheckCircle, Send, MessageSquare, Users, Clock,
  Video, ArrowLeft, Radio, Flag, AlertCircle, X, Circle, Square
} from 'lucide-react';
import { useLocalRecording } from '@/hooks/useLocalRecording';
import { ScreenProtection } from '@/components/ScreenProtection';
import { WatermarkOverlay } from '@/components/WatermarkOverlay';
import { FeedbackModal } from '@/components/FeedbackModal';

import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';

export default function SessionRoom() {
  const [, params] = useRoute('/session/:id');
  const sessionId = parseInt(params?.id || '0');
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setMediaActive } = useMediaActivity();
  const [question, setQuestion] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  
  // State for LiveKit
  const [hasJoined, setHasJoined] = useState(false);
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null);
  const [liveKitUrl, setLiveKitUrl] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);



  const [reportSession, setReportSession] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const feedbackShown = React.useRef(false);
  const { register: registerReport, handleSubmit: handleReportSubmit, reset: resetReport } = useForm();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
  }, [isAuthenticated, authLoading]);

  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/room/sessions', sessionId],
    queryFn: () => api.get(`/room/sessions/${sessionId}`),
    enabled: !!sessionId && !!user,
    refetchInterval: (query) => (query.state.data?.status === 'live' || hasJoined) ? 60000 : 5000, // Poll faster if waiting
  });

  const handleRecordingSaved = async (url: string) => {
    try {
      await api.post(`/room/sessions/${sessionId}/recording`, { recordingUrl: url });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Failed to save recording URL to session', description: err.message, variant: 'destructive' });
    }
  };

  // Local Recording hook
  const { isRecording, isUploading, startRecording, stopRecording } = useLocalRecording(session?.title || 'ClassSession', handleRecordingSaved);

  useEffect(() => {
    if (session && !session.isRegistered && !session.isTeacher && parseFloat(session.price) > 0) {
      setLocation(`/checkout/live/${session.id}`);
    }
  }, [session, setLocation]);

  const { data: questions, refetch: refetchQuestions } = useQuery({
    queryKey: ['/api/room/sessions', sessionId, 'questions'],
    queryFn: () => api.get(`/room/sessions/${sessionId}/questions`),
    enabled: !!sessionId && !!user,
    refetchInterval: 5000,
  });

  // Signal media active while LiveKit session is live — don't lock during streaming
  useEffect(() => {
    if (hasJoined) {
      setMediaActive(true);
    } else {
      setMediaActive(false);
    }
    // Always clear on unmount
    return () => setMediaActive(false);
  }, [hasJoined]);

  const joinSession = async () => {
    try {
      const data = await api.post(`/room/sessions/${sessionId}/join`, {});
      setLiveKitToken(data.token);
      setLiveKitUrl(data.livekitUrl);
      setHasJoined(true);
      queryClient.invalidateQueries({ queryKey: ['/api/room/sessions', sessionId] });
    } catch (err: any) {
      toast({ title: 'Error joining', description: err.message, variant: 'destructive' });
    }
  };

  const submitQuestion = async () => {
    if (!question.trim()) return;
    try {
      await api.post(`/room/sessions/${sessionId}/questions`, { question });
      setQuestion('');
      refetchQuestions();
      toast({ title: 'Question submitted!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const upvoteQuestion = async (qId: number) => {
    await api.post(`/room/sessions/${sessionId}/questions/${qId}/upvote`, {});
    refetchQuestions();
  };

  const markAnswered = async (qId: number) => {
    await api.post(`/room/sessions/${sessionId}/questions/${qId}/answer`, {});
    refetchQuestions();
    toast({ title: 'Marked as answered' });
  };

  const submitReport = async (data: any) => {
    if (!session) return;
    try {
      await api.post('/reports', {
        type: 'session',
        targetId: session.id,
        reportedUserId: session.teacherId,
        reason: data.reason,
        description: data.description,
      });
      toast({ title: 'Report submitted. Thank you for your feedback.' });
      setReportSession(false);
      resetReport();
    } catch (err: any) {
      toast({ title: 'Error submitting report', description: err.message, variant: 'destructive' });
    }
  };

  const endSession = async () => {
    if (!confirm('Are you sure you want to end this session for all participants?')) return;
    setIsEnding(true);
    try {
      await api.post(`/live-sessions/${sessionId}/end`, {});
      toast({ title: 'Session ended' });
      setLocation('/dashboard');
    } catch (err: any) {
      toast({ title: 'Error ending session', description: err.message, variant: 'destructive' });
      setIsEnding(false);
    }
  };

  // ── Feedback trigger: show modal to students when session ends ───────
  useEffect(() => {
    if (
      session &&
      session.status === 'ended' &&
      !session.isTeacher &&
      !feedbackShown.current
    ) {
      feedbackShown.current = true;
      api.get(`/feedback/live-session/${sessionId}/mine`).then((data: any) => {
        if (!data?.submitted) setShowFeedback(true);
      }).catch(() => {/* ignore */});
    }
  }, [session?.status]);

  const handleFeedbackSubmit = async (rating: number, comment: string) => {
    await api.post(`/feedback/live-session/${sessionId}`, {
      contentRating: rating,
      comment,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <Radio className="w-12 h-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-lg">Loading session room...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <p className="text-xl font-bold mb-4">Session not found</p>
          <Button onClick={() => setLocation('/live-sessions')}>Back to Sessions</Button>
        </div>
      </div>
    );
  }

  if (session.status === 'cancelled') {
    return (
      <div className="h-screen flex flex-col bg-slate-900 text-white">
        <div className="p-4 border-b border-white/10 flex items-center">
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white mr-4" onClick={() => setLocation('/live-sessions')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">{session.title}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6 bg-slate-800 p-8 rounded-2xl border border-red-500/30">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-400 mb-2">Session Cancelled</h2>
            <p className="text-white/70 mb-6">This live session has been cancelled by the teacher.</p>
            {session.cancellationReason && (
              <div className="bg-slate-900/50 p-4 rounded-xl text-sm text-white/80 mb-6 text-left border border-white/5">
                <span className="text-white/50 block mb-1 text-xs uppercase tracking-wider">Reason provided:</span>
                {session.cancellationReason}
              </div>
            )}
            <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white" onClick={() => setLocation('/live-sessions')}>
              Return to Sessions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canJoin = session.isRegistered || session.isTeacher;
  const unanswered = (questions || []).filter((q: any) => !q.answered);
  const answered = (questions || []).filter((q: any) => q.answered);

  // Define waiting room state
  const renderWaitingRoom = () => {
    if (!canJoin) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-800 p-4 overflow-y-auto min-h-full">
          <div className="text-center max-w-md w-full bg-slate-900/50 p-6 md:p-8 rounded-3xl border border-white/5 relative shrink-0 my-auto">
            <Video className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Ready to Join?</h2>
            <p className="text-white/60 mb-6">
              {session.isFull
                ? 'This session is full. No seats available.'
                : `${session.seatsLeft} seats available. Register to join this session.`}
            </p>
            {!session.isFull && (
              <Button className="bg-primary hover:bg-primary/90 px-8 py-6 text-lg w-full rounded-xl shadow-lg shadow-primary/20" onClick={joinSession}>
                Join Session ({session.seatsLeft} seats left)
              </Button>
            )}
            {session.isFull && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                Session is full — no seats available
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800 p-4 overflow-y-auto min-h-full">
        <div className="text-center max-w-md w-full bg-slate-900/50 p-6 md:p-8 rounded-3xl border border-white/5 relative overflow-hidden shrink-0 my-auto">
          {session.status === 'live' && !session.isTeacher && (
             <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
          )}
          
          <Radio className={`w-20 h-20 mx-auto mb-6 ${session.status === 'live' ? 'text-red-500 animate-pulse' : 'text-primary/50'}`} />
          
          <h2 className="text-2xl font-bold mb-2">
            {session.isTeacher ? 'Ready to Teach?' : (session.status === 'live' ? 'Session is Live!' : 'Waiting Room')}
          </h2>
          
          <p className="text-white/60 mb-8 text-lg">
            {session.isTeacher 
              ? 'Start the video call when you are ready to admit students.'
              : (session.status === 'live' 
                  ? 'The teacher has started the session. You can join now.' 
                  : 'The session has not started yet. Please wait for the teacher.')}
          </p>
          
          {(session.isTeacher || session.status === 'live') ? (
            <Button 
              className="bg-primary hover:bg-primary/90 px-8 py-6 text-lg w-full rounded-xl shadow-lg shadow-primary/20" 
              onClick={joinSession}
            >
              {session.isTeacher ? 'Start Session' : 'Enter Classroom'}
            </Button>
          ) : (
            <div className="bg-slate-800 border border-white/10 rounded-xl p-4 flex items-center justify-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-white/80 font-medium">Waiting for teacher...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden font-sans">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-white/10 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white rounded-full bg-white/5 hover:bg-white/10" onClick={() => setLocation('/live-sessions')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${session.status === 'live' ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-amber-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-widest ${session.status === 'live' ? 'text-red-400' : 'text-amber-400'}`}>
                {session.status === 'live' ? 'Live' : session.status}
              </span>
            </div>
            <h1 className="font-bold text-base">{session.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-white/70">
          <Button variant="ghost" size="sm" className="hidden sm:flex px-2 text-white/50 hover:text-red-400 gap-1.5 h-8 hover:bg-red-500/10 rounded-lg transition-colors" onClick={() => setReportSession(true)}>
             <Flag className="w-3.5 h-3.5" /> <span className="sr-only sm:not-sr-only font-medium">Report</span>
          </Button>
          <div className="hidden md:flex items-center gap-4 border-l border-white/10 pl-6">
            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md"><Users className="w-4 h-4 text-primary" />{session.registeredCount} / {session.maxParticipants}</span>
            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md"><Clock className="w-4 h-4 text-primary" />{session.durationMinutes} min</span>
            <span className="text-white/60 bg-white/5 px-2.5 py-1 rounded-md">Teacher: <span className="text-white">{session.teacherName}</span></span>
          </div>
          {session.isTeacher && session.status === 'live' && hasJoined && (
            <Button 
              variant={isRecording ? 'outline' : 'secondary'} 
              size="sm" 
              className={`ml-2 gap-2 h-8 ${isRecording ? 'border-red-500 text-red-500 hover:bg-red-500/10 animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
            >
              {isUploading ? <Radio className="w-4 h-4 animate-pulse" /> : (isRecording ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4 text-red-500 fill-current" />)}
              {isUploading ? 'Saving...' : (isRecording ? 'Stop Rec' : 'Record')}
            </Button>
          )}
          {session.isTeacher && session.status === 'live' && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="ml-2 gap-2 h-8"
              onClick={endSession}
              disabled={isEnding}
            >
              <CheckCircle className="w-4 h-4" />
              {isEnding ? 'Ending...' : 'End Session'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        {/* Main video area */}
        <div className="h-[35vh] min-h-[250px] shrink-0 md:h-auto md:min-h-0 md:flex-1 flex flex-col relative bg-black">
          {!hasJoined ? (
            renderWaitingRoom()
          ) : (
            <ScreenProtection>
              {liveKitToken && liveKitUrl ? (
                <LiveKitRoom
                  // Teachers start with camera + mic on; students start muted with no video
                  video={session.isTeacher}
                  audio={session.isTeacher}
                  token={liveKitToken}
                  serverUrl={liveKitUrl}
                  className="absolute inset-0 w-full h-full"
                  data-lk-theme="default"
                  style={{ height: '100%', '--lk-bg': '#020817' } as React.CSSProperties}
                  onDisconnected={() => setLocation('/dashboard')}
                >
                  {/* VideoConference provides the participant grid, screen-share layout, and media controls */}
                  <VideoConference />
                  {/* RoomAudioRenderer plays all remote audio tracks */}
                  <RoomAudioRenderer />
                </LiveKitRoom>
              ) : (
                <div className="flex items-center justify-center h-full bg-slate-900">
                  <div className="flex flex-col items-center gap-3">
                    <Radio className="w-10 h-10 text-primary animate-pulse" />
                    <p className="text-white/50 text-sm">Connecting to classroom...</p>
                  </div>
                </div>
              )}
              {/* Watermark rendered above LiveKit UI — must be pointer-events-none to not block controls */}
              <div className="absolute inset-0 z-[200] pointer-events-none">
                <WatermarkOverlay />
              </div>
              {/* Mobile Chat Toggle Button */}
              <button 
                className="md:hidden absolute bottom-24 right-4 z-[60] bg-primary text-primary-foreground p-3.5 rounded-full shadow-xl hover:scale-105 transition-transform"
                onClick={() => setShowMobileChat(true)}
              >
                <MessageSquare className="w-6 h-6" />
              </button>
            </ScreenProtection>
          )}
        </div>

        {/* Q&A Sidebar */}
        <div className={`
          absolute inset-y-0 right-0 z-[70] transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:z-10
          flex-1 md:flex-none w-full md:w-96 bg-slate-800 border-l border-white/10 flex flex-col shadow-[-4px_0_15px_rgba(0,0,0,0.1)] overflow-hidden
          ${showMobileChat ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="p-4 border-b border-white/10 bg-slate-800/80 backdrop-blur-sm relative">
            <button 
               className="md:hidden absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 p-1.5 rounded-full z-10"
               onClick={() => setShowMobileChat(false)}
            >
               <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/20 rounded-md text-primary">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-wider">Live Q&A</h3>
              {unanswered.length > 0 && (
                <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto shadow-sm">
                  {unanswered.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {unanswered.length === 0 && answered.length === 0 && (
              <div className="text-center py-12 flex flex-col items-center">
                <MessageSquare className="w-12 h-12 text-white/10 mb-3" />
                <p className="text-white/40 text-sm">No questions yet.</p>
                <p className="text-white/30 text-xs mt-1">Be the first to ask!</p>
              </div>
            )}
            
            {unanswered.map((q: any) => (
              <div key={q.id} className="bg-slate-700/60 hover:bg-slate-700 transition-colors rounded-2xl p-4 shadow-sm border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-[10px] font-bold shadow-sm">
                     {q.userName.charAt(0).toUpperCase()}
                   </div>
                   <span className="text-xs font-medium text-white/70">{q.userName}</span>
                </div>
                <p className="text-sm text-white mb-3 leading-relaxed">{q.question}</p>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <button
                    onClick={() => upvoteQuestion(q.id)}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-primary transition-colors bg-white/5 hover:bg-primary/10 px-2 py-1 rounded-md"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> <span className="font-medium">{q.upvotes}</span>
                  </button>
                  {session.isTeacher && (
                    <button
                      onClick={() => markAnswered(q.id)}
                      className="text-xs text-green-400 hover:text-green-300 hover:bg-green-400/10 px-2 py-1 rounded-md flex items-center gap-1.5 transition-colors font-medium"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Answered
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {answered.length > 0 && (
              <div className="pt-4 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px bg-white/10 flex-1" />
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Answered ({answered.length})</p>
                  <div className="h-px bg-white/10 flex-1" />
                </div>
                <div className="space-y-2">
                  {answered.map((q: any) => (
                    <div key={q.id} className="bg-slate-800/80 rounded-xl p-3 opacity-60 border border-white/5 border-l-2 border-l-green-500/50">
                      <div className="flex items-center gap-1.5 text-green-400 text-[10px] mb-1.5 font-medium uppercase tracking-wider">
                        <CheckCircle className="w-3 h-3" /> Answered
                      </div>
                      <p className="text-sm text-white/70 line-clamp-2">{q.question}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit question */}
          <div className="p-4 bg-slate-800/95 backdrop-blur-md border-t border-white/10">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitQuestion()}
                placeholder="Ask a question..."
                className="bg-slate-900 border-slate-700 focus:border-primary text-white placeholder:text-white/30 text-sm h-11 rounded-xl shadow-inner"
              />
              <Button 
                size="icon" 
                className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 shrink-0 shadow-md shadow-primary/20 transition-transform active:scale-95" 
                onClick={submitQuestion}
                disabled={!question.trim()}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
            <p className="text-[10px] text-white/30 mt-2 text-center uppercase tracking-wider font-medium">Press Enter to send directly to speaker</p>
          </div>
        </div>
      </div>

      {/* Report Session Modal */}
      <Dialog open={reportSession} onOpenChange={setReportSession}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 text-white border-slate-700 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Report Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReportSubmit(submitReport)} className="space-y-5 mt-4">
            <div className="text-sm text-white/70 mb-2 bg-slate-800 p-3 rounded-lg border border-slate-700">
              You are reporting this session. Please select a reason below.
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-white/80">Reason *</label>
              <select {...registerReport('reason', { required: true })} className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow">
                <option value="">Select a reason</option>
                <option value="inappropriate_behavior">Inappropriate Behavior</option>
                <option value="offensive">Offensive Content</option>
                <option value="technical_issue">Technical Issues / Spam</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-white/80">Description (optional)</label>
              <Textarea {...registerReport('description')} placeholder="Please provide more details..." rows={4} className="bg-slate-800 border-slate-700 text-white placeholder:text-white/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl resize-none transition-shadow" />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1 bg-transparent border-slate-700 text-white hover:bg-slate-800 rounded-xl" onClick={() => setReportSession(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" className="flex-1 rounded-xl shadow-md shadow-red-500/20">Submit Report</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* Live Session Feedback Modal — shown to students after session ends */}
      <FeedbackModal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSubmit={handleFeedbackSubmit}
        title="How was the session?"
        subtitle={`Rate your experience in "${session?.title}"`}
      />
    </div>
  );
}
