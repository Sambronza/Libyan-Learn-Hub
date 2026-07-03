import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGetCourses, useGetCategories, type GetCoursesLevel, type GetCoursesLanguage } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, BookOpen, Star, PlayCircle, ChevronDown, X } from 'lucide-react';
import { CourseCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';

export default function Courses() {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
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

  const activeFilterCount = [categoryId, level, courseLanguage].filter(Boolean).length;

  const FiltersContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <Filter className="w-5 h-5 text-primary" /> {t('courses.filters')}
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground font-bold">{activeFilterCount}</span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setCategoryId(undefined); setLevel(undefined); setCourseLanguage(undefined); }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            {isRtl ? 'مسح الكل' : 'Clear all'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t('courses.category')}</h3>
        <div className="space-y-1">
          <button 
            onClick={() => setCategoryId(undefined)}
            className={`text-sm w-full text-start px-3 py-2 rounded-lg transition-colors ${!categoryId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
          >
            {t('courses.allCategories')}
          </button>
          {categories?.map(cat => (
            <button 
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setFiltersOpen(false); }}
              className={`text-sm w-full text-start px-3 py-2 rounded-lg transition-colors ${categoryId === cat.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
            >
              {language === 'ar' ? cat.nameAr : cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t('courses.level')}</h3>
        <div className="space-y-1">
          {['beginner', 'intermediate', 'advanced'].map((lvl) => (
            <label key={lvl} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted rounded-lg">
              <input 
                type="radio" 
                name="level" 
                className="accent-primary w-4 h-4"
                checked={level === lvl}
                onChange={() => setLevel(lvl as GetCoursesLevel)}
                onClick={(e) => {
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
  );

  return (
    <PageContainer>
      {/* Search Header */}
      <div className="bg-primary/5 py-10 sm:py-12 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            {t('courses.explore')}
          </h1>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <div className="relative flex-1">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input 
                placeholder={t('courses.search')} 
                className="ps-12 h-12 sm:h-14 bg-card rounded-2xl text-base sm:text-lg shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="lg" className="h-12 sm:h-14 px-6 rounded-2xl bg-primary hover:bg-primary/90 shrink-0">
              {t('courses.searchBtn')}
            </Button>
          </div>

          {/* Mobile filter toggle */}
          <button
            className="md:hidden mt-4 flex items-center gap-2 text-sm font-medium text-foreground bg-card border border-border px-4 py-2.5 rounded-xl hover:bg-muted transition-colors"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Filter className="w-4 h-4 text-primary" />
            {isRtl ? 'تصفية النتائج' : 'Filter Results'}
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground font-bold">{activeFilterCount}</span>
            )}
            <ChevronDown className={`w-4 h-4 ms-auto transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-card border-b border-border"
          >
            <div className="max-w-7xl mx-auto px-4 py-6">
              <FiltersContent />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col md:flex-row gap-8">
        
        {/* Desktop Filters Sidebar */}
        <div className="hidden md:block w-64 shrink-0">
          <div className="sticky top-24">
            <FiltersContent />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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
                    <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/60 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full relative cursor-pointer">
                      
                      {/* Image Thumbnail */}
                      <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                        {course.thumbnailUrl ? (
                          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-violet-500/10">
                            <PlayCircle className="w-12 h-12 text-primary/30" />
                          </div>
                        )}
                        
                        <div className="absolute top-3 start-3 sm:top-4 sm:start-4">
                          <div className="bg-background/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-foreground shadow-sm uppercase tracking-wider">
                            {course.level}
                          </div>
                        </div>
                        <div className="absolute top-3 end-3 sm:top-4 sm:end-4">
                          <div className="bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
                            {course.price === 0 ? t('course.free') : `${course.price} LYD`}
                          </div>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="relative pt-7 px-4 sm:px-6 pb-5 sm:pb-6 flex flex-col flex-1 bg-gradient-to-b from-card to-card/50">
                        {/* Avatar */}
                        <div className="absolute -top-5 end-4 sm:end-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-card bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center shadow-sm overflow-hidden z-10 group-hover:scale-110 transition-transform duration-300">
                          {course.teacherAvatar ? (
                            <img src={course.teacherAvatar} alt={course.teacherName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-bold text-base sm:text-lg">{course.teacherName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        
                        <div className="text-xs font-medium text-muted-foreground mb-1 truncate pe-10 sm:pe-12">
                          by {course.teacherName}
                        </div>

                        <h3 className="font-display font-bold text-base sm:text-lg mb-3 sm:mb-4 line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-snug">
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
                            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold text-amber-600">
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
