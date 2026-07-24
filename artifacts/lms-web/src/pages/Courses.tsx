import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGetCourses, useGetCategories } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, BookOpen, Star, PlayCircle, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { CourseCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

// Emoji + color tag per category (matched by English name, case-insensitive)
const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  mathematics: { icon: '🧮', color: 'text-blue-400' },
  sciences: { icon: '🔬', color: 'text-emerald-400' },
  science: { icon: '🔬', color: 'text-emerald-400' },
  'arabic language': { icon: '📖', color: 'text-amber-400' },
  'english language': { icon: '🔤', color: 'text-indigo-400' },
  history: { icon: '📜', color: 'text-orange-400' },
  physics: { icon: '⚛️', color: 'text-cyan-400' },
  chemistry: { icon: '🧪', color: 'text-pink-400' },
  biology: { icon: '🧬', color: 'text-green-400' },
  'computer science': { icon: '💻', color: 'text-violet-400' },
  'islamic studies': { icon: '🕌', color: 'text-teal-400' },
};
const categoryMeta = (name: string) => CATEGORY_META[name?.toLowerCase()] || { icon: '🎓', color: 'text-primary' };

const LEVEL_META: Record<string, { icon: string }> = {
  beginner: { icon: '🌱' },
  intermediate: { icon: '🌿' },
  advanced: { icon: '🌳' },
};

// Collapsible filter section
function FilterPanel({ title, icon, count, children }: { title: string; icon?: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border/60 rounded-xl bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-foreground">
          {icon && <span>{icon}</span>}{title}
          {count ? <span className="text-[10px] font-bold bg-primary/15 text-primary rounded-full px-1.5 py-0.5">{count}</span> : null}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-1 space-y-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Courses() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [price, setPrice] = useState<'free' | 'paid' | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: categories } = useGetCategories();

  const toggle = <T,>(list: T[], value: T, setter: (v: T[]) => void) =>
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  const clearAll = () => { setCategoryIds([]); setLevels([]); setLanguages([]); setPrice(undefined); setSearch(''); };
  const activeCount = categoryIds.length + levels.length + languages.length + (price ? 1 : 0);

  // Dynamic filtering — react-query refetches whenever any filter changes.
  const { data: coursesData, isLoading } = useGetCourses({
    search: search || undefined,
    categoryId: categoryIds.length ? categoryIds.join(',') : undefined,
    level: levels.length ? levels.join(',') : undefined,
    language: languages.length ? languages.join(',') : undefined,
    price,
    limit: 12,
  } as any);

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
        <div className="w-full md:w-72 shrink-0">
          <button
            className="flex md:hidden items-center gap-2 font-display font-bold text-base mb-3 w-full justify-between px-3 py-2 rounded-xl bg-muted/50 border border-border/50"
            onClick={() => setFiltersOpen(f => !f)}
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />{t('courses.filters')}
              {activeCount > 0 && <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{activeCount}</span>}
            </span>
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div className={`space-y-3 ${filtersOpen ? 'block' : 'hidden'} md:block md:sticky md:top-24`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 font-display font-bold text-lg">
                <Filter className="w-5 h-5 text-primary" /> {t('courses.filters')}
              </div>
              {activeCount > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> {t('courses.clearAll')}
                </button>
              )}
            </div>

            {/* Category */}
            <FilterPanel title={t('courses.category')} icon="🗂️" count={categoryIds.length}>
              {categories?.map(cat => {
                const meta = categoryMeta(cat.name);
                const checked = categoryIds.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-lg transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4 shrink-0"
                      checked={checked}
                      onChange={() => toggle(categoryIds, cat.id, setCategoryIds)}
                    />
                    <span className="text-base leading-none">{meta.icon}</span>
                    <span className={`text-sm ${checked ? 'font-semibold text-primary' : 'text-foreground'}`}>
                      {language === 'ar' ? cat.nameAr : cat.name}
                    </span>
                  </label>
                );
              })}
            </FilterPanel>

            {/* Level */}
            <FilterPanel title={t('courses.level')} icon="📊" count={levels.length}>
              {['beginner', 'intermediate', 'advanced'].map((lvl) => {
                const checked = levels.includes(lvl);
                return (
                  <label
                    key={lvl}
                    className={`flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-lg transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4 shrink-0"
                      checked={checked}
                      onChange={() => toggle(levels, lvl, setLevels)}
                    />
                    <span className="text-base leading-none">{LEVEL_META[lvl].icon}</span>
                    <span className={`text-sm capitalize ${checked ? 'font-semibold text-primary' : 'text-foreground'}`}>{t(`courses.${lvl}`)}</span>
                  </label>
                );
              })}
            </FilterPanel>

            {/* Price */}
            <FilterPanel title={t('courses.price')} icon="💰" count={price ? 1 : 0}>
              {[
                { value: 'free' as const, label: t('course.free'), icon: '🆓' },
                { value: 'paid' as const, label: t('courses.paid'), icon: '💳' },
              ].map(opt => {
                const checked = price === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-lg transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                  >
                    <input
                      type="radio"
                      name="price"
                      className="accent-primary w-4 h-4 shrink-0"
                      checked={checked}
                      onChange={() => setPrice(opt.value)}
                      onClick={() => { if (price === opt.value) setPrice(undefined); }}
                    />
                    <span className="text-base leading-none">{opt.icon}</span>
                    <span className={`text-sm ${checked ? 'font-semibold text-primary' : 'text-foreground'}`}>{opt.label}</span>
                  </label>
                );
              })}
            </FilterPanel>

            {/* Language */}
            <FilterPanel title={t('courses.language')} icon="🌐" count={languages.length}>
              {[
                { value: 'ar', label: 'العربية', icon: '🇱🇾' },
                { value: 'en', label: 'English', icon: '🔤' },
              ].map(opt => {
                const checked = languages.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-lg transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4 shrink-0"
                      checked={checked}
                      onChange={() => toggle(languages, opt.value, setLanguages)}
                    />
                    <span className="text-base leading-none">{opt.icon}</span>
                    <span className={`text-sm ${checked ? 'font-semibold text-primary' : 'text-foreground'}`}>{opt.label}</span>
                  </label>
                );
              })}
            </FilterPanel>
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
              onAction={clearAll}
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
