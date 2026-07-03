import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useGetMyEnrollments, useGetLiveSessions } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { BookOpen, PlayCircle, Trophy, Calendar, Radio, Clock, DollarSign, ExternalLink, CheckCircle, Video, ArrowRight, GraduationCap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/useApi';
import { Skeleton, StatCardSkeleton, CourseCardSkeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const [activeTab, setActiveTab] = useState<'courses' | 'academy'>('courses');

  const { data: enrollmentData } = useQuery({
    queryKey: ['academy-enrollment'],
    queryFn: () => api.get('/academy/my-enrollment')
  });

  const { data: applications } = useQuery({
    queryKey: ['academy-application'],
    queryFn: () => api.get('/academy/my-application'),
  });

  const { enrolled, current } = enrollmentData || { enrolled: false, current: null };
  const hasPendingApp = applications?.some((a: any) => a.status === 'pending' || a.status === 'waitlisted');


  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
    if (user?.role === 'teacher') setLocation('/teacher/dashboard');
  }, [isAuthenticated, authLoading, user, setLocation]);

  const { data: enrollments, isLoading } = useGetMyEnrollments({
    query: { queryKey: ['my-enrollments'], enabled: !!user && user.role === 'student' }
  });

  const { data: allSessions } = useGetLiveSessions({
    queryKey: ['live-sessions'], enabled: !!user
  } as any);

  const upcomingSessions = allSessions?.filter((s: any) =>
    new Date(s.scheduledAt) >= new Date() && s.status !== 'ended' && s.status !== 'cancelled'
  ).slice(0, 4) || [];

  const { data: continueWatching } = useQuery({
    queryKey: ['continue-watching'],
    queryFn: () => api.get('/progress/continue-watching'),
    enabled: !!user
  });

  const handleEnrollFree = async (courseId: number) => {
    try {
      await api.post(`/courses/${courseId}/enroll`, {});
      window.location.reload();
    } catch {}
  };

  const handleJoinSession = (session: any) => {
    if (!session.isRegistered && !session.isTeacher && parseFloat(session.price) > 0) {
      setLocation(`/checkout/live/${session.id}`);
      return;
    }
    setLocation(`/session/${session.id}`);
  };

  if (authLoading || isLoading) {
    return <PageContainer><div className="p-20 text-center">Loading dashboard...</div></PageContainer>;
  }
  if (!user) return null;

  const inProgress = enrollments?.filter((e: any) => e.progress > 0 && e.progress < 100).length || 0;
  const completed = enrollments?.filter((e: any) => e.progress >= 100).length || 0;

  return (
    <PageContainer>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-10 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {authLoading ? (
             <div className="flex items-center gap-4">
               <Skeleton className="w-16 h-16 rounded-2xl" />
               <div className="space-y-2">
                 <Skeleton className="h-4 w-24" />
                 <Skeleton className="h-8 w-48" />
               </div>
             </div>
          ) : (
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-display font-bold shadow-lg">
                {user?.fullName?.charAt(0)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Student Dashboard</p>
                <h1 className="text-2xl font-display font-bold text-foreground">{t('student_dashboard.welcome', { name: user?.fullName })}</h1>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                { icon: BookOpen, label: t('student_dashboard.enrolled'), value: enrollments?.length || 0, color: 'text-primary', bg: 'bg-primary/10' },
                { icon: PlayCircle, label: t('student_dashboard.in_progress'), value: inProgress, color: 'text-blue-600', bg: 'bg-blue-100' },
                { icon: Trophy, label: t('student_dashboard.completed'), value: completed, color: 'text-green-600', bg: 'bg-green-100' },
                { icon: Radio, label: t('teacher_dashboard.live_sessions'), value: upcomingSessions.length, color: 'text-red-500', bg: 'bg-red-100' },
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
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'courses'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {t('teacher_dashboard.my_courses')}
          </button>
          <button
            onClick={() => setActiveTab('academy')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'academy'
                ? 'bg-card text-amber-600 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            {t('academy.program')}
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white leading-none">
              NEW
            </span>
          </button>
          
          <Link href="/wallet">
            <button
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 text-muted-foreground hover:text-foreground`}
            >
              <DollarSign className="w-4 h-4" />
              Wallet & Prepaid Cards
            </button>
          </Link>
        </div>
      </div>

      {activeTab === 'courses' ? (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        
        {/* Continue Watching */}
        {continueWatching && continueWatching.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-primary" />
                {t('student_dashboard.continue_watching')}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {continueWatching.map((item: any) => {
                const isArabic = item.courseTitleAr || item.lessonTitleAr;
                // Calculate percentage
                const progressPct = item.totalDuration > 0 ? (item.watchedSeconds / (item.totalDuration * 60)) * 100 : 0;
                
                return (
                  <Link href={`/courses/${item.courseId}/learn`} key={item.lessonId}>
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex gap-4 p-4">
                        <div className="w-24 h-24 rounded-xl bg-muted overflow-hidden shrink-0 relative">
                          {item.courseThumbnailUrl ? (
                            <img src={item.courseThumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10">
                              <Video className="w-8 h-8 text-primary/40" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlayCircle className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="flex flex-col justify-center flex-1 min-w-0">
                          <p className="text-xs text-primary font-bold tracking-wider uppercase mb-1 truncate">{item.courseTitle}</p>
                          <h3 className="font-bold text-sm mb-2 line-clamp-2 leading-tight">
                            {isArabic ? item.lessonTitleAr : item.lessonTitle}
                          </h3>
                          <div className="mt-auto">
                            <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min(progressPct, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>Resume</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* My Courses */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-display font-bold">My Courses</h2>
            <Link href="/courses">
              <Button variant="outline" size="sm">Browse More Courses →</Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <CourseCardSkeleton key={i} />)}
            </div>
          ) : !enrollments || enrollments.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold">No courses yet</h3>
              <p className="text-muted-foreground mt-2 mb-6">Explore our catalog and start learning today.</p>
              <Link href="/courses">
                <Button>Browse Courses</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.map((enrollment: any) => (
                <div key={enrollment.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {enrollment.course?.thumbnailUrl ? (
                      <img src={enrollment.course.thumbnailUrl} alt={enrollment.course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <PlayCircle className="w-10 h-10 text-primary/40" />
                      </div>
                    )}
                    {enrollment.progress >= 100 && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-base mb-1 line-clamp-2">{enrollment.course?.title}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{enrollment.course?.teacherName}</p>
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Progress</span>
                        <span className="font-medium">{Math.round(enrollment.progress)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 mb-4">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(enrollment.progress, 100)}%` }}
                        />
                      </div>
                      <Link href={`/courses/${enrollment.courseId}/learn`}>
                        <Button className="w-full" variant={enrollment.progress > 0 ? 'default' : 'outline'}>
                          {enrollment.progress >= 100 ? 'Review Course' : enrollment.progress > 0 ? 'Continue Learning →' : 'Start Course →'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Live Sessions */}
        {upcomingSessions.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold">Upcoming Live Sessions</h2>
              <Link href="/live-sessions">
                <Button variant="outline" size="sm">View All Sessions →</Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingSessions.map((session: any) => (
                <div key={session.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold">{session.title}</h3>
                      <p className="text-sm text-muted-foreground">{session.teacherName}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ml-3 ${
                      session.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {session.status === 'live' ? '🔴 LIVE NOW' : '📅 Scheduled'}
                    </span>
                  </div>
                  {session.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{session.description}</p>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground mb-4 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(session.scheduledAt).toLocaleDateString('en-LY', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(session.scheduledAt).toLocaleTimeString('en-LY', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {parseFloat(session.price) === 0 ? 'Free' : `${parseFloat(session.price)} LYD`}
                    </span>
                  </div>
                  <Button
                    className="mt-auto gap-2 bg-primary hover:bg-primary/90"
                    size="sm"
                    onClick={() => handleJoinSession(session)}
                  >
                    <Video className="w-3.5 h-3.5" />
                    {session.status === 'live' ? 'Join Live Session' : 'Enter Room'}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Browse Live Sessions if none enrolled */}
        {upcomingSessions.length === 0 && (
          <section className="text-center py-12 bg-card rounded-3xl border border-dashed border-border">
            <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <h3 className="font-bold text-lg">No upcoming live sessions</h3>
            <p className="text-muted-foreground text-sm mt-2 mb-4">Check the live sessions page for scheduled classes from teachers.</p>
            <Link href="/live-sessions">
              <Button variant="outline">View Live Sessions →</Button>
            </Link>
          </section>
        )}
      </div>
      ) : (
      /* Academy Tab */
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!enrolled ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-amber-500/30">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
              <GraduationCap className="w-10 h-10 text-amber-500" />
            </div>
            
            {hasPendingApp ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-4">
                  <Clock className="w-3 h-3" />
                  Request Pending
                </span>
                <h3 className="text-2xl font-display font-bold text-foreground mb-3">Application Under Review</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                  Your application to the EduLibya Online Academy is currently being reviewed by our administration team.
                </p>
                <Link href="/academy/dashboard">
                  <Button variant="outline" className="font-bold border-2 rounded-xl">View Details</Button>
                </Link>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold mb-4">
                  <Sparkles className="w-3 h-3" />
                  Enrollment Open
                </span>
                <h3 className="text-2xl font-display font-bold text-foreground mb-3">EduLibya Academy</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                  The EduLibya Online Academy offers full primary and secondary education following the official Libyan curriculum. Earn your diploma from home.
                </p>
                <div className="flex gap-4 justify-center">
                  <Link href="/academy">
                    <Button variant="outline" className="font-bold rounded-xl border-amber-500/30 text-amber-700 hover:bg-amber-500/10">Learn More</Button>
                  </Link>
                  <Link href="/academy/apply">
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 gap-2">
                       Apply Now <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
             <div className="flex items-start justify-between mb-8 pb-8 border-b border-border">
               <div className="flex items-center gap-4">
                 <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                   <GraduationCap className="w-8 h-8 text-amber-600" />
                 </div>
                 <div>
                   <h3 className="text-2xl font-bold font-display">{current?.programName}</h3>
                   <p className="text-muted-foreground">Grade {current?.currentGradeLevel} — {current?.semesterName}</p>
                 </div>
               </div>
               <Link href="/academy/dashboard">
                 <Button className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold px-6 shadow-md shadow-amber-500/20">
                   Go to Academy Dashboard
                 </Button>
               </Link>
             </div>
             
             <h4 className="font-bold mb-4 flex items-center gap-2">
               <BookOpen className="w-5 h-5 text-muted-foreground" />
               Current Registered Subjects ({current?.registrations?.length || 0})
             </h4>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {current?.registrations?.slice(0, 3).map((reg: any) => (
                 <div key={reg.id} className="border border-border rounded-xl p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                   <div className="font-medium truncate">{reg.subjectName}</div>
                   <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">
                     {reg.status === 'registered' ? 'Registered' : 'In Progress'}
                   </span>
                 </div>
               ))}
               {current?.registrations && current.registrations.length > 3 && (
                 <div className="border border-dashed border-border rounded-xl p-4 flex items-center justify-center text-muted-foreground font-medium bg-muted/20">
                    +{current.registrations.length - 3} more subjects
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
      )}
    </PageContainer>
  );
}
