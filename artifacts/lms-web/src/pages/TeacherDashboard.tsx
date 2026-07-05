import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetTeacherCourses, useGetCategories,
  useGetLiveSessions
} from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link, useLocation } from 'wouter';
import {
  Plus, Edit, Users, Video, BookOpen, Calendar,
  PlayCircle, Star, TrendingUp, Megaphone, CheckCircle, XCircle, HardDrive, Trophy, Zap, Wallet, Banknote,
  Globe, DollarSign, GraduationCap, Lock, Trash2, Clock, Eye, Radio, AlertTriangle, UserCheck, Package, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton, StatCardSkeleton, CourseCardSkeleton } from '@/components/ui/skeleton';
import ScheduleLiveCourseModal from '@/components/ScheduleLiveCourseModal';

export default function TeacherDashboard() {
  const { t, language } = useLanguage();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const api = useApi();
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const [sessionToCancel, setSessionToCancel] = React.useState<any>(null);
  const [cancelReason, setCancelReason] = React.useState('');
  const [notifyStudents, setNotifyStudents] = React.useState(true);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("courses");
  const [expandedCourses, setExpandedCourses] = React.useState<Set<number>>(new Set());
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
    if (user && user.role !== 'teacher') setLocation('/dashboard');
  }, [isAuthenticated, authLoading, user, setLocation]);

  const { data: courses, isLoading } = useGetTeacherCourses({
    query: { queryKey: ['/api/teacher/courses'], enabled: !!user && user.role === 'teacher' }
  });
  const { data: categories } = useGetCategories();
  const { data: liveSessions } = useGetLiveSessions({ teacherId: user?.id } as any, {
    query: { queryKey: ['/api/live-sessions', { teacherId: user?.id }], enabled: !!user && user.role === 'teacher' }
  });

  const [earningsData, setEarningsData] = React.useState<any>(null);
  React.useEffect(() => {
    if (user?.role === 'teacher') {
      api.get('/payments/earnings').then(setEarningsData).catch(() => {});
    }
  }, [user]);

  const mySessions = liveSessions?.filter((s: any) => s.teacherId === user?.id) || [];

  const groupedMySessions = React.useMemo(() => {
    const groups = new Map<number, any>();
    const standalone: any[] = [];
    
    mySessions.forEach((s: any) => {
      if (s.liveSessionCourseId && s.courseBundle) {
        if (!groups.has(s.liveSessionCourseId)) {
          groups.set(s.liveSessionCourseId, {
            isBundle: true,
            bundleInfo: s.courseBundle,
            sessions: []
          });
        }
        groups.get(s.liveSessionCourseId)!.sessions.push(s);
      } else {
        standalone.push(s);
      }
    });

    groups.forEach(group => {
      group.sessions.sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    });

    return [...Array.from(groups.values()), ...standalone];
  }, [mySessions]);

  const toggleCourseExpand = (courseId: number) => {
    setExpandedCourses(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const renderMySessionCard = (session: any, isNested: boolean = false) => (
    <div key={session.id} className={`bg-card rounded-2xl border p-5 ${isNested ? 'border-primary/20 shadow-none ml-4 md:ml-8 mt-3 mb-1 bg-background/50' : 'border-border shadow-sm'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-base">{session.title}</h3>
          <p className="text-sm text-muted-foreground">{session.titleAr}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ml-3 ${
          session.status === 'live' ? 'bg-red-500 text-white animate-pulse' :
          session.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
          session.status === 'ended' ? 'bg-gray-100 text-gray-600' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {session.status === 'live' ? '🔴 LIVE' : session.status}
        </span>
      </div>
      {!isNested && session.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{session.description}</p>
      )}
      <div className={`grid ${isNested ? 'grid-cols-2' : 'grid-cols-3'} gap-2 text-center mb-4`}>
        <div className="bg-muted/50 rounded-lg p-2">
          <Calendar className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
          <div className="text-xs font-medium">{new Date(session.scheduledAt).toLocaleDateString('ar-LY')}</div>
          <div className="text-xs text-muted-foreground">{new Date(session.scheduledAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <Clock className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
          <div className="text-xs font-medium">{session.durationMinutes} min</div>
          <div className="text-xs text-muted-foreground">Duration</div>
        </div>
        {!isNested && (
          <div className="bg-muted/50 rounded-lg p-2">
            <DollarSign className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs font-medium">{parseFloat(session.price) === 0 ? 'Free' : `${parseFloat(session.price)} LYD`}</div>
            <div className="text-xs text-muted-foreground">Price</div>
          </div>
        )}
      </div>
      {session.status !== 'cancelled' && (
        <div className="flex gap-2">
          <Link href={`/session/${session.id}`} className="flex-1">
            <Button className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white" size="sm">
              <Radio className="w-3.5 h-3.5" /> Join Session
            </Button>
          </Link>
          {session.status === 'live' && (
            <Button 
              variant="outline" 
              className="text-destructive border-destructive/30 hover:bg-destructive/5 shrink-0 px-3" 
              size="sm" 
              onClick={() => openCancelModal(session)}
              title="End Session"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
      {session.status === 'scheduled' && (
        <Button 
          variant="outline" 
          className="w-full gap-2 mt-2 text-destructive border-destructive/30 hover:bg-destructive/5" 
          size="sm" 
          onClick={() => openCancelModal(session)}
        >
          <XCircle className="w-3.5 h-3.5" /> Cancel Session
        </Button>
      )}
      {(session.status === 'ended' || session.status === 'cancelled') && (
        <Button 
          variant="outline" 
          className="w-full gap-2 mt-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5" 
          size="sm" 
          onClick={() => handleDeleteLiveSession(session.id)}
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete Session
        </Button>
      )}
    </div>
  );

  const handleDeleteCourse = async (courseId: number) => {
    if (!window.confirm('Delete this course? This will permanently delete all its lessons. Students will lose access.')) return;
    try {
      await api.del(`/courses/${courseId}`);
      toast({ title: 'Course deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/courses'] });
    } catch (err: any) {
      toast({ title: 'Error deleting course', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteLiveSession = async (sessionId: number) => {
    if (!window.confirm('Delete this live session? This action cannot be undone.')) return;
    try {
      await api.del(`/live-sessions/${sessionId}`);
      toast({ title: 'Live session deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions'] });
    } catch (err: any) {
      toast({ title: 'Error deleting session', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmitForReview = async (courseId: number) => {
    if (!window.confirm('Submit this course for review? You will not be able to edit it while it is under review.')) return;
    try {
      await api.put(`/courses/${courseId}/submit`, {});
      toast({ title: 'Course submitted for review successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/courses'] });
    } catch (err: any) {
      toast({ title: 'Error submitting course', description: err.message, variant: 'destructive' });
    }
  };

  const handleCancelSession = async () => {
    if (!sessionToCancel) return;
    setIsCancelling(true);
    try {
      const isLive = sessionToCancel.status === 'live';
      const endpoint = isLive ? `/live-sessions/${sessionToCancel.id}/end` : `/live-sessions/${sessionToCancel.id}/cancel`;
      
      await api.post(endpoint, {
        reason: cancelReason,
        notifyStudents
      });
      toast({ title: isLive ? 'Session ended successfully' : 'Session cancelled successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions'] });
      setCancelModalOpen(false);
      setSessionToCancel(null);
      setCancelReason('');
      setNotifyStudents(true);
    } catch (err: any) {
      toast({ title: 'Error processing request', description: err.message, variant: 'destructive' });
    } finally {
      setIsCancelling(false);
    }
  };

  const openCancelModal = (session: any) => {
    setSessionToCancel(session);
    setCancelReason('');
    setNotifyStudents(true);
    setCancelModalOpen(true);
  };

  if (authLoading || isLoading) {
    return <PageContainer><div className="p-20 text-center">Loading...</div></PageContainer>;
  }
  if (!user || user.role !== 'teacher') return null;

  const totalStudents = courses?.reduce((sum: number, c: any) => sum + (c.enrollmentCount || 0), 0) || 0;
  // Use the status enum (not legacy isPublished bool) for accuracy
  const publishedCount = courses?.filter((c: any) => c.status === 'published').length || 0;
  const pendingReviewCount = courses?.filter((c: any) => c.status === 'pending_review').length || 0;
  
  // Use earningsData if available, otherwise fallback to course revenue
  const totalCourseRevenue = courses?.reduce((sum: number, c: any) => sum + (c.totalRevenue || 0), 0) || 0;
  const totalRevenue = earningsData?.total ?? totalCourseRevenue;


  return (
    <PageContainer>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-10 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {authLoading ? (
               <div className="flex items-center gap-4">
                 <Skeleton className="w-16 h-16 rounded-2xl" />
                 <div className="space-y-2">
                   <Skeleton className="h-4 w-24" />
                   <Skeleton className="h-8 w-48" />
                 </div>
               </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-display font-bold shadow-lg">
                  {user?.fullName?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{t('teacher_dashboard.portal')}</p>
                  <h1 className="text-3xl font-display font-bold text-foreground">{user?.fullName}</h1>
                  <p className="text-muted-foreground text-sm">{user?.email}</p>
                </div>
              </div>
            )}

          </div>

          {!user?.biometricsVerified && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-red-800 font-bold mb-1">Identity Verification Required</h3>
                <p className="text-red-700 text-sm mb-3">
                  You must complete the facial and voice biometric verification before you can upload courses or schedule live sessions.
                </p>
                <Link href="/teacher/biometrics-setup">
                  <Button variant="destructive" size="sm">
                    Complete Setup Now
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ── Teacher Approval Status Banner ─────────────────────────────── */}
          {(() => {
            const status = (user as any)?.teacherApprovalStatus;
            const reason = (user as any)?.teacherRejectionReason;
            if (!status || status === 'approved') return null;

            if (status === 'pending_review') return (
              <div className="mt-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-4">
                <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-1">
                    {language === 'ar' ? '⏳ حسابك قيد المراجعة' : '⏳ Account Under Review'}
                  </h3>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    {language === 'ar'
                      ? 'تم استلام طلبك وهو قيد المراجعة من قِبل فريق الإدارة. ستتلقى إشعاراً عبر البريد الإلكتروني بمجرد اتخاذ القرار.'
                      : 'Your registration is being reviewed by our admin team. You\'ll receive an email notification once a decision is made.'}
                  </p>
                </div>
              </div>
            );

            if (status === 'rejected') return (
              <div className="mt-4 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 rounded-xl p-4 flex items-start gap-4">
                <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 dark:text-red-200 mb-1">
                    {language === 'ar' ? '❌ تم رفض طلب التسجيل' : '❌ Registration Rejected'}
                  </h3>
                  {reason && (
                    <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 mb-3 text-sm text-red-800 dark:text-red-300">
                      <span className="font-semibold">{language === 'ar' ? 'السبب: ' : 'Reason: '}</span>{reason}
                    </div>
                  )}
                  <p className="text-red-700 dark:text-red-300 text-sm mb-3">
                    {language === 'ar'
                      ? 'يمكنك تصحيح المعلومات وإعادة تقديم جميع الوثائق المطلوبة.'
                      : 'Please correct the issues and resubmit all required documents.'}
                  </p>
                  <Link href="/teacher/onboarding">
                    <Button variant="destructive" size="sm" className="gap-2">
                      {language === 'ar' ? '🔄 إعادة التقديم' : '🔄 Resubmit Application'}
                    </Button>
                  </Link>
                </div>
              </div>
            );

            if (status === 'not_submitted') return (
              <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-700 rounded-xl p-4 flex items-start gap-4">
                <GraduationCap className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-1">
                    {language === 'ar' ? 'أكمل إعداد حسابك' : 'Complete Your Account Setup'}
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm mb-3">
                    {language === 'ar'
                      ? 'لم تكمل تسجيلك بعد. ارفع وثائقك الأكاديمية للحصول على الموافقة.'
                      : 'Your registration is incomplete. Please upload your academic documents to get approved.'}
                  </p>
                  <Link href="/teacher/onboarding">
                    <Button size="sm" className="gap-2">
                      {language === 'ar' ? 'إكمال التسجيل' : 'Complete Registration'}
                    </Button>
                  </Link>
                </div>
              </div>
            );

            return null;
          })()}



          {/* Stats row */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                { icon: BookOpen, label: t('teacher_dashboard.total_courses'), value: courses?.length || 0, color: 'text-primary', bg: 'bg-primary/10' },
                { icon: Globe, label: t('teacher_dashboard.published'), value: publishedCount, color: 'text-green-600', bg: 'bg-green-100' },
                { icon: pendingReviewCount > 0 ? Clock : Users, label: pendingReviewCount > 0 ? `${pendingReviewCount} Under Review` : t('teacher_dashboard.total_students'), value: pendingReviewCount > 0 ? '' : totalStudents, color: pendingReviewCount > 0 ? 'text-blue-600' : 'text-blue-600', bg: 'bg-blue-100' },
                { icon: DollarSign, label: t('teacher_dashboard.revenue'), value: totalRevenue.toFixed(0), color: 'text-amber-600', bg: 'bg-amber-100' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 shadow-sm">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <div className="text-xl font-bold">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Storage Usage Bar */}
          {user && (() => {
            const storageUsed = (user as any).storageUsed ?? 0;
            const storageLimit = (user as any).storageLimitBytes ?? (5 * 1024 ** 3);
            const isBonusUnlocked = (user as any).isBonusUnlocked ?? false;
            const tier = (user as any).tier ?? 'free';
            const bonusSize = tier === 'diamond' ? 150 * 1024 ** 3 : 10 * 1024 ** 3;
            const effectiveLimit = storageLimit + (isBonusUnlocked ? bonusSize : 0);
            const pct = Math.min((storageUsed / effectiveLimit) * 100, 100);
            const usedGB = (storageUsed / 1024 ** 3).toFixed(2);
            const totalGB = (effectiveLimit / 1024 ** 3).toFixed(0);
            const tierColor = tier === 'golden' ? 'text-yellow-500' : tier === 'bronze' ? 'text-amber-500' : 'text-primary';
            const tierIcon = tier === 'golden' ? <Trophy className="w-4 h-4" /> : tier === 'bronze' ? <Star className="w-4 h-4" /> : <Zap className="w-4 h-4" />;
            const barColor = pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-amber-500' : 'bg-primary';
            return (
              <div className="mt-6 bg-card rounded-2xl border border-border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-muted ${tierColor} flex-shrink-0`}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Storage</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize flex items-center gap-1 ${
                        tier === 'golden' ? 'bg-yellow-100 text-yellow-600' :
                        tier === 'bronze' ? 'bg-amber-100 text-amber-600' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {tierIcon} {tier}
                      </span>
                      {isBonusUnlocked && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600 flex items-center gap-1">
                          🎁 +{tier === 'diamond' ? '150GB' : '10GB'} Bonus
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {pct > 80 && tier !== 'diamond' && (
                        <button 
                          onClick={() => setActiveTab('promote')}
                          className="text-xs text-primary font-bold hover:underline transition-colors"
                        >
                          Upgrade Plan
                        </button>
                      )}
                      <span className="text-xs text-muted-foreground font-medium">{usedGB} GB / {totalGB} GB</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`${barColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  {pct > 90 && (
                    <p className="text-xs text-destructive font-medium mt-1">⚠️ Storage almost full — consider upgrading your plan.</p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 bg-muted/60 flex flex-wrap h-auto">
            <TabsTrigger value="courses" className="gap-2"><BookOpen className="w-4 h-4" /> {t('teacher_dashboard.my_courses')}</TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2"><Radio className="w-4 h-4" /> {t('teacher_dashboard.live_sessions')}</TabsTrigger>
            <TabsTrigger value="students" className="gap-2"><GraduationCap className="w-4 h-4" /> {t('teacher_dashboard.students')}</TabsTrigger>
            <TabsTrigger value="earnings" className="gap-2"><Wallet className="w-4 h-4" /> Earnings & Payouts</TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2"><Clock className="w-4 h-4" /> Subscriptions</TabsTrigger>
            <TabsTrigger value="tutoring" className="gap-2"><UserCheck className="w-4 h-4" /> 1-to-1 Tutoring</TabsTrigger>
            <TabsTrigger value="promote" className="gap-2"><Star className="w-4 h-4" /> {t('teacher_dashboard.promote')}</TabsTrigger>
          </TabsList>

          {/* COURSES TAB */}
          <TabsContent value="courses">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold">{t('teacher_dashboard.my_courses')}</h2>
              <Link href={user?.biometricsVerified ? "/teacher/courses/new" : "/teacher/biometrics-setup"}>
                <Button className={`gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 ${!user?.biometricsVerified ? "opacity-50" : ""}`}>
                  <Plus className="w-4 h-4" /> {t('teacher_dashboard.new_course')}
                </Button>
              </Link>
            </div>
            {isLoading ? (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 {[1, 2, 3].map(i => <CourseCardSkeleton key={i} />)}
               </div>
            ) : !courses || courses.length === 0 ? (
              <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
                <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-xl font-bold">No courses yet</h3>
                <p className="text-muted-foreground mt-2 mb-6">Create your first course to start teaching students.</p>
                <Link href={user?.biometricsVerified ? "/teacher/courses/new" : "/teacher/biometrics-setup"}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Create First Course
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {courses.map((course: any) => (
                  <div key={course.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow">
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {course.thumbnailUrl ? (
                        <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <PlayCircle className="w-12 h-12 text-primary/40" />
                        </div>
                      )}
                      <div className="absolute top-3 start-3 flex gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold shadow-sm ${
                          course.status === 'published' ? 'bg-green-500 text-white' : 
                          course.status === 'pending_review' ? 'bg-blue-500 text-white' : 
                          course.status === 'rejected' ? 'bg-red-500 text-white' : 
                          'bg-yellow-400 text-yellow-900'
                        }`}>
                          {course.status === 'published' ? '✓ Published' : 
                           course.status === 'pending_review' ? '⏳ Under Review' : 
                           course.status === 'rejected' ? '✗ Rejected' : 
                           '📝 Draft'}
                        </span>
                        {parseFloat(course.price) === 0 && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-primary/20 text-primary">Free</span>
                        )}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-base mb-1 line-clamp-2">{course.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{course.titleAr}</p>
                      
                      {course.status === 'rejected' && course.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded mb-3">
                          <span className="font-bold">Reason:</span> {course.rejectionReason}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-sm font-bold">{course.lessonCount}</div>
                          <div className="text-xs text-muted-foreground">Lessons</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-sm font-bold">{course.enrollmentCount}</div>
                          <div className="text-xs text-muted-foreground">Students</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-sm font-bold text-primary">{parseFloat(course.price) === 0 ? 'Free' : `${parseFloat(course.price)} LYD`}</div>
                          <div className="text-xs text-muted-foreground">Price</div>
                        </div>
                      </div>

                      <div className="mt-auto space-y-2">
                        {(course.status === 'draft' || course.status === 'rejected') && course.lessonCount > 0 && (
                          <Button 
                            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" 
                            size="sm"
                            onClick={() => handleSubmitForReview(course.id)}
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Submit for Review
                          </Button>
                        )}
                        <Link href={`/teacher/courses/${course.id}/lessons`}>
                          <Button className="w-full gap-2 bg-primary hover:bg-primary/90" size="sm">
                            <Video className="w-3.5 h-3.5" /> Manage Lessons
                          </Button>
                        </Link>
                        <div className="grid grid-cols-2 gap-2">
                          <Link href={`/teacher/courses/${course.id}/edit`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-1 text-xs"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() => handleDeleteCourse(course.id)}
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* LIVE SESSIONS TAB */}
          <TabsContent value="sessions">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-bold">My Live Sessions</h2>
                <Button
                  className="gap-2"
                  onClick={() => {
                    if (!user?.biometricsVerified) { setLocation('/teacher/biometrics-setup'); return; }
                    setShowScheduleModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> Schedule Live Course
                </Button>
              </div>
              {mySessions.length === 0 ? (
                <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
                  <Radio className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <h3 className="text-xl font-bold">No live sessions scheduled</h3>
                  <p className="text-muted-foreground mt-2 mb-6">Schedule a live session to interact with your students in real-time.</p>
                  <Button
                    onClick={() => {
                      if (!user?.biometricsVerified) { setLocation('/teacher/biometrics-setup'); return; }
                      setShowScheduleModal(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Schedule First Session
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedMySessions.map((item: any) => {
                    if (item.isBundle) {
                      const bundle = item.bundleInfo;
                      const sessions = item.sessions;
                      const isExpanded = expandedCourses.has(bundle.id);
                      
                      return (
                        <div key={`bundle-${bundle.id}`} className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/10 rounded-2xl border border-indigo-200 dark:border-indigo-800/30 overflow-hidden shadow-sm md:col-span-2">
                          <div className="p-6 flex flex-col md:flex-row gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                              <Package className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200">
                                  Live Course Bundle
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {sessions.length} / {bundle.sessionCount} Sessions Scheduled
                                </span>
                              </div>
                              <h3 className="font-display font-bold text-xl mb-1 text-indigo-950 dark:text-indigo-50">
                                {bundle.title}
                              </h3>
                              {bundle.description && (
                                <p className="text-muted-foreground text-sm line-clamp-2">{bundle.description}</p>
                              )}
                            </div>
                            <div className="md:w-64 flex flex-col justify-center items-end border-t md:border-t-0 md:border-l border-indigo-200/50 dark:border-indigo-800/30 pt-4 md:pt-0 md:pl-6 text-right">
                              <div className="text-2xl font-bold text-primary mb-1">
                                {bundle.totalPrice > 0 ? `${bundle.totalPrice} LYD` : 'Free'}
                              </div>
                              <div className="text-xs text-muted-foreground">Total Course Price</div>
                              <Button 
                                variant="outline" 
                                className="mt-4 w-full gap-2 border-indigo-300 hover:bg-indigo-200/50 dark:border-indigo-700 dark:hover:bg-indigo-800/50"
                                onClick={() => toggleCourseExpand(bundle.id)}
                              >
                                {isExpanded ? (
                                  <><ChevronUp className="w-4 h-4" /> Hide Sessions</>
                                ) : (
                                  <><ChevronDown className="w-4 h-4" /> Manage {sessions.length} Sessions</>
                                )}
                              </Button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="bg-background/80 backdrop-blur-sm p-4 pt-1 border-t border-indigo-200/50 dark:border-indigo-800/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {sessions.map((s: any) => renderMySessionCard(s, true))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Standalone session
                    return renderMySessionCard(item, false);
                  })}
                </div>
              )}
            </div>
          </TabsContent>

      {/* ScheduleLiveCourseModal — shared by both schedule buttons in this dashboard */}
      <ScheduleLiveCourseModal open={showScheduleModal} onClose={() => setShowScheduleModal(false)} />

          {/* STUDENTS TAB */}
          <TabsContent value="students">
            <TeacherStudentsList api={api} />
          </TabsContent>

          {/* EARNINGS TAB */}
          <TabsContent value="earnings">
            <TeacherEarningsTab api={api} user={user} totalRevenue={totalRevenue} initialEarningsData={earningsData} />
          </TabsContent>

          {/* SUBSCRIPTIONS TAB */}
          <TabsContent value="subscriptions">
            <TeacherSubscriptionsTab api={api} />
          </TabsContent>

          {/* TUTORING TAB */}
          <TabsContent value="tutoring">
            <div className="max-w-2xl space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold mb-1">1-to-1 Private Tutoring</h2>
                    <p className="text-sm text-muted-foreground">
                      Register to offer private tutoring sessions directly to students. You set your own hourly rate (up to 100 LYD) and the platform retains a 10% commission.
                    </p>
                  </div>
                  <div className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                    (user as any)?.isTutoringEnabled
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {(user as any)?.isTutoringEnabled ? '✓ Active' : 'Not Registered'}
                  </div>
                </div>

                {(user as any)?.isTutoringEnabled && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">Hourly Rate</p>
                      <p className="text-2xl font-bold text-primary">{parseFloat((user as any).tutoringHourlyRate ?? 0).toFixed(2)} <span className="text-sm font-normal">LYD/hr</span></p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">Subjects</p>
                      <p className="text-sm font-medium line-clamp-2">{(user as any).tutoringSubjects || '—'}</p>
                    </div>
                  </div>
                )}

                {(user as any)?.tutoringSuspendedUntil && new Date((user as any).tutoringSuspendedUntil) > new Date() && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                    ⚠️ Your tutoring is suspended until <strong>{new Date((user as any).tutoringSuspendedUntil).toLocaleDateString()}</strong> due to a no-show report.
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <Link href="/teacher/tutoring-registration" className="flex-1">
                    <Button className="w-full gap-2">
                      <UserCheck className="w-4 h-4" />
                      {(user as any)?.isTutoringEnabled ? 'Update Tutoring Profile' : 'Register as Tutor'}
                    </Button>
                  </Link>
                  <Link href="/tutoring">
                    <Button variant="outline" className="gap-2">
                      <Eye className="w-4 h-4" /> View Requests
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="bg-muted/40 border border-border rounded-2xl p-5 text-sm space-y-3">
                <h3 className="font-semibold">How it works</h3>
                <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                  <li>Register with your subjects and hourly rate (max 100 LYD).</li>
                  <li>Students can browse and request a private session with you.</li>
                  <li>Accept or propose a new time — a meeting link is auto-generated.</li>
                  <li>After the session ends, the admin reviews student feedback and approves payment. Once approved, 90% of the fee is credited to your wallet.</li>
                  <li>If you accept a request but don't attend, you will be suspended for 1 week.</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* PROMOTE TAB */}
          <TabsContent value="promote">
            <TeacherPromoteTab api={api} user={user} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sessionToCancel?.status === 'live' ? 'End Live Session' : 'Cancel Live Session'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to {sessionToCancel?.status === 'live' ? 'end' : 'cancel'} the session <strong>{sessionToCancel?.title}</strong>? 
              This action cannot be undone.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cancellation Reason (Optional)</label>
              <Textarea 
                placeholder="Briefly explain why this session is being cancelled..." 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="notify-students" 
                checked={notifyStudents}
                onCheckedChange={(checked) => setNotifyStudents(checked as boolean)}
              />
              <label htmlFor="notify-students" className="text-sm font-medium cursor-pointer">
                Notify enrolled students about this cancellation
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)} disabled={isCancelling}>
              Keep Session
            </Button>
            <Button variant="destructive" onClick={handleCancelSession} disabled={isCancelling}>
              {isCancelling ? 'Processing...' : (sessionToCancel?.status === 'live' ? 'Confirm End Session' : 'Confirm Cancellation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function TeacherStudentsList({ api }: { api: any }) {
  const [students, setStudents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.get('/teacher/students').then((data: any) => {
      setStudents(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10">Loading students...</div>;

  if (students.length === 0) {
    return (
      <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
        <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
        <h3 className="text-xl font-bold">No students yet</h3>
        <p className="text-muted-foreground mt-2">Students will appear here once they enroll in your courses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-display font-bold">My Students ({students.length})</h2>
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((s: any, i: number) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {s.studentName?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{s.studentName}</div>
                        <div className="text-xs text-muted-foreground">{s.studentEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm">{s.courseTitle}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(s.progress, 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{Math.round(s.progress)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {new Date(s.enrolledAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function TeacherEarningsTab({ api, user, totalRevenue, initialEarningsData }: { api: any; user: any; totalRevenue: number; initialEarningsData: any }) {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = React.useState<any[]>([]);
  const [earningsData, setEarningsData] = React.useState<any>(initialEarningsData);
  const [loading, setLoading] = React.useState(!initialEarningsData);
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('bank_transfer');
  const [details, setDetails] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    try {
      const [wd, ed] = await Promise.all([
        api.get('/payments/withdrawals/me').catch(() => []),
        api.get('/payments/earnings').catch(() => null)
      ]);
      setWithdrawals(wd || []);
      if (ed) setEarningsData(ed);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/payments/withdrawals', {
        amount: parseFloat(amount),
        paymentMethod: method,
        details
      });
      toast({ title: "Withdrawal request submitted successfully" });
      setAmount('');
      setDetails('');
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to request withdrawal", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const balance = parseFloat(user?.balance || "0");
  // Available to withdraw is the server-computed value (balance minus pending requests)
  const availableToWithdraw = earningsData?.available ?? balance;

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      {earningsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
            <div className="text-2xl font-bold">{earningsData.total.toFixed(2)} LYD</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-sm text-green-700 mb-1">Available to Withdraw</p>
            <div className="text-2xl font-bold text-green-800">{earningsData.available.toFixed(2)} LYD</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm text-amber-700 mb-1">Pending Clearance</p>
            <div className="text-2xl font-bold text-amber-800">{earningsData.pending.toFixed(2)} LYD</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-sm text-blue-700 mb-1">Total Withdrawn</p>
            <div className="text-2xl font-bold text-blue-800">{earningsData.paid.toFixed(2)} LYD</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Balance Card */}
        <div className="bg-primary/10 border border-primary/20 rounded-3xl p-8 flex flex-col justify-center shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet className="w-32 h-32 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">Wallet Balance</h3>
          <div className="text-5xl font-display font-extrabold text-primary mb-4">
            {balance.toFixed(2)} <span className="text-2xl font-bold">LYD</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-sm">
            Total All-Time Revenue: <span className="font-bold">{totalRevenue.toFixed(2)} LYD</span>
          </p>
          <div className="mt-6">
            <Link href="/wallet">
              <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10">
                <Wallet className="w-4 h-4" /> Manage Wallet & Top-up
              </Button>
            </Link>
          </div>
        </div>

        {/* Request Form */}
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm">
          <h3 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" /> Request Payout
          </h3>
          <form onSubmit={handleRequestWithdrawal} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Amount (LYD)</label>
              <input 
                type="number" 
                step="0.01" 
                min="1" 
                max={balance}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                placeholder="e.g. 100.00"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: <span className="font-bold text-green-600">{availableToWithdraw.toFixed(2)} LYD</span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Payout Method</label>
              <select 
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money (MobiCash/SADAD)</option>
                <option value="cash">Cash Collection</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Account Details</label>
              <Textarea 
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Enter bank account number, phone number, etc."
                rows={2}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || availableToWithdraw <= 0 || parseFloat(amount || "0") > availableToWithdraw || parseFloat(amount || "0") <= 0}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Ledger */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border bg-muted/30">
            <h3 className="font-bold text-lg">Sales Ledger (Earnings)</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : !earningsData || earningsData.entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No earnings recorded yet.</div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border text-left text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Item</th>
                    <th className="px-5 py-3 font-semibold">Gross</th>
                    <th className="px-5 py-3 font-semibold">Fee</th>
                    <th className="px-5 py-3 font-semibold">Net</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {earningsData.entries.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/10">
                      <td className="px-5 py-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">{e.itemName || 'Course/Session'}</td>
                      <td className="px-5 py-3">{e.gross.toFixed(2)}</td>
                      <td className="px-5 py-3 text-red-500">-{e.platformFee.toFixed(2)}</td>
                      <td className="px-5 py-3 font-bold text-green-600">+{e.net.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={e.status === 'paid' ? 'default' : e.status === 'available' ? 'outline' : 'secondary'} className={e.status === 'paid' ? 'bg-blue-500 hover:bg-blue-600 text-white' : e.status === 'available' ? 'text-green-600 border-green-200 bg-green-50' : ''}>
                          {e.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Withdrawal History */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border bg-muted/30">
            <h3 className="font-bold text-lg">Withdrawal History</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : withdrawals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No withdrawal requests found.</div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border text-left text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Method</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {withdrawals.map((w: any) => (
                    <tr key={w.id} className="hover:bg-muted/10">
                      <td className="px-5 py-3 whitespace-nowrap">{new Date(w.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 font-bold">{parseFloat(w.amount).toFixed(2)} LYD</td>
                      <td className="px-5 py-3 capitalize">{w.paymentMethod.replace('_', ' ')}</td>
                      <td className="px-5 py-3">
                        <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'outline'} className={w.status === 'approved' ? 'bg-green-500 hover:bg-green-600 text-white' : w.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : ''}>
                          {w.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherPromoteTab({ api, user }: { api: any; user: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingPro, setLoadingPro] = React.useState(false);
  const [loadingAd, setLoadingAd] = React.useState(false);
  const [ads, setAds] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any[]>([]);

  const fetchData = React.useCallback(async () => {
    try {
      const [adsData, statsData] = await Promise.all([
        api.get('/advertisements/my').catch(() => []),
        api.get('/teacher-profile/analytics/summary').catch(() => [])
      ]);
      setAds(adsData || []);
      setStats(statsData || []);
    } catch (err) {}
  }, [api]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpgradePlan = async (targetTier: string) => {
    setLoadingPro(true);
    try {
      const data = await api.post('/payments/upgrade-plan', { targetTier });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Upgrade Failed", description: err.message, variant: 'destructive' });
    } finally {
      setLoadingPro(false);
    }
  };

  const handleBuyAd = async (adType: 'banner' | 'featured_search') => {
    setLoadingAd(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 day ad

      await api.post('/advertisements', {
        adType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        budgetPaid: '50' // Placeholder 50 LYD
      });
      toast({ title: "Ad Campaign Started!", description: "Your ad is now active for 7 days." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAd(false);
    }
  };

  const profileViews = stats.find(s => s.eventType === 'profile_view')?.count || 0;

  return (
    <div className="space-y-8">
      {/* Overview Analytics */}
      <div>
        <h2 className="text-xl font-display font-bold mb-4">Analytics Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{profileViews}</div>
              <div className="text-sm text-muted-foreground">Profile Views</div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold capitalize">{user.tier ?? 'free'}</div>
              <div className="text-sm text-muted-foreground">Plan Status</div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{ads.filter(a => a.isActive).length}</div>
              <div className="text-sm text-muted-foreground">Active Ad Campaigns</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Upgrade Block */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-border bg-gradient-to-br from-blue-50 to-transparent">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold font-display">Upgrade Plan</h3>
              <Badge className="bg-blue-500 hover:bg-blue-600 capitalize">{user.tier ?? 'free'} PLAN</Badge>
            </div>
            <p className="text-muted-foreground text-sm">Pay only the difference when you upgrade to a higher tier.</p>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <div className="space-y-3 mb-6 flex-1">
              {['bronze', 'golden', 'diamond'].map((t) => {
                const currentTier = user.tier || 'free';
                const prices: Record<string, number> = { free: 0, bronze: 30, golden: 50, diamond: 100 };
                const currentPrice = prices[currentTier];
                const targetPrice = prices[t];
                const diff = targetPrice - currentPrice;
                const isCurrent = currentTier === t;
                const isLower = diff < 0;
                
                if (isLower) return null; // Don't show lower tiers
                
                return (
                  <div key={t} className="flex items-center justify-between p-3 border rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`w-4 h-4 ${isCurrent ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span className="capitalize font-medium">{t}</span>
                    </div>
                    {isCurrent ? (
                      <span className="text-sm font-bold text-green-600">Current</span>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => handleUpgradePlan(t)}
                        disabled={loadingPro}
                        className="bg-primary hover:bg-primary/90 text-xs"
                      >
                        Upgrade (Pay {diff} LYD)
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Upgrading instantly unlocks higher storage and streaming limits.
            </p>
          </div>
        </div>

        {/* Advertisements Block */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="text-xl font-bold font-display tracking-tight mb-2">Promote & Advertise</h3>
            <p className="text-muted-foreground text-sm">Boost your visibility to thousands of students across the platform.</p>
          </div>
          <div className="p-6 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border rounded-xl p-4 flex flex-col items-center text-center">
                <Globe className="w-8 h-8 text-primary mb-2 opacity-80" />
                <h4 className="font-bold text-sm">Homepage Banner</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-4 flex-1">Features your profile on the main landing page.</p>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleBuyAd('banner')} disabled={loadingAd}>
                  Buy (50 LYD / wk)
                </Button>
              </div>
              <div className="border border-border rounded-xl p-4 flex flex-col items-center text-center">
                <TrendingUp className="w-8 h-8 text-blue-500 mb-2 opacity-80" />
                <h4 className="font-bold text-sm">Search Featured</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-4 flex-1">Always appear at the top of category searches.</p>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleBuyAd('featured_search')} disabled={loadingAd}>
                  Buy (30 LYD / wk)
                </Button>
              </div>
            </div>

            {ads.length > 0 && (
              <div className="mt-6">
                <h4 className="font-bold text-sm mb-3">Your Campaigns</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {ads.map((ad, i) => (
                    <div key={i} className="flex justify-between items-center bg-muted/50 p-3 rounded-xl border border-border/50 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={ad.isActive ? "bg-green-100 text-green-700" : ""}>
                          {ad.isActive ? 'Active' : 'Ended'}
                        </Badge>
                        <span className="font-medium capitalize">{ad.adType.replace('_', ' ')}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Until {new Date(ad.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────
function TeacherSubscriptionsTab({ api }: { api: any }) {
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.get('/teacher/subscription-stats')
      .then((data: any) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading subscription stats…</div>;
  }
  if (!stats) {
    return <div className="py-20 text-center text-muted-foreground">Could not load subscription stats.</div>;
  }

  const cards = [
    { label: 'Active Subscriptions', value: stats.totals?.active ?? 0, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Expired', value: stats.totals?.expired ?? 0, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Renewed', value: stats.totals?.renewed ?? 0, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Total Enrollments', value: stats.totals?.total ?? 0, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
              <Clock className={`w-5 h-5 ${c.color}`} />
            </div>
            <div className="text-2xl font-extrabold text-foreground">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display font-bold text-foreground">Per-Course Breakdown</h3>
          <p className="text-xs text-muted-foreground">Active, expired and renewed subscriptions for each of your courses.</p>
        </div>
        {(!stats.courses || stats.courses.length === 0) ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No courses yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {stats.courses.map((c: any) => (
              <div key={c.courseId} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{c.title}</div>
                </div>
                <div className="flex gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700">{c.active} active</span>
                  <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700">{c.expired} expired</span>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{c.renewed} renewed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
