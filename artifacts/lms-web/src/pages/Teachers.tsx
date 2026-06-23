import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useApi } from '@/hooks/useApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, BadgeCheck, Search, User, Crown, Star } from 'lucide-react';
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
              className={`gap-2 ${tutorOnly ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950'}`}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((teacher: any, idx: number) => (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <Link href={`/teachers/${teacher.profileSlug || teacher.id}`}>
                  {/* ── Cinematic Hero Card ── */}
                  <div className="group relative rounded-2xl overflow-hidden border border-border bg-card cursor-pointer shadow-sm hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300">

                    {/* Top badges — absolutely positioned over the image */}
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 flex-wrap">
                      {teacher.isSponsored && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/90 text-white backdrop-blur-sm shadow">
                          <Crown className="w-2.5 h-2.5" /> {language === 'ar' ? 'مميز' : 'Sponsored'}
                        </span>
                      )}
                      {teacher.tier === 'pro' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600/90 text-white backdrop-blur-sm shadow">
                          PRO
                        </span>
                      )}
                    </div>

                    {/* Tutoring badge — top right */}
                    {teacher.isTutoringEnabled && (
                      <div className="absolute top-3 right-3 z-20">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600/90 text-white backdrop-blur-sm shadow">
                          {language === 'ar' ? 'دروس خصوصية' : 'Tutoring'}
                        </span>
                      </div>
                    )}

                    {/* Cinematic image area */}
                    <div className="relative h-48 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 overflow-hidden">
                      {teacher.avatarUrl ? (
                        <img
                          src={teacher.avatarUrl}
                          alt={teacher.fullName}
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        /* Fallback: initials on gradient bg */
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-primary font-black text-4xl select-none">
                            {(language === 'ar' ? (teacher.fullNameAr || teacher.fullName) : teacher.fullName)?.charAt(0)}
                          </div>
                        </div>
                      )}

                      {/* Gradient overlay fading image into card background */}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent pointer-events-none" />

                      {/* Name + expertise overlaid on the lower gradient */}
                      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 z-10">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                            {language === 'ar' ? (teacher.fullNameAr || teacher.fullName) : teacher.fullName}
                          </h3>
                          {teacher.isVerified && (
                            <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </div>
                        {teacher.expertise && (
                          <p className="text-xs text-muted-foreground truncate">{teacher.expertise}</p>
                        )}
                      </div>
                    </div>

                    {/* Card body — bio */}
                    {(teacher.bio || teacher.bioAr) && (
                      <div className="px-4 pt-3">
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {language === 'ar' ? (teacher.bioAr || teacher.bio) : teacher.bio}
                        </p>
                      </div>
                    )}

                    {/* Card footer — stats */}
                    <div className="flex items-center gap-3 px-4 py-3 mt-auto border-t border-border/60 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {teacher.courseCount || 0} {language === 'ar' ? 'دورات' : 'courses'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {teacher.studentCount || 0} {language === 'ar' ? 'طلاب' : 'students'}
                      </span>
                      {(teacher.rating > 0) && (
                        <span className="flex items-center gap-1 ms-auto text-amber-500 font-semibold">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          {teacher.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
