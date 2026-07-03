import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGetCourses, useGetCategories } from '@workspace/api-client-react';
import { BookOpen, Star, ArrowRight, ArrowLeft, PlayCircle, Zap, TrendingUp, ChevronRight, GraduationCap, Sparkles, CheckCircle2, MonitorPlay, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';
import { useApi } from '@/hooks/useApi';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { Blob } from '@/components/ui/Blob';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' as const, delay },
});

export default function Home() {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  const { data: coursesData, isLoading: loadingCourses } = useGetCourses({ limit: 6 });
  const { data: categoriesData } = useGetCategories();
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  useSEO({
    title: t('home.hero.title'),
    description: t('home.hero.subtitle'),
    schema: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Libyan Learn Hub",
      "url": "https://libyan-learn-hub.com",
    }
  });

  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const api = useApi();

  const { data: activeAds } = useQuery({
    queryKey: ['/api/advertisements/active'],
    queryFn: () => api.get('/advertisements/active')
  });

  const bannerAds = activeAds?.filter((ad: any) => ad.adType === 'banner') || [];


  return (
    <PageContainer>

      {/* ─── HERO ───────────────────────────────────────────── */}
      <section className="relative flex items-center overflow-hidden py-16 sm:py-20 lg:min-h-[92vh] lg:py-0">

        {/* Animated mesh background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <Blob color="bg-primary/20" size="w-[500px] h-[500px]" className="-top-24 -start-24" duration={25} />
          <Blob color="bg-cyan-500/15" size="w-[400px] h-[400px]" className="top-1/2 -end-24" delay={2} duration={30} />
          <Blob color="bg-violet-500/10" size="w-[600px] h-[600px]" className="-bottom-24 left-1/3" delay={5} duration={35} />
          
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(124,58,237,0.08),transparent)]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left — Text */}
            <div className={`${isRtl ? 'lg:order-2 text-right' : ''}`}>
              <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
                <Zap className="w-3.5 h-3.5" />
                {isRtl ? 'منصة رقم ١ للتعلم في ليبيا' : 'The #1 E-Learning Platform in Libya'}
              </motion.div>

              <motion.h1 {...fadeUp(0.1)} className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-display font-extrabold leading-[1.1] text-foreground mb-6">
                {isRtl ? (
                  <>
                    تعلّم من<br />
                    <span className="relative inline-block">
                      <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-500 to-primary/70">أفضل الخبراء</span>
                      <span className="absolute inset-x-0 bottom-1 h-3 bg-primary/10 rounded-sm" />
                    </span><br />في ليبيا
                  </>
                ) : (
                  <>
                    Learn From<br />
                    <span className="relative inline-block">
                      <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-500 to-primary/70">Libya's Best</span>
                      <span className="absolute inset-x-0 bottom-1 h-3 bg-primary/10 rounded-sm" />
                    </span><br />Instructors
                  </>
                )}
              </motion.h1>

              <motion.p {...fadeUp(0.2)} className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">
                {t('home.hero.subtitle')}
              </motion.p>

              <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row gap-4">
                <Link href="/courses" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/30 gap-2 flex items-center justify-center">
                    {isRtl ? 'استكشف الدورات' : 'Explore Courses'}
                    <Arrow className="w-5 h-5 shrink-0" />
                  </Button>
                </Link>
                <Link href="/register" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base font-medium rounded-2xl border-2 gap-2 hover:bg-primary/5 flex items-center justify-center">
                    {isRtl ? 'تعلّم / علّم معنا' : 'Learn/Teach With Us'}
                  </Button>
                </Link>
              </motion.div>

              {/* Dual-path cards */}
              <motion.div {...fadeUp(0.4)} className="flex flex-col sm:flex-row gap-4 mt-10">
                <Link href="/courses" className="flex-1">
                  <div className="group relative overflow-hidden bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-xl transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                        <BookOpen className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
                      </div>
                      <div className={isRtl ? 'text-right' : ''}>
                        <h3 className="font-display font-bold text-foreground">
                          {isRtl ? '📚 الدورات' : '📚 Courses'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isRtl ? 'تعلّم بالوتيرة المناسبة لك' : 'Learn at your own pace'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
                <Link href="/academy" className="flex-1">
                  <div className="group relative overflow-hidden bg-card/80 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-5 cursor-pointer hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 end-2 px-2 py-0.5 text-[9px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      {isRtl ? 'قريباً' : 'COMING SOON'}
                    </div>
                    <div className="relative flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-orange-500 transition-all">
                        <GraduationCap className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className={isRtl ? 'text-right' : ''}>
                        <h3 className="font-display font-bold text-foreground">
                          {isRtl ? '🎓 الأكاديمية' : '🎓 Academy'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isRtl ? 'احصل على شهادتك من المنزل' : 'Earn your diploma from home'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>

            </div>

            {/* Right — Floating card panel */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className={`relative hidden lg:block ${isRtl ? 'lg:order-1' : ''}`}
            >
              {/* Main card */}
              <div className="relative rounded-[2.5rem] overflow-hidden border border-border/60 bg-card shadow-2xl">
                <div className="h-64 bg-gradient-to-br from-primary via-violet-600 to-cyan-500 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="w-20 h-20 text-white/30" strokeWidth={1} />
                  </div>
                  <div className="absolute bottom-4 start-4 end-4 flex items-center gap-3 bg-black/30 backdrop-blur-md rounded-2xl p-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-white">
                      <div className="font-bold text-sm">{isRtl ? 'مقدمة في الرياضيات' : 'Introduction To Mathematics'}</div>
                      <div className="text-xs text-white/70">12 {isRtl ? 'درس' : 'lessons'} · 4h</div>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-muted-foreground">{isRtl ? 'تقدمك' : 'Your Progress'}</div>
                    <div className="text-sm font-bold text-primary">62%</div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-[62%] bg-gradient-to-r from-primary to-cyan-500 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Floating pill – top right */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-6 -end-6 bg-card border border-border/60 rounded-2xl p-4 shadow-xl flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
                </div>
                <div>
                  <div className="font-bold text-sm">4.9/5</div>
                  <div className="text-xs text-muted-foreground">Top Rated</div>
                </div>
              </motion.div>

              {/* Floating pill – bottom left */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -bottom-6 -start-6 bg-card border border-border/60 rounded-2xl p-4 shadow-xl flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-green-400/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="font-bold text-sm">{isRtl ? 'طالب جديد' : 'New Student'}</div>
                  <div className="text-xs text-muted-foreground">{isRtl ? 'انضم للتو!' : 'Just enrolled!'}</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── CATEGORIES ─────────────────────────────────────── */}
      <section className="py-12 sm:py-16 lg:py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className={`mb-12 ${isRtl ? 'text-right' : ''}`}>
            <p className="text-primary font-semibold mb-2 text-sm uppercase tracking-widest">{isRtl ? 'استكشف' : 'Explore'}</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-foreground">{isRtl ? 'تصفح حسب التخصص' : 'Browse by Subject'}</h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {categories?.map((cat, i) => {
              // Icon mapping based on category name
              const iconMap: Record<string, React.ReactNode> = {
                'Mathematics': <Zap className="w-6 h-6" />,
                'الرياضيات': <Zap className="w-6 h-6" />,
                'Sciences': <Sparkles className="w-6 h-6" />,
                'العلوم': <Sparkles className="w-6 h-6" />,
                'Physics': <TrendingUp className="w-6 h-6" />,
                'الفيزياء': <TrendingUp className="w-6 h-6" />,
                'Computer Science': <MonitorPlay className="w-6 h-6" />,
                'علوم الحاسوب': <MonitorPlay className="w-6 h-6" />,
                'Arabic Language': <BookOpen className="w-6 h-6" />,
                'اللغة العربية': <BookOpen className="w-6 h-6" />,
                'English Language': <Globe className="w-6 h-6" />,
                'اللغة الإنجليزية': <Globe className="w-6 h-6" />,
              };
              
              const categoryIcon = iconMap[cat.name] || iconMap[cat.nameAr] || <BookOpen className="w-6 h-6" />;

              return (
                <motion.div 
                  key={cat.id} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                >
                  <Link href={`/courses?categoryId=${cat.id}`}>
                    <div className="group relative overflow-hidden border border-border/50 bg-card rounded-3xl p-6 cursor-pointer hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 text-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/15 group-hover:from-primary group-hover:to-secondary mx-auto mb-4 flex items-center justify-center transition-all duration-500">
                          <div className="text-primary group-hover:text-white transition-colors duration-300">
                            {categoryIcon}
                          </div>
                        </div>
                        <h3 className="font-display font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-tight">
                          {language === 'ar' ? cat.nameAr : cat.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">{cat.courseCount} {isRtl ? 'دورة' : 'Courses'}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── ACADEMY PROMO ───────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            {...fadeUp()}
            className="relative overflow-hidden rounded-[2rem] lg:rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-rose-50/30 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/10 p-6 sm:p-8 lg:p-14"
          >
            <div className="absolute top-4 end-4 lg:top-8 lg:end-8">
              <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
                <Sparkles className="w-3 h-3 inline mr-1" />
                {isRtl ? 'قريباً' : 'COMING SOON'}
              </span>
            </div>
            
            <div className={`max-w-2xl ${isRtl ? 'text-right' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-4xl font-display font-extrabold text-foreground">
                  {isRtl ? 'أكاديمية EduLibya' : 'EduLibya Academy'}
                </h2>
              </div>
              
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                {isRtl
                  ? 'أول أكاديمية إلكترونية ليبية لتعليم المرحلة الأساسية والثانوية. تعلّم من المنزل واحصل على شهادة معتمدة.'
                  : 'The first Libyan online academy for primary and secondary education. Learn from home and earn a certified diploma.'
                }
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { text: isRtl ? 'الصفوف ١-١٢' : 'Grades 1-12' },
                  { text: isRtl ? 'شهادة معتمدة' : 'Certified Diploma' },
                  { text: isRtl ? 'منهج ليبي' : 'Libyan Curriculum' },
                  { text: isRtl ? 'كادر متميز' : 'Expert Faculty' },
                ].map(({ text }) => (
                  <div key={text} className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                    {text}
                  </div>
                ))}
              </div>

              <Link href="/academy">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 gap-2">
                  {isRtl ? 'اعرف المزيد' : 'Learn More'}
                  <Arrow className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── SPONSORED INSTRUCTORS ──────────────────────────── */}
      {bannerAds.length > 0 && (
        <section className="py-12 bg-primary/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`mb-8 flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex flex-shrink-0 items-center justify-center">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">
                {isRtl ? 'معلمون مميزون' : 'Featured Instructors'}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {bannerAds.map((ad: any, i: number) => (
                <Link key={ad.id} href={`/teachers/${ad.teacherSlug}`}>
                  <motion.div 
                    {...fadeUp(i * 0.1)}
                    className="bg-card border border-amber-200/50 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden relative">
                      {ad.teacherAvatar ? (
                        <img src={ad.teacherAvatar} alt={ad.teacherName} className="w-full h-full object-cover" />
                      ) : (
                        ad.teacherName.charAt(0)
                      )}
                      <div className="absolute inset-0 ring-2 ring-amber-400 rounded-full" />
                    </div>
                    <div className={isRtl ? 'text-right' : ''}>
                      <div className="font-bold text-sm text-foreground line-clamp-1">
                        {language === 'ar' ? (ad.teacherNameAr || ad.teacherName) : ad.teacherName}
                      </div>
                      <div className="text-xs text-amber-600 font-medium bg-amber-100/50 inline-block px-2 py-0.5 rounded-full mt-1">
                        {isRtl ? 'إعلان' : 'Sponsored'}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── FEATURED COURSES ───────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className={`flex justify-between items-end mb-12 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={isRtl ? 'text-right' : ''}>
              <p className="text-primary font-semibold mb-2 text-sm uppercase tracking-widest">{isRtl ? 'مميز' : 'Featured'}</p>
              <h2 className="text-4xl font-display font-bold text-foreground">{t('home.featured')}</h2>
            </div>
            <Link href="/courses" className="flex items-center gap-2 text-sm text-primary font-medium group hover:gap-3 transition-all">
              {isRtl ? 'عرض الكل' : 'View All'}
              <Arrow className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {loadingCourses ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-96 bg-card rounded-3xl animate-pulse border border-border/50" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {coursesData?.courses.map((course, i) => (
                <motion.div key={course.id} {...fadeUp(i * 0.1)}>
                  <Link href={`/courses/${course.id}`}>
                    <div className="group h-full flex flex-col border border-border/50 bg-card rounded-3xl overflow-hidden hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-2">
                      {/* Thumbnail */}
                      <div className="relative h-52 bg-muted overflow-hidden">
                        {course.thumbnailUrl ? (
                          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-violet-500/10 to-secondary/20 flex items-center justify-center">
                            <PlayCircle className="w-16 h-16 text-primary/30 group-hover:text-primary/60 group-hover:scale-110 transition-all duration-500" />
                          </div>
                        )}
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        {/* Level badge */}
                        <div className="absolute top-4 start-4 px-3 py-1 rounded-full text-xs font-bold bg-background/80 backdrop-blur-sm text-foreground border border-border/50">
                          {course.level}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex flex-col flex-1 gap-3">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1.5 font-medium">
                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                            {course.lessonCount} {isRtl ? 'درس' : 'Lessons'}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>{Math.round(course.totalDuration / 60)}h</span>
                          {(course as any).rating > 0 && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-border" />
                              <span className="flex items-center gap-1 text-amber-600 font-bold">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                {Number((course as any).rating).toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className={`font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight flex-1 ${isRtl ? 'text-right' : ''}`}>
                          {language === 'ar' ? course.titleAr : course.title}
                        </h3>

                        <p className={`text-sm text-muted-foreground line-clamp-2 leading-relaxed ${isRtl ? 'text-right' : ''}`}>
                          {language === 'ar' ? course.descriptionAr : course.description}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {course.teacherName.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-foreground truncate max-w-[100px]">{course.teacherName}</span>
                          </div>
                          <div className="flex items-center gap-1 text-primary font-bold">
                            {course.price === 0 ? (
                              <span className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-sm font-bold">{t('course.free')}</span>
                            ) : (
                              <span className="text-lg">{t('course.price', { price: course.price.toString() })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── CTA BANNER ─────────────────────────────────────── */}
      <section className="py-12 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            {...fadeUp()}
            className="relative overflow-hidden rounded-[2rem] lg:rounded-[3rem] bg-gradient-to-br from-primary via-violet-600 to-cyan-500 p-8 sm:p-10 lg:p-12 text-center text-white"
          >
            {/* Background noise texture */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            <div className="absolute top-0 start-0 w-72 h-72 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <div className="absolute bottom-0 end-0 w-72 h-72 bg-cyan-400/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

            <div className="relative">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-display font-extrabold mb-4">
                {isRtl ? 'جاهز لتبدأ رحلتك؟' : 'Ready to Start Learning?'}
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                {isRtl ? 'انضم إلى آلاف الطلاب الليبيين الذين يتعلمون من أفضل المعلمين في البلاد.' : 'Join thousands of Libyan students learning from the best instructors in the country.'}
              </p>
              <Link href="/register">
                <Button size="lg" className="h-14 px-10 text-base font-bold rounded-2xl bg-white text-primary hover:bg-white/90 shadow-2xl gap-2">
                  {isRtl ? 'ابدأ مجاناً الآن' : 'Get Started For Free'}
                  <Arrow className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

    </PageContainer>
  );
}
