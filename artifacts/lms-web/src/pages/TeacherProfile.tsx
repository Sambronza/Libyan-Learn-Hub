import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApi } from '@/hooks/useApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FollowButton, TeacherPostsSection } from '@/components/community/TeacherPosts';
import {
  BadgeCheck, BookOpen, Users, Star, Download, Share2,
  Flag, Crown, Award, PlayCircle, Copy, Check, Facebook,
  Video, Clock, CalendarCheck2, Trophy, Zap, CheckCircle2,
  ChevronRight, Radio, Layers, ExternalLink, CalendarDays,
  GraduationCap, Target, TrendingUp,
} from 'lucide-react';

const ENDORSEMENT_TRAITS = [
  { key: 'clear_explanations', en: 'Clear Explanations', ar: 'شرح واضح' },
  { key: 'fast_replies', en: 'Fast Replies', ar: 'ردود سريعة' },
  { key: 'helpful', en: 'Very Helpful', ar: 'مساعد جداً' },
  { key: 'organized', en: 'Well Organized', ar: 'منظم جداً' },
  { key: 'patient', en: 'Patient', ar: 'صبور' },
  { key: 'engaging', en: 'Engaging', ar: 'شيق' },
];

const BADGE_COLORS: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  amber:  { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-300 dark:border-amber-600',  icon: Trophy },
  violet: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-600', icon: Zap },
  blue:   { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300',    border: 'border-blue-300 dark:border-blue-600',    icon: Star },
  teal:   { bg: 'bg-teal-100 dark:bg-teal-900/30',   text: 'text-teal-700 dark:text-teal-300',   border: 'border-teal-300 dark:border-teal-600',   icon: CheckCircle2 },
  green:  { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-300',  border: 'border-green-300 dark:border-green-600',  icon: GraduationCap },
};

function formatDateTime(dateStr: string, language: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(language === 'ar' ? 'ar-LY' : 'en-GB', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(dateStr: string, language: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(language === 'ar' ? 'ar-LY' : 'en-GB', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function timeUntil(dateStr: string, language: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return language === 'ar' ? 'الآن' : 'Now';
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return language === 'ar' ? `خلال ${d} يوم` : `in ${d}d`;
  if (h > 0) return language === 'ar' ? `خلال ${h} ساعة` : `in ${h}h`;
  const m = Math.floor(diff / 60000);
  return language === 'ar' ? `خلال ${m} دقيقة` : `in ${m}m`;
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, language }: { status: string; language: string }) {
  const cfg = {
    scheduled: { label: { en: 'Upcoming', ar: 'قادم' }, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    live:      { label: { en: 'Live Now', ar: 'مباشر' }, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse' },
    ended:     { label: { en: 'Ended', ar: 'انتهى' }, cls: 'bg-muted text-muted-foreground' },
    accepted:  { label: { en: 'Confirmed', ar: 'مؤكد' }, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  }[status] ?? { label: { en: status, ar: status }, cls: 'bg-muted text-muted-foreground' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.cls}`}>
      {status === 'live' && <Radio className="w-2.5 h-2.5" />}
      {language === 'ar' ? cfg.label.ar : cfg.label.en}
    </span>
  );
}

// ─── Activity Panel ────────────────────────────────────────────────────────────
function ActivityPanel({ slug, language }: { slug: string; language: string }) {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'recent' | 'tutoring'>('upcoming');

  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/teacher-profile/activities', slug],
    queryFn: () => api.get(`/teacher-profile/activities/${slug}`),
    enabled: !!slug,
    staleTime: 60_000,
  });

  const hasUpcoming = (activities?.upcomingSessions?.length ?? 0) > 0;
  const hasRecent   = (activities?.recentSessions?.length ?? 0) > 0;
  const hasTutoring = (activities?.upcomingTutoring?.length ?? 0) > 0;
  const hasLiveCourses = (activities?.liveCourses?.length ?? 0) > 0;
  const hasAny = hasUpcoming || hasRecent || hasTutoring || hasLiveCourses;

  return (
    <aside className="space-y-5">

      {/* Badges */}
      {activities?.badges?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            {language === 'ar' ? 'الإنجازات' : 'Achievements'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {activities.badges.map((badge: any) => {
              const cfg = BADGE_COLORS[badge.color] ?? BADGE_COLORS.amber;
              const Icon = cfg.icon;
              return (
                <span key={badge.key}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {language === 'ar' ? badge.labelAr : badge.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Session Courses */}
      {hasLiveCourses && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            {language === 'ar' ? 'دورات الجلسات المباشرة' : 'Live Session Courses'}
          </h3>
          <div className="space-y-2">
            {activities.liveCourses.map((lc: any) => (
              <div key={lc.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-1">
                    {language === 'ar' ? lc.titleAr : lc.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lc.sessionCount} {language === 'ar' ? 'جلسة' : 'sessions'} · {parseFloat(lc.totalPrice) === 0 ? (language === 'ar' ? 'مجاناً' : 'Free') : `${parseFloat(lc.totalPrice).toFixed(0)} LYD`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities Tabs */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b border-border">
          {[
            { key: 'upcoming', label: { en: 'Upcoming', ar: 'قادم' }, Icon: CalendarDays, show: true },
            { key: 'recent',   label: { en: 'Recent', ar: 'الأخيرة' }, Icon: Clock, show: hasRecent },
            { key: 'tutoring', label: { en: '1-to-1', ar: 'خاص' }, Icon: Target, show: hasTutoring },
          ].filter(t => t.show).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors
                ${activeTab === tab.key
                  ? 'bg-primary/5 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'}`}
            >
              <tab.Icon className="w-3.5 h-3.5" />
              {language === 'ar' ? tab.label.ar : tab.label.en}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : !hasAny ? (
            <div className="text-center py-8">
              <CalendarCheck2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'لا توجد أنشطة قادمة' : 'No upcoming activities'}
              </p>
            </div>
          ) : (
            <>
              {/* Upcoming sessions */}
              {activeTab === 'upcoming' && (
                <div className="space-y-3">
                  {activities?.upcomingSessions?.length === 0 ? (
                    <div className="text-center py-6">
                      <CalendarCheck2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">{language === 'ar' ? 'لا توجد جلسات قادمة' : 'No upcoming sessions'}</p>
                    </div>
                  ) : activities?.upcomingSessions?.map((s: any) => (
                    <div key={s.id} className="border border-border rounded-xl p-3 hover:border-primary/30 hover:bg-primary/2 transition-all group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                          {language === 'ar' ? s.titleAr : s.title}
                        </p>
                        <StatusBadge status={s.status} language={language} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatDateTime(s.scheduledAt, language)}</span>
                        <span className="ml-auto font-medium text-primary">{timeUntil(s.scheduledAt, language)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{s.durationMinutes} {language === 'ar' ? 'دقيقة' : 'min'}</span>
                        <span className="mx-1">·</span>
                        <Users className="w-3 h-3" />
                        <span>{s.maxParticipants} {language === 'ar' ? 'مقعد' : 'seats'}</span>
                        <span className="mx-1">·</span>
                        <span className="font-semibold text-foreground">
                          {parseFloat(s.price) === 0 ? (language === 'ar' ? 'مجاناً' : 'Free') : `${parseFloat(s.price).toFixed(0)} LYD`}
                        </span>
                      </div>
                      {s.status === 'live' && s.meetingUrl && (
                        <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                          <Button size="sm" className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white">
                            <Radio className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'انضم الآن' : 'Join Now'}
                          </Button>
                        </a>
                      )}
                      {s.status === 'scheduled' && (
                        <Link href={`/live-sessions`}>
                          <Button size="sm" variant="outline" className="w-full mt-3 gap-2 text-xs">
                            {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recent sessions */}
              {activeTab === 'recent' && (
                <div className="space-y-3">
                  {activities?.recentSessions?.length === 0 ? (
                    <div className="text-center py-6">
                      <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">{language === 'ar' ? 'لا توجد جلسات حديثة' : 'No recent sessions'}</p>
                    </div>
                  ) : activities?.recentSessions?.map((s: any) => (
                    <div key={s.id} className="border border-border rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold line-clamp-2">
                          {language === 'ar' ? s.titleAr : s.title}
                        </p>
                        <StatusBadge status={s.status} language={language} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {formatDate(s.scheduledAt, language)} · {s.durationMinutes} {language === 'ar' ? 'دقيقة' : 'min'}
                      </p>
                      {s.recordingUrl && (
                        <a href={s.recordingUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="w-full gap-2 text-xs">
                            <PlayCircle className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'مشاهدة التسجيل' : 'Watch Recording'}
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tutoring sessions */}
              {activeTab === 'tutoring' && (
                <div className="space-y-3">
                  {activities?.upcomingTutoring?.length === 0 ? (
                    <div className="text-center py-6">
                      <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">{language === 'ar' ? 'لا توجد جلسات خاصة' : 'No private sessions'}</p>
                    </div>
                  ) : activities?.upcomingTutoring?.map((t: any) => (
                    <div key={t.id} className="border border-border rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold">{t.subject}</p>
                        <StatusBadge status={t.status} language={language} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(t.preferredAt, language)} · {t.durationMinutes} {language === 'ar' ? 'دقيقة' : 'min'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick stats */}
      {activities?.stats && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {language === 'ar' ? 'إحصائيات' : 'Stats'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Video,   value: activities.stats.totalSessions, label: { en: 'Sessions', ar: 'جلسات' } },
              { icon: Users,   value: activities.stats.studentCount,  label: { en: 'Students', ar: 'طلاب' } },
              { icon: Star,    value: activities.stats.avgRating > 0 ? activities.stats.avgRating.toFixed(1) : '—', label: { en: 'Rating', ar: 'التقييم' } },
              { icon: BookOpen,value: activities.stats.reviewCount,   label: { en: 'Reviews', ar: 'تقييمات' } },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label.en} className="text-center p-3 rounded-xl bg-muted/40">
                <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {language === 'ar' ? label.ar : label.en}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TeacherProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const api = useApi();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showEndorse, setShowEndorse] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['/api/teacher-profile', slug],
    queryFn: () => api.get(`/teacher-profile/${slug}`),
    enabled: !!slug,
  });

  const endorseMutation = useMutation({
    mutationFn: (trait: string) => api.post(`/teacher-profile/endorse/${teacher?.id}`, { trait }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-profile', slug] });
      toast({ title: language === 'ar' ? 'تم التوصية بنجاح!' : 'Endorsement submitted!' });
      setShowEndorse(false);
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const handleCopyLink = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleShareFacebook = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'width=600,height=400');

  if (isLoading) {
    return (
      <PageContainer>
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="animate-pulse space-y-6">
            <div className="flex gap-6"><div className="w-28 h-28 rounded-2xl bg-muted" /><div className="flex-1 space-y-3"><div className="h-8 bg-muted rounded w-1/3" /><div className="h-4 bg-muted rounded w-1/2" /></div></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 h-64 bg-muted rounded-2xl" />
              <div className="h-64 bg-muted rounded-2xl" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!teacher) {
    return (
      <PageContainer>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">{language === 'ar' ? 'المعلم غير موجود' : 'Teacher not found'}</h2>
        </div>
      </PageContainer>
    );
  }

  const name = language === 'ar' ? (teacher.fullNameAr || teacher.fullName) : teacher.fullName;

  return (
    <PageContainer>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-primary/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-5xl shrink-0 border-2 border-primary/20 overflow-hidden shadow-lg">
              {teacher.avatarUrl
                ? <img src={teacher.avatarUrl} alt={name} className="w-full h-full object-cover" />
                : name?.charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-3xl font-display font-bold">{name}</h1>
                {teacher.isVerified && <BadgeCheck className="w-6 h-6 text-primary" aria-label="Verified" />}
                {teacher.isSponsored && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {language === 'ar' ? 'مميز' : 'Sponsored'}
                  </span>
                )}
                {teacher.tier === 'pro' && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">PRO</span>
                )}
              </div>
              {teacher.expertise && <p className="text-muted-foreground mb-3">{teacher.expertise}</p>}
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {language === 'ar' ? (teacher.bioAr || teacher.bio) : teacher.bio}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-6 mt-5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <BookOpen className="w-4 h-4" /> {teacher.courseCount} {language === 'ar' ? 'دورات' : 'courses'}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" /> {teacher.studentCount} {language === 'ar' ? 'طلاب' : 'students'}
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Star className="w-4 h-4 fill-amber-500" /> {teacher.rating?.toFixed(1)} ({teacher.reviewCount})
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-8">
            <FollowButton teacherId={teacher.id} />
            {teacher.cvUrl && (
              <a href={teacher.cvUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> {language === 'ar' ? 'تحميل السيرة الذاتية' : 'Download CV'}</Button>
              </a>
            )}
            <Button variant="outline" className="gap-2" onClick={handleCopyLink}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {language === 'ar' ? 'نسخ الرابط' : 'Copy Link'}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleShareFacebook}>
              <Facebook className="w-4 h-4" /> {language === 'ar' ? 'مشاركة' : 'Share'}
            </Button>
            {user && user.role === 'student' && (
              <Button variant="outline" className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setShowEndorse(true)}>
                <Award className="w-4 h-4" /> {language === 'ar' ? 'توصية' : 'Endorse'}
              </Button>
            )}
            {teacher.isTutoringEnabled && (
              <Link href={`/tutoring-listings?teacherId=${teacher.id}`}>
                <Button className="gap-2">
                  <CalendarCheck2 className="w-4 h-4" />
                  {language === 'ar' ? 'احجز جلسة خاصة' : 'Book Private Session'}
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-destructive" onClick={() => setShowReport(true)}>
              <Flag className="w-3.5 h-3.5" /> {language === 'ar' ? 'بلاغ' : 'Report'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body: 2-column layout ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* LEFT: Main content */}
          <div className="lg:col-span-2 space-y-10">

            {/* Community posts */}
            <TeacherPostsSection teacherId={teacher.id} />

            {/* Endorsements */}
            {teacher.endorsements?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  {language === 'ar' ? 'توصيات الطلاب' : 'Student Endorsements'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {teacher.endorsements.map((e: any) => {
                    const trait = ENDORSEMENT_TRAITS.find(t => t.key === e.trait);
                    return (
                      <span key={e.trait} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm font-medium text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                        <Award className="w-3.5 h-3.5" />
                        {language === 'ar' ? (trait?.ar || e.trait) : (trait?.en || e.trait)}
                        <span className="text-xs text-amber-500 font-bold">×{e.count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Student Reviews */}
            {teacher.reviews?.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  {language === 'ar' ? 'مراجعات الطلاب' : 'Student Reviews'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teacher.reviews.map((review: any) => (
                    <div key={review.id} className="p-5 bg-card rounded-2xl border border-border flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 overflow-hidden">
                        {review.user?.avatarUrl
                          ? <img src={review.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          : review.user?.fullName?.charAt(0) || 'S'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-sm">{language === 'ar' ? (review.user?.fullNameAr || review.user?.fullName) : review.user?.fullName}</h4>
                          <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-0.5 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-border fill-muted'}`} />
                          ))}
                        </div>
                        {review.comment && <p className="text-sm text-muted-foreground italic">&ldquo;{review.comment}&rdquo;</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Courses */}
            <div>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                {language === 'ar' ? 'الدورات' : 'Courses'}
              </h2>
              {teacher.courses?.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-2xl border border-border border-dashed">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد دورات بعد' : 'No courses yet'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {teacher.courses?.map((course: any) => (
                    <Link key={course.id} href={`/courses/${course.id}`}>
                      <div className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group cursor-pointer">
                        <div className="aspect-video relative overflow-hidden bg-muted">
                          {course.thumbnailUrl ? (
                            <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                              <PlayCircle className="w-10 h-10 text-primary/40" />
                            </div>
                          )}
                          <div className="absolute top-2 start-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm px-2 py-0.5 rounded-lg text-xs font-bold">{course.level}</div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                            {language === 'ar' ? course.titleAr : course.title}
                          </h3>
                          <div className="text-primary font-bold text-sm">
                            {course.price === 0 ? (language === 'ar' ? 'مجاناً' : 'Free') : `${course.price} LYD`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Activity sidebar */}
          <div className="lg:sticky lg:top-24">
            {slug && <ActivityPanel slug={slug} language={language} />}
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <Dialog open={showEndorse} onOpenChange={setShowEndorse}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'توصية المعلم' : 'Endorse Teacher'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            {language === 'ar' ? `اختر صفة لتوصي بها ${name}` : `Select a trait to endorse ${name} for:`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ENDORSEMENT_TRAITS.map(trait => (
              <Button key={trait.key} variant="outline" size="sm" className="justify-start gap-2 h-auto py-3"
                onClick={() => endorseMutation.mutate(trait.key)} disabled={endorseMutation.isPending}>
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-xs">{language === 'ar' ? trait.ar : trait.en}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'الإبلاغ عن المعلم' : 'Report Teacher'}</DialogTitle>
          </DialogHeader>
          <ReportForm teacherId={teacher.id} teacherName={name} onClose={() => setShowReport(false)} />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// ─── Report Form ───────────────────────────────────────────────────────────────
function ReportForm({ teacherId, teacherName, onClose }: { teacherId: number; teacherName: string; onClose: () => void }) {
  const { language } = useLanguage();
  const api = useApi();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const reasons = [
    { value: 'stolen_identity',       en: 'Stolen Identity (not them)',    ar: 'هوية مسروقة (ليس هو)' },
    { value: 'stolen_material',       en: 'Stolen Material (not their work)', ar: 'محتوى مسروق (ليس عمله)' },
    { value: 'inappropriate_behavior',en: 'Inappropriate Behavior',         ar: 'سلوك غير لائق' },
    { value: 'spam',                  en: 'Spam / Advertising',             ar: 'رسائل غير مرغوبة' },
    { value: 'offensive',             en: 'Offensive Content',              ar: 'محتوى مسيء' },
    { value: 'other',                 en: 'Other',                          ar: 'أخرى' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setLoading(true);
    try {
      await api.post('/reports', { type: 'teacher', reason, description, reportedUserId: teacherId });
      toast({ title: language === 'ar' ? 'تم إرسال البلاغ. شكراً لتعاونك.' : 'Report submitted. Thank you for your feedback.' });
      onClose();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <p className="text-sm">{language === 'ar' ? `أنت تبلغ عن` : 'You are reporting'} <strong>{teacherName}</strong></p>
      <div>
        <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'السبب *' : 'Reason *'}</label>
        <select value={reason} onChange={e => setReason(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" required>
          <option value="">{language === 'ar' ? 'اختر سبباً' : 'Select a reason'}</option>
          {reasons.map(r => <option key={r.value} value={r.value}>{language === 'ar' ? r.ar : r.en}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'الوصف (اختياري)' : 'Description (optional)'}</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder={language === 'ar' ? 'يرجى تقديم مزيد من التفاصيل...' : 'Please provide more details...'}
          rows={3} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        <Button type="submit" variant="destructive" className="flex-1" disabled={loading || !reason}>
          {language === 'ar' ? 'إرسال البلاغ' : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}
