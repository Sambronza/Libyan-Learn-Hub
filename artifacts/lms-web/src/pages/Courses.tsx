import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGetCourses, useGetCategories, type GetCoursesLevel, type GetCoursesLanguage } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, BookOpen, Star, PlayCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { CourseCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

export default function Courses() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [level, setLevel] = useState<GetCoursesLevel | undefined>();
  const [courseLanguage, setCourseLanguage] = useState<GetCoursesLanguage | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: categories } = useGetCategories();
  
  const { data: coursesData, isLoading } = useGetCourses({
    search: search || undefined,
    categoryId,
    level,
    language: courseLanguage,
    limit: 12
  });

  return (
    <PageContainer>
      <div className="bg-primary/5 py-12 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-4xl font-display font-bold text-foreground">{t('courses.explore')}</h1>
            
            {user?.role === 'teacher' && (
              <Link href="/teacher/courses/new">
                <Button className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all duration-200 h-11 px-5 font-semibold rounded-xl w-full sm:w-auto">
                  <Plus className="w-4 h-4" />
                  New Course
                </Button>
              </Link>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mt-8">
            <div className="relative flex-1">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input 
                placeholder={t('courses.search')} 
                className="ps-12 h-14 bg-card rounded-2xl text-lg shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="lg" className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90">
              {t('courses.searchBtn')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col md:flex-row gap-6 sm:gap-8">
        
        {/* Filters Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <button
            className="flex md:hidden items-center gap-2 font-display font-bold text-base mb-3 w-full justify-between px-3 py-2 rounded-xl bg-muted/50 border border-border/50"
            onClick={() => setFiltersOpen(f => !f)}
          >
            <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-primary" />{t('courses.filters')}</span>
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className={`space-y-8 ${filtersOpen ? 'block' : 'hidden'} md:block`}>
            <div className="flex items-center gap-2 font-display font-bold text-lg mb-4">
              <Filter className="w-5 h-5 text-primary" /> {t('courses.filters')}
            </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t('courses.category')}</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setCategoryId(undefined)}
                className={`text-sm w-full text-start px-3 py-2 rounded-lg transition-colors ${!categoryId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
              >
                {t('courses.allCategories')}
              </button>
              {categories?.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`text-sm w-full text-start px-3 py-2 rounded-lg transition-colors ${categoryId === cat.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                >
                  {language === 'ar' ? cat.nameAr : cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t('courses.level')}</h3>
            <div className="space-y-2">
              {['beginner', 'intermediate', 'advanced'].map((lvl) => (
                <label key={lvl} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted rounded-lg">
                  <input 
                    type="radio" 
                    name="level" 
                    className="accent-primary w-4 h-4"
                    checked={level === lvl}
                    onChange={() => setLevel(lvl as GetCoursesLevel)}
                    onClick={(e) => {
                      // Allow unchecking by clicking checked radio
                      if (level === lvl) {
                        e.preventDefault();
                        setLevel(undefined);
                      }
                    }}
                  />
                  <span className="text-sm capitalize">{t(`courses.${lvl}`)}</span>
                </label>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => <CourseCardSkeleton key={i} />)}
            </div>
          ) : coursesData?.courses.length === 0 ? (
            <EmptyState 
              title={t('courses.noCourses')}
              description={t('courses.adjustFilters')}
              icon={BookOpen}
              actionLabel={t('courses.clearFilters')}
              onAction={() => { setSearch(''); setCategoryId(undefined); setLevel(undefined); }}
            />
          ) : (
            <>
              <div className="mb-4 sm:mb-6 text-sm text-muted-foreground">
                {t('courses.showingResults', { count: String(coursesData?.courses.length || 0), total: String(coursesData?.total || 0) })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {coursesData?.courses.map((course) => (
                  <Link key={course.id} href={`/courses/${course.id}`}>
                    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 group flex flex-col h-full relative cursor-pointer">

                      {/* Image Thumbnail (16:9) */}
                      <div className="aspect-video relative overflow-hidden bg-muted">
                        {course.thumbnailUrl ? (
                          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 via-violet-500/20 to-fuchsia-500/20 relative">
                            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
                            <div className="w-14 h-14 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <PlayCircle className="w-8 h-8 text-primary" />
                            </div>
                          </div>
                        )}

                        <div className="absolute top-3 start-3">
                          <div className="bg-background/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-foreground shadow-sm uppercase tracking-wider">
                            {course.level}
                          </div>
                        </div>
                        <div className="absolute top-3 end-3">
                          <div className="bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
                            {course.price === 0 ? t('course.free') : `${course.price} LYD`}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="relative pt-8 px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col flex-1 bg-gradient-to-b from-card to-card/50">
                        {/* Avatar */}
                        <div className="absolute -top-7 end-4 sm:end-5 w-14 h-14 rounded-full border-4 border-card bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center shadow-md overflow-hidden z-10 group-hover:scale-110 transition-transform duration-300">
                          {course.teacherAvatar ? (
                            <img src={course.teacherAvatar} alt={course.teacherName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-bold text-lg">{course.teacherName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>

                        <div className="text-xs font-medium text-muted-foreground mb-1 truncate pe-14">
                          by {course.teacherName}
                        </div>

                        <h3 className="font-display font-bold text-base sm:text-lg mb-3 line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-snug">
                          {language === 'ar' ? course.titleAr : course.title}
                        </h3>

                        <div className="mt-auto flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-muted/50 border border-border/50 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                            <BookOpen className="w-3 h-3 text-primary/70" />
                            {course.lessonCount} {t('courses.lessons')}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-muted/50 border border-border/50 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                            <span>{Math.round(course.totalDuration / 60)}h</span>
                          </div>
                          {Number((course as any).rating) > 0 && (
                            <div className="flex items-center gap-1 bg-warning/10 border border-amber-500/20 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold text-warning">
                              <Star className="w-3 h-3 fill-amber-500" />
                              {Number((course as any).rating).toFixed(1)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
