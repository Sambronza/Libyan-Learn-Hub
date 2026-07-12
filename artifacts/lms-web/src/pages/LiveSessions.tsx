import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useApi } from '@/hooks/useApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Users, Video, Clock, DollarSign, Flag, Radio, Plus,
  ChevronDown, ChevronUp, Package, CreditCard, CheckCircle2,
  BookmarkCheck, Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import ScheduleLiveCourseModal from '@/components/ScheduleLiveCourseModal';

// ─── Types ─────────────────────────────────────────────────────────────────────
type ActiveTab = 'available' | 'enrolled';

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-info/10 text-info' },
  live: { label: '🔴 Live Now', color: 'bg-destructive/10 text-destructive animate-pulse' },
  ended: { label: 'Ended', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive dark:text-destructive' },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LiveSessions() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('available');
  const [reportSession, setReportSession] = useState<any>(null);
  const [expandedBundles, setExpandedBundles] = useState<Set<number>>(new Set());
  const [enrollingId, setEnrollingId] = useState<number | null>(null);

  // Auto-open modal when redirected from /teacher/sessions/new (?schedule=1)
  const [showScheduleModal, setShowScheduleModal] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('schedule') === '1';
    }
    return false;
  });

  const { register: registerReport, handleSubmit: handleReportSubmit, reset: resetReport } = useForm();

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['/api/live-sessions'],
    queryFn: () => api.get('/live-sessions'),
    refetchInterval: 30000,
  });

  // ── Derived lists ───────────────────────────────────────────────────────────
  const now = new Date();

  // Available: upcoming/live sessions the current user is NOT enrolled in (and not the teacher)
  const availableSessions = (sessions as any[]).filter((s: any) =>
    (s.status === 'live' || s.status === 'scheduled') &&
    !s.isRegistered &&
    s.teacherId !== user?.id
  );

  // Enrolled: sessions the user IS registered for (or is the teacher of)
  const enrolledSessions = (sessions as any[]).filter((s: any) =>
    (s.isRegistered || s.isTeacher) &&
    (s.status === 'live' || s.status === 'scheduled' || s.status === 'ended')
  );

  const displayedSessions = activeTab === 'available' ? availableSessions : enrolledSessions;

  // ── Bundle grouping ─────────────────────────────────────────────────────────
  const groupedItems = React.useMemo(() => {
    const groups = new Map<number, any>();
    const standalone: any[] = [];

    displayedSessions.forEach((s: any) => {
      if (s.liveSessionCourseId && s.courseBundle) {
        if (!groups.has(s.liveSessionCourseId)) {
          groups.set(s.liveSessionCourseId, {
            isBundle: true,
            bundleInfo: s.courseBundle,
            sessions: [],
          });
        }
        groups.get(s.liveSessionCourseId)!.sessions.push(s);
      } else {
        standalone.push(s);
      }
    });

    groups.forEach(group => {
      group.sessions.sort(
        (a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
    });

    return [...Array.from(groups.values()), ...standalone];
  }, [displayedSessions]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const toggleBundle = (bundleId: number) => {
    setExpandedBundles(prev => {
      const next = new Set(prev);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  };

  const handleJoin = (session: any) => {
    if (!isAuthenticated) {
      setLocation(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setLocation(`/session/${session.id}`);
  };

  // Free-session instant enrollment via join endpoint
  const enrollFree = async (session: any) => {
    if (!isAuthenticated) {
      setLocation(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (parseFloat(session.price) > 0) {
      setLocation(`/checkout/live/${session.id}`);
      return;
    }
    try {
      setEnrollingId(session.id);
      await api.post(`/live-sessions/${session.id}/join`, {});
      await queryClient.invalidateQueries({ queryKey: ['/api/live-sessions'] });
      setActiveTab('enrolled');
      toast({ title: isAr ? '✅ تم التسجيل بنجاح!' : '✅ Enrolled successfully!' });
    } catch (err: any) {
      toast({ title: isAr ? 'فشل التسجيل' : 'Enrollment failed', description: err.message, variant: 'destructive' });
    } finally {
      setEnrollingId(null);
    }
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
      toast({ title: isAr ? 'تم إرسال البلاغ. شكراً!' : 'Report submitted. Thank you!' });
      setReportSession(null);
      resetReport();
    } catch (err: any) {
      toast({ title: isAr ? 'خطأ في إرسال البلاغ' : 'Error submitting report', description: err.message, variant: 'destructive' });
    }
  };

  // ── Session Card ─────────────────────────────────────────────────────────────
  const renderSessionCard = (session: any, isNested = false) => {
    const isFull = session.participantCount >= session.maxParticipants;
    const seatsLeft = session.maxParticipants - (session.participantCount || 0);
    const cfg = statusConfig[session.status] || statusConfig.scheduled;
    const isEnded = session.status === 'ended' || session.status === 'cancelled';
    const isPaid = parseFloat(session.price) > 0;

    const isTooEarly =
      session.status === 'scheduled' &&
      Date.now() < new Date(session.scheduledAt).getTime() - 10 * 60 * 1000;
    const minsUntilOpen = isTooEarly
      ? Math.ceil((new Date(session.scheduledAt).getTime() - 10 * 60 * 1000 - Date.now()) / 60000)
      : 0;

    const isEnrolling = enrollingId === session.id;

    return (
      <div
        key={session.id}
        className={`bg-card rounded-2xl border overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow duration-200 ${
          isNested
            ? 'border-primary/20 shadow-sm ms-4 md:ms-8 mt-3 mb-1 bg-background/50'
            : 'border-border shadow-sm'
        }`}
      >
        {/* Date/Time column */}
        <div className={`bg-muted/50 p-6 flex flex-col justify-center border-b md:border-b-0 md:border-e border-border shrink-0 ${isNested ? 'md:w-48 py-4' : 'md:w-56'}`}>
          <div className="flex items-center gap-2 text-primary font-semibold mb-1 text-sm">
            <Calendar className="w-4 h-4" />
            {format(new Date(session.scheduledAt), 'EEE, MMM d')}
          </div>
          <div className="text-2xl font-bold">
            {format(new Date(session.scheduledAt), 'h:mm a')}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {session.durationMinutes} min
          </div>
          {!isEnded && new Date(session.scheduledAt) > now && (
            <div className="text-[11px] text-primary/70 mt-1.5 font-medium">
              {formatDistanceToNow(new Date(session.scheduledAt), { addSuffix: true })}
            </div>
          )}
        </div>

        {/* Content column */}
        <div className={`p-6 flex-1 flex flex-col ${isNested ? 'py-4' : ''}`}>
          <div className="flex justify-between items-start mb-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
              {cfg.label}
            </span>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 text-sm font-medium ${isFull ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Users className="w-4 h-4" />
                <span dir="ltr">{session.participantCount || 0} / {session.maxParticipants}</span>
                {!isEnded && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isFull ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                    {isFull ? (isAr ? 'مكتمل' : 'Full') : `${seatsLeft} ${isAr ? 'مقعد' : 'left'}`}
                  </span>
                )}
              </div>
              {/* Seat bar */}
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                <div
                  className={`h-full rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-success/100'}`}
                  style={{ width: `${Math.min(100, ((session.participantCount || 0) / session.maxParticipants) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <h3 className={`font-display font-bold ${isNested ? 'text-lg' : 'text-xl'} mb-1`}>
            {isAr ? session.titleAr : session.title}
          </h3>
          {!isNested && session.description && (
            <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{session.description}</p>
          )}

          <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              {!isNested && (
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {session.teacherName?.charAt(0)}
                  </div>
                  {session.teacherName}
                </div>
              )}
              {!isNested && isPaid && (
                <span className="flex items-center gap-1 text-sm font-bold text-primary">
                  <DollarSign className="w-3.5 h-3.5" />{parseFloat(session.price)} LYD
                </span>
              )}
              {!isNested && !isPaid && (
                <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-semibold">
                  {isAr ? 'مجاني' : 'Free'}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {/* Report button (non-enrolled tab only) */}
              {isAuthenticated && !isEnded && activeTab === 'available' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  title={isAr ? 'الإبلاغ عن الجلسة' : 'Report this session'}
                  onClick={() => setReportSession(session)}
                >
                  <Flag className="w-4 h-4" />
                </Button>
              )}

              {/* CTA button */}
              {activeTab === 'available' ? (
                /* Available tab → enroll or checkout */
                <Button
                  disabled={isEnded || isFull || isEnrolling}
                  className={`gap-2 ${isEnrolling ? 'opacity-70' : isPaid ? 'bg-primary hover:bg-primary/90' : 'bg-success hover:bg-success/90 text-white'}`}
                  onClick={() => enrollFree(session)}
                >
                  {isEnrolling ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isPaid ? (
                    <CreditCard className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {isEnrolling
                    ? (isAr ? 'جاري...' : 'Enrolling…')
                    : isFull
                    ? (isAr ? 'مكتمل' : 'Full')
                    : isPaid
                    ? (isAr ? 'اشترك الآن' : 'Enroll Now')
                    : (isAr ? 'انضم مجاناً' : 'Join Free')}
                </Button>
              ) : (
                /* Enrolled tab → enter room */
                <Button
                  disabled={isEnded || isTooEarly}
                  title={isTooEarly ? `Opens ${minsUntilOpen}m before start` : undefined}
                  className={`gap-2 ${
                    session.status === 'live'
                      ? 'bg-destructive hover:bg-destructive/90 text-white'
                      : isEnded
                      ? 'opacity-50 bg-muted text-muted-foreground'
                      : isTooEarly
                      ? 'opacity-60'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                  onClick={() => handleJoin(session)}
                >
                  <Video className="w-4 h-4" />
                  {session.status === 'live'
                    ? (isAr ? 'انضم الآن 🔴' : 'Join Live 🔴')
                    : isEnded
                    ? (isAr ? 'انتهت' : 'Ended')
                    : isTooEarly
                    ? `${isAr ? 'يفتح خلال' : 'Opens in'} ${minsUntilOpen}m`
                    : (isAr ? 'دخول القاعة' : 'Enter Room')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Bundle Card ──────────────────────────────────────────────────────────────
  const renderBundleCard = (item: any) => {
    const bundle = item.bundleInfo;
    const bundleSessions: any[] = item.sessions;
    const isExpanded = expandedBundles.has(bundle.id);
    const teacherName = bundleSessions[0]?.teacherName;
    const isEnrolled = bundleSessions.some((s: any) => s.isRegistered);

    return (
      <div
        key={`bundle-${bundle.id}`}
        className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/10 rounded-2xl border border-info/30 overflow-hidden shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="p-6 flex flex-col md:flex-row gap-6">
          <div className="w-16 h-16 rounded-2xl bg-info/10 flex items-center justify-center shrink-0">
            <Package className="w-8 h-8 text-info" />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-200 text-info">
                {isAr ? 'باقة دورة مباشرة' : 'Live Course Bundle'}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {bundleSessions.length} / {bundle.sessionCount} {isAr ? 'جلسات مجدولة' : 'Sessions Scheduled'}
              </span>
            </div>
            <h3 className="font-display font-bold text-2xl mb-1 text-indigo-950 dark:text-indigo-50">
              {isAr ? bundle.titleAr : bundle.title}
            </h3>
            {bundle.description && (
              <p className="text-muted-foreground text-sm line-clamp-2">{bundle.description}</p>
            )}
          </div>
          <div className="md:w-64 flex flex-col justify-center items-end border-t md:border-t-0 md:border-s border-info/20 pt-4 md:pt-0 md:ps-6 text-end">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-info font-bold text-sm">
                {teacherName?.charAt(0)}
              </div>
              {teacherName}
            </div>
            <div className="text-2xl font-bold text-primary mb-1">
              {bundle.totalPrice > 0 ? `${bundle.totalPrice} LYD` : (isAr ? 'مجاني' : 'Free')}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {isAr ? 'سعر الدورة الكامل' : 'Total Course Price'}
            </div>

            {activeTab === 'available' && user?.role === 'student' && !isEnrolled && (
              <Button
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold border-0 shadow-sm mb-3"
                onClick={() => {
                  if (!isAuthenticated) setLocation('/login');
                  else if (bundle.totalPrice > 0) setLocation(`/checkout/live-course/${bundle.id}`);
                  else enrollFree(bundleSessions[0]);
                }}
              >
                <CreditCard className="w-4 h-4" />
                {isAr ? 'الاشتراك في الدورة' : 'Enroll Course'}
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full gap-2 border-info/40 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50"
              onClick={() => toggleBundle(bundle.id)}
            >
              {isExpanded ? (
                <><ChevronUp className="w-4 h-4" /> {isAr ? 'إخفاء الجلسات' : 'Hide Sessions'}</>
              ) : (
                <><ChevronDown className="w-4 h-4" /> {isAr ? `عرض ${bundleSessions.length} جلسات` : `View ${bundleSessions.length} Sessions`}</>
              )}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="bg-background/80 backdrop-blur-sm p-4 pt-1 border-t border-info/20">
            {bundleSessions.map((s: any) => renderSessionCard(s, true))}
          </div>
        )}
      </div>
    );
  };

  // ── Empty States ─────────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border animate-in fade-in duration-300">
      {activeTab === 'available' ? (
        <>
          <Radio className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-bold mb-2">
            {isAr ? 'لا توجد جلسات متاحة' : 'No sessions available right now'}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            {isAr
              ? 'تحقق لاحقاً للعثور على جلسات مباشرة قادمة.'
              : 'Check back later for upcoming live classes from our teachers.'}
          </p>
        </>
      ) : (
        <>
          <BookmarkCheck className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-bold mb-2">
            {isAr ? 'لم تسجل في أي جلسة بعد' : "You haven't enrolled in any sessions yet"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            {isAr
              ? 'انتقل إلى تبويب "الجلسات المباشرة" للتسجيل في جلسة.'
              : 'Head to the Live Sessions tab to enroll in an upcoming class.'}
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setActiveTab('available')}
          >
            <Zap className="w-4 h-4" />
            {isAr ? 'استعرض الجلسات المتاحة' : 'Browse Available Sessions'}
          </Button>
        </>
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      {/* Hero */}
      <div className="bg-gradient-to-r from-red-500/10 via-primary/5 to-transparent py-12 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <Radio className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-bold">
                  {isAr ? 'الجلسات المباشرة' : 'Live Sessions'}
                </h1>
                <p className="text-muted-foreground">
                  {isAr ? 'فصول تفاعلية في الوقت الفعلي' : 'Interactive real-time classes'}
                </p>
              </div>
            </div>

            {/* Teacher-only: Schedule button */}
            {user?.role === 'teacher' && (
              <Button
                id="schedule-live-course-btn"
                onClick={() => setShowScheduleModal(true)}
                className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all duration-200 h-11 px-5 font-semibold rounded-xl"
              >
                <Plus className="w-4 h-4" />
                {isAr ? 'جدولة دورة مباشرة' : 'Schedule Live Course'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-muted/40 rounded-xl p-1 w-fit">
          {([
            { key: 'available', label: isAr ? 'الجلسات المباشرة' : 'Live Sessions', icon: Radio },
            { key: 'enrolled', label: isAr ? 'جلساتي المسجلة' : 'Enrolled Live Sessions', icon: BookmarkCheck },
          ] as { key: ActiveTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === 'enrolled' && enrolledSessions.length > 0 && (
                <span className="ms-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white leading-none">
                  {enrolledSessions.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-card rounded-2xl animate-pulse border border-border" />
            ))}
          </div>
        ) : groupedItems.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="space-y-5">
            {groupedItems.map((item: any) =>
              item.isBundle ? renderBundleCard(item) : renderSessionCard(item, false)
            )}
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={!!reportSession} onOpenChange={o => { if (!o) { setReportSession(null); resetReport(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? 'الإبلاغ عن جلسة' : 'Report Session'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReportSubmit(submitReport)} className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {isAr ? 'تبليغ عن:' : 'Reporting:'}{' '}
              <span className="font-medium text-foreground">{reportSession?.title}</span>
            </p>
            <div>
              <label className="text-sm font-medium mb-1 block">{isAr ? 'السبب *' : 'Reason *'}</label>
              <select {...registerReport('reason', { required: true })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="no_show">{isAr ? 'المعلم لم يحضر' : "Teacher no-show"}</option>
                <option value="wrong_content">{isAr ? 'محتوى خاطئ' : 'Wrong content'}</option>
                <option value="technical_issue">{isAr ? 'مشكلة تقنية' : 'Technical issues'}</option>
                <option value="inappropriate_behavior">{isAr ? 'سلوك غير لائق' : 'Inappropriate behavior'}</option>
                <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{isAr ? 'وصف (اختياري)' : 'Description'}</label>
              <textarea {...registerReport('description')} rows={3} placeholder={isAr ? 'وصف المشكلة...' : 'Describe the issue...'} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none" />
            </div>
            <Button type="submit" className="w-full">{isAr ? 'إرسال البلاغ' : 'Submit Report'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Teacher: Schedule Live Course Wizard */}
      {user?.role === 'teacher' && (
        <ScheduleLiveCourseModal
          open={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </PageContainer>
  );
}
