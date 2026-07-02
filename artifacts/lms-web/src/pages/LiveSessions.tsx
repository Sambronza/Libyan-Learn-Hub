import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useApi } from '@/hooks/useApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Users, Video, Clock, DollarSign, Flag, Radio, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import ReactPlayer from 'react-player';
import ScheduleLiveCourseModal from '@/components/ScheduleLiveCourseModal';

const Player = ReactPlayer as any;

export default function LiveSessions() {
  const { language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportSession, setReportSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'recordings'>('live');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const { register: registerReport, handleSubmit: handleReportSubmit, reset: resetReport } = useForm();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['/api/live-sessions'],
    queryFn: () => api.get('/live-sessions'),
    refetchInterval: 30000,
  });

  const { data: registrations } = useQuery({
    queryKey: ['/api/room/registrations'],
    queryFn: async () => {
      if (!user) return {};
      return {};
    },
    enabled: !!user,
  });

  const handleEnterRoom = (session: any) => {
    if (!isAuthenticated) { setLocation(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    if (!session.isRegistered && !session.isTeacher && parseFloat(session.price) > 0) {
      setLocation(`/checkout/live/${session.id}`);
      return;
    }
    setLocation(`/session/${session.id}`);
  };

  const submitReport = async (data: any) => {
    try {
      await api.post('/reports', {
        type: 'session',
        reason: data.reason,
        description: data.description,
        targetId: reportSession.id,
        reportedUserId: reportSession.teacherId,
      });
      toast({ title: 'Report submitted. Thank you for your feedback.' });
      setReportSession(null);
      resetReport();
    } catch (err: any) {
      toast({ title: 'Error submitting report', description: err.message, variant: 'destructive' });
    }
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
    live: { label: '🔴 Live Now', color: 'bg-red-100 text-red-700 animate-pulse' },
    ended: { label: 'Ended', color: 'bg-gray-100 text-gray-500' },
    cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-400' },
  };

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Live tab: only scheduled or currently live sessions
  const liveSessions = (sessions || []).filter((s: any) =>
    s.status === 'live' || s.status === 'scheduled'
  );

  // Recordings tab: ended sessions that have a recording URL, within the last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recordedSessions = (sessions || []).filter((s: any) =>
    s.status === 'ended' && s.recordingUrl && new Date(s.scheduledAt) >= thirtyDaysAgo
  );

  const displayedSessions = activeTab === 'live' ? liveSessions : recordedSessions;

  return (
    <PageContainer>
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-12 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 mb-3 sm:mb-0">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <Radio className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold">Live Sessions</h1>
                <p className="text-muted-foreground text-lg">Interactive classes and recordings</p>
              </div>
            </div>

            {/* Teacher-only: Schedule a new live session course */}
            {user?.role === 'teacher' && (
              <Button
                id="schedule-live-course-btn"
                onClick={() => setShowScheduleModal(true)}
                className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all duration-200 h-11 px-5 font-semibold rounded-xl"
              >
                <Plus className="w-4 h-4" />
                Schedule Live Session Course
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-4 mb-6 border-b border-border">
          <button
            className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === 'live' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('live')}
          >
            Live Classes
            {activeTab === 'live' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
          </button>
          <button
            className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === 'recordings' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('recordings')}
          >
            Watch Recordings
            {activeTab === 'recordings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-card rounded-2xl animate-pulse border border-border" />)}
          </div>
        ) : (sessions || []).length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
            <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">No sessions found</h3>
            <p className="text-muted-foreground mt-2">Check back later for {activeTab === 'live' ? 'upcoming classes' : 'recordings'}.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {displayedSessions.map((session: any) => {
              const isFull = session.participantCount >= session.maxParticipants;
              const seatsLeft = session.maxParticipants - (session.participantCount || 0);
              const cfg = statusConfig[session.status] || statusConfig.scheduled;
              const isEnded = session.status === 'ended' || session.status === 'cancelled';

              return (
                <div key={session.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col md:flex-row hover:shadow-md transition-shadow">
                  {/* Date/Time block */}
                  <div className="md:w-56 bg-muted/50 p-6 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border shrink-0">
                    <div className="flex items-center gap-2 text-primary font-semibold mb-1 text-sm">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(session.scheduledAt), 'EEE, MMM d yyyy')}
                    </div>
                    <div className="text-2xl font-bold">
                      {format(new Date(session.scheduledAt), 'h:mm a')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {session.durationMinutes} min
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <div className="flex items-center gap-3">
                        {/* Seats indicator */}
                        <div className={`flex items-center gap-1.5 text-sm font-medium ${isFull ? 'text-red-500' : 'text-muted-foreground'}`}>
                          <Users className="w-4 h-4" />
                          <span dir="ltr" className="inline-block">{session.participantCount || 0} / {session.maxParticipants}</span>
                          {!isEnded && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                              {isFull ? 'Full' : `${seatsLeft} left`}
                            </span>
                          )}
                        </div>
                        {/* Seat bar */}
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full ${isFull ? 'bg-red-400' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, ((session.participantCount || 0) / session.maxParticipants) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-xl mb-1">
                      {language === 'ar' ? session.titleAr : session.title}
                    </h3>
                    {session.description && (
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{session.description}</p>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {session.teacherName?.charAt(0)}
                          </div>
                          {session.teacherName}
                        </div>
                        {parseFloat(session.price) > 0 && (
                          <span className="flex items-center gap-1 text-sm font-bold text-primary">
                            <DollarSign className="w-3.5 h-3.5" />{parseFloat(session.price)} LYD
                          </span>
                        )}
                        {parseFloat(session.price) === 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Free</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {isAuthenticated && !isEnded && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            title="Report this session"
                            onClick={() => setReportSession(session)}
                          >
                            <Flag className="w-4 h-4" />
                          </Button>
                        )}
                        {activeTab === 'recordings' && session.recordingUrl ? (
                          <Button
                            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => setPlaybackUrl(session.recordingUrl)}
                          >
                            <Video className="w-4 h-4" />
                            Watch Recording
                          </Button>
                        ) : (() => {
                          const isTooEarly = session.status === 'scheduled' &&
                            Date.now() < new Date(session.scheduledAt).getTime() - 10 * 60 * 1000;
                          const minsUntilOpen = isTooEarly
                            ? Math.ceil((new Date(session.scheduledAt).getTime() - 10 * 60 * 1000 - Date.now()) / 60000)
                            : 0;
                          return (
                            <Button
                              disabled={isEnded || isFull || isTooEarly}
                              title={isTooEarly ? `Opens ${minsUntilOpen}m before start` : undefined}
                              className={`gap-2 ${session.status === 'live' ? 'bg-red-600 hover:bg-red-700 text-white' : isEnded ? 'opacity-50' : isTooEarly ? 'opacity-60' : 'bg-primary hover:bg-primary/90'}`}
                              onClick={() => handleEnterRoom(session)}
                            >
                              <Video className="w-4 h-4" />
                              {session.status === 'live'
                                ? 'Join Live'
                                : isEnded
                                ? 'Ended'
                                : isFull
                                ? 'Session Full'
                                : isTooEarly
                                ? `Opens in ${minsUntilOpen}m`
                                : 'Enter Room'}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={!!reportSession} onOpenChange={(o) => { if (!o) { setReportSession(null); resetReport(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReportSubmit(submitReport)} className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Reporting: <span className="font-medium text-foreground">{reportSession?.title}</span></p>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason *</label>
              <select {...registerReport('reason', { required: true })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="no_show">Teacher no-show</option>
                <option value="wrong_content">Wrong content</option>
                <option value="technical_issue">Technical issues</option>
                <option value="inappropriate_behavior">Inappropriate behavior</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <textarea {...registerReport('description')} rows={3} placeholder="Describe the issue..." className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none" />
            </div>
            <Button type="submit" className="w-full">Submit Report</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Playback Modal */}
      <Dialog open={!!playbackUrl} onOpenChange={(o) => { if (!o) setPlaybackUrl(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-slate-800">
          <DialogHeader className="sr-only">
            <DialogTitle>Session Recording</DialogTitle>
          </DialogHeader>
          {playbackUrl && (
            <div className="aspect-video w-full bg-black flex items-center justify-center">
              <Player 
                url={playbackUrl} 
                controls={true}
                width="100%" 
                height="100%"
                playing={true}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Teacher-only: Schedule Live Session Course Wizard */}
      {user?.role === 'teacher' && (
        <ScheduleLiveCourseModal
          open={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </PageContainer>
  );
}
