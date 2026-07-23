import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useApi } from '@/hooks/useApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, BadgeCheck, Search, User, Crown, Star, ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { motion } from 'framer-motion';

export default function Teachers() {
  const api = useApi();
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [tutorOnly, setTutorOnly] = useState(false);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['/api/teachers'],
    queryFn: () => api.get('/teachers'),
  });

  const filtered = (teachers || []).filter((t: any) =>
    (!search || t.fullName?.toLowerCase().includes(search.toLowerCase()) || t.fullNameAr?.includes(search) || t.expertise?.toLowerCase().includes(search.toLowerCase())) &&
    (!tutorOnly || t.isTutoringEnabled)
  );

  return (
    <PageContainer>
      {/* Hero header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-12 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-display font-bold mb-3">{language === 'ar' ? 'نخبة المعلمين' : 'Our Teachers'}</h1>
          <p className="text-muted-foreground text-lg max-w-xl">{language === 'ar' ? 'معلمون ليبيون مؤهلون لتعليمك' : 'Qualified Libyan educators ready to teach you'}</p>
          <div className="flex gap-3 mt-6 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن معلم أو مادة...' : 'Search by name or subject...'}
                className="pl-9"
              />
            </div>
            <Button
              variant={tutorOnly ? "default" : "outline"}
              onClick={() => setTutorOnly(!tutorOnly)}
              className={`gap-2 ${tutorOnly ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'border-primary/30 text-primary hover:bg-primary/10 dark:hover:bg-violet-950'}`}
            >
              {language === 'ar' ? 'دروس خصوصية فقط' : '1-on-1 Tutors Only'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border animate-pulse">
                <div className="h-48 bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={language === 'ar' ? 'لا يوجد معلمين' : 'No teachers found'}
            description={language === 'ar' ? 'جرب تغيير معايير البحث' : 'Try adjusting your search criteria'}
            icon={User}
            actionLabel={language === 'ar' ? 'مسح البحث' : 'Clear Search'}
            onAction={() => { setSearch(''); setTutorOnly(false); }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
            {filtered.map((teacher: any, idx: number) => {
              const displayName = language === 'ar' ? (teacher.fullNameAr || teacher.fullName) : teacher.fullName;
              const isFeatured = !!teacher.isSponsored;
              const isNew = !teacher.rating && !teacher.studentCount && !teacher.courseCount;
              const specialty = teacher.expertise
                || (teacher.isTutoringEnabled
                  ? (language === 'ar' ? 'مدرّس خصوصي' : '1-on-1 Tutor')
                  : (language === 'ar' ? 'معلم' : 'Educator'));
              const bioText = language === 'ar' ? (teacher.bioAr || teacher.bio) : (teacher.bio || teacher.bioAr);
              return (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.4) }}
                  className="h-full"
                >
                  <Link href={`/teachers/${teacher.profileSlug || teacher.id}`} className="block h-full">
                    {/* ── Premium glass card — gradient hairline border ── */}
                    <div className={`group relative h-full rounded-2xl p-px cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/20 bg-gradient-to-br ${isFeatured ? 'from-amber-400/50 via-fuchsia-500/25 to-transparent' : 'from-primary/40 via-border to-transparent'}`}>
                      <div className="relative flex h-full flex-col overflow-hidden rounded-[15px] bg-card">

                        {/* Hover glow */}
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(220px_120px_at_50%_-10%,rgba(139,92,255,0.28),transparent)]" />

                        {/* Aurora band */}
                        <div className={`relative h-16 overflow-hidden bg-gradient-to-br ${isFeatured ? 'from-amber-400/30 via-fuchsia-500/20 to-primary/10' : 'from-primary/30 via-fuchsia-500/15 to-primary/5'}`}>
                          <div className="absolute inset-0 bg-[radial-gradient(120px_80px_at_18%_130%,rgba(255,255,255,0.28),transparent),radial-gradient(150px_90px_at_88%_-25%,rgba(255,255,255,0.16),transparent)]" />
                        </div>

                        {/* Top badges */}
                        <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5">
                          {isFeatured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow">
                              <Crown className="h-2.5 w-2.5" /> {language === 'ar' ? 'مميز' : 'Featured'}
                            </span>
                          )}
                          {teacher.tier === 'pro' && (
                            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">PRO</span>
                          )}
                        </div>
                        {teacher.isTutoringEnabled && (
                          <span className="absolute right-3 top-3 z-20 rounded-full border border-white/15 bg-background/50 px-2 py-0.5 text-[10px] font-bold text-foreground backdrop-blur-sm">
                            {language === 'ar' ? 'دروس خصوصية' : 'Tutoring'}
                          </span>
                        )}

                        {/* Body */}
                        <div className="flex flex-1 flex-col px-4 pb-4">
                          {/* Avatar — gradient ring */}
                          <div className="relative z-10 -mt-9 h-[72px] w-[72px] rounded-full bg-gradient-to-br from-primary to-fuchsia-500 p-[3px] shadow-lg shadow-primary/30">
                            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-card bg-muted">
                              {teacher.avatarUrl ? (
                                <img
                                  src={teacher.avatarUrl}
                                  alt={displayName}
                                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <span className="select-none text-2xl font-black text-primary">{displayName?.charAt(0)}</span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-1.5">
                            <h3 className="truncate font-display text-base font-bold text-foreground transition-colors group-hover:text-primary">
                              {displayName}
                            </h3>
                            {teacher.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{specialty}</p>

                          {/* Bio or new-teacher pill — reserved height keeps cards aligned */}
                          <div className="mt-2.5 min-h-[2.5rem]">
                            {isNew ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-950">
                                {language === 'ar' ? 'معلم جديد' : 'New teacher'}
                              </span>
                            ) : bioText ? (
                              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{bioText}</p>
                            ) : null}
                          </div>

                          <div className="flex-1" />

                          {/* Footer — stats */}
                          <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5" />
                              {teacher.courseCount || 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {teacher.studentCount || 0}
                            </span>
                            {teacher.rating > 0 ? (
                              <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2 py-0.5 font-semibold text-amber-950">
                                <Star className="h-3 w-3 fill-current" />
                                {teacher.rating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="ms-auto inline-flex items-center gap-1 font-semibold text-primary transition-all group-hover:gap-2">
                                {language === 'ar' ? 'الملف الشخصي' : 'View profile'}
                                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
