import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApi } from '@/hooks/useApi';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, BookOpen, Users, PlayCircle, Crown, BadgeCheck, Filter, X, TrendingUp, User } from 'lucide-react';

const SCHOOL_YEARS = [
  { value: '1-primary', en: '1st Primary', ar: 'الصف الأول ابتدائي' },
  { value: '2-primary', en: '2nd Primary', ar: 'الصف الثاني ابتدائي' },
  { value: '3-primary', en: '3rd Primary', ar: 'الصف الثالث ابتدائي' },
  { value: '4-primary', en: '4th Primary', ar: 'الصف الرابع ابتدائي' },
  { value: '5-primary', en: '5th Primary', ar: 'الصف الخامس ابتدائي' },
  { value: '6-primary', en: '6th Primary', ar: 'الصف السادس ابتدائي' },
  { value: '1-preparatory', en: '1st Preparatory', ar: 'الصف الأول إعدادي' },
  { value: '2-preparatory', en: '2nd Preparatory', ar: 'الصف الثاني إعدادي' },
  { value: '3-preparatory', en: '3rd Preparatory', ar: 'الصف الثالث إعدادي' },
  { value: '1-secondary', en: '1st Secondary', ar: 'الصف الأول ثانوي' },
  { value: '2-secondary', en: '2nd Secondary', ar: 'الصف الثاني ثانوي' },
  { value: '3-secondary', en: '3rd Secondary', ar: 'الصف الثالث ثانوي' },
  { value: 'university', en: 'University', ar: 'جامعي' },
];

type TabType = 'all' | 'courses' | 'teachers' | 'lessons';

export default function SearchPage() {
  const { language } = useLanguage();
  const api = useApi();
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [schoolYear, setSchoolYear] = useState('');
  const [level, setLevel] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['/api/courses', { search: keyword, level, limit: 20 }],
    queryFn: () => api.get(`/courses?search=${encodeURIComponent(keyword)}&level=${level}&limit=20`),
    enabled: submitted && (activeTab === 'all' || activeTab === 'courses'),
  });

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ['/api/teachers', keyword],
    queryFn: () => api.get('/teachers'),
    enabled: submitted && (activeTab === 'all' || activeTab === 'teachers'),
  });

  const isLoading = coursesLoading || teachersLoading;
  const filteredTeachers = (teachers || []).filter((t: any) =>
    !keyword || t.fullName?.toLowerCase().includes(keyword.toLowerCase()) ||
    t.fullNameAr?.includes(keyword) || t.expertise?.toLowerCase().includes(keyword.toLowerCase())
  );

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
  };

  const clearFilters = () => {
    setKeyword('');
    setSchoolYear('');
    setLevel('');
    setSubmitted(false);
    setActiveTab('all');
  };

  const tabs: { key: TabType; en: string; ar: string }[] = [
    { key: 'all', en: 'All', ar: 'الكل' },
    { key: 'courses', en: 'Courses', ar: 'الدورات' },
    { key: 'teachers', en: 'Teachers', ar: 'المعلمون' },
  ];

  return (
    <PageContainer>
      {/* Search Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-primary/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-display font-bold mb-2">
            {language === 'ar' ? 'البحث المتقدم' : 'Advanced Search'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {language === 'ar' ? 'ابحث عن الدورات والمعلمين والدروس حسب الموضوع أو الكتاب أو السنة الدراسية' : 'Search courses, teachers, and lessons by topic, book, or school year'}
          </p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder={language === 'ar' ? 'ابحث عن مادة، كتاب، فصل، أو موضوع...' : 'Search for subject, book, chapter, or topic...'}
                className="pl-12 h-14 bg-card rounded-2xl text-base shadow-sm"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90">
              {language === 'ar' ? 'بحث' : 'Search'}
            </Button>
          </form>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" /> {language === 'ar' ? 'تصفية:' : 'Filter:'}
            </div>
            <select value={schoolYear} onChange={e => setSchoolYear(e.target.value)}
              className="h-9 px-3 rounded-lg border border-input bg-background text-sm">
              <option value="">{language === 'ar' ? 'السنة الدراسية' : 'School Year'}</option>
              {SCHOOL_YEARS.map(y => <option key={y.value} value={y.value}>{language === 'ar' ? y.ar : y.en}</option>)}
            </select>
            <select value={level} onChange={e => setLevel(e.target.value)}
              className="h-9 px-3 rounded-lg border border-input bg-background text-sm">
              <option value="">{language === 'ar' ? 'المستوى' : 'Level'}</option>
              <option value="beginner">{language === 'ar' ? 'مبتدئ' : 'Beginner'}</option>
              <option value="intermediate">{language === 'ar' ? 'متوسط' : 'Intermediate'}</option>
              <option value="advanced">{language === 'ar' ? 'متقدم' : 'Advanced'}</option>
            </select>
            {(keyword || schoolYear || level) && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
                <X className="w-3 h-3" /> {language === 'ar' ? 'مسح' : 'Clear'}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 bg-muted/50 p-1 rounded-xl w-fit">
            {tabs.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {language === 'ar' ? tab.ar : tab.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {!submitted ? (
          /* Trending / empty state */
          <div className="text-center py-16">
            <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">{language === 'ar' ? 'ابدأ البحث عن موضوعاتك المفضلة' : 'Start searching for your topics'}</h3>
            <p className="text-muted-foreground">{language === 'ar' ? 'يمكنك البحث بالمادة، اسم الكتاب، أو الفصل' : 'You can search by subject, book name, or chapter'}</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-card rounded-2xl animate-pulse border border-border" />)}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Teachers section */}
            {(activeTab === 'all' || activeTab === 'teachers') && filteredTeachers.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  {language === 'ar' ? 'المعلمون' : 'Teachers'} ({filteredTeachers.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTeachers.map((teacher: any) => (
                    <Link key={teacher.id} href={teacher.profileSlug ? `/teachers/${teacher.profileSlug}` : `/courses?teacher=${teacher.id}`}>
                      <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-md hover:border-primary/20 transition-all group cursor-pointer">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                            {teacher.fullName?.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                                {language === 'ar' ? (teacher.fullNameAr || teacher.fullName) : teacher.fullName}
                              </h3>
                              {teacher.isVerified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                              {teacher.isSponsored && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                            </div>
                            {teacher.expertise && <p className="text-xs text-muted-foreground truncate">{teacher.expertise}</p>}
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{teacher.courseCount} {language === 'ar' ? 'دورات' : 'courses'}</span>
                          <span>{teacher.studentCount} {language === 'ar' ? 'طلاب' : 'students'}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Courses section */}
            {(activeTab === 'all' || activeTab === 'courses') && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  {language === 'ar' ? 'الدورات' : 'Courses'} ({courses?.courses?.length || 0})
                </h2>
                {courses?.courses?.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-2xl border border-border border-dashed">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses?.courses?.map((course: any) => (
                      <Link key={course.id} href={`/courses/${course.id}`}>
                        <div className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group">
                          <div className="aspect-video relative overflow-hidden bg-muted">
                            {course.thumbnailUrl ? (
                              <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                <PlayCircle className="w-10 h-10 text-primary/40" />
                              </div>
                            )}
                            {course.isSponsored && (
                              <div className="absolute top-2 end-2 bg-amber-500 text-white px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                                <Crown className="w-3 h-3" /> {language === 'ar' ? 'مميز' : 'Sponsored'}
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                              {language === 'ar' ? course.titleAr : course.title}
                            </h3>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground truncate">{course.teacherName}</span>
                              <span className="text-primary font-bold shrink-0">
                                {course.price === 0 ? (language === 'ar' ? 'مجاناً' : 'Free') : `${course.price} LYD`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No results at all */}
            {filteredTeachers.length === 0 && (courses?.courses?.length || 0) === 0 && (
              <div className="text-center py-16">
                <SearchIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-xl font-bold mb-2">{language === 'ar' ? 'لا توجد نتائج' : 'No results found'}</h3>
                <p className="text-muted-foreground mb-4">{language === 'ar' ? 'جرب كلمات بحث مختلفة' : 'Try different search terms'}</p>
                <Button variant="outline" onClick={clearFilters}>{language === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
