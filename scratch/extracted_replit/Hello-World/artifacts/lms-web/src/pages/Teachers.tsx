import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useApi } from '@/hooks/useApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, BadgeCheck, Search, User, Crown } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

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
              className={`gap-2 ${tutorOnly ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}
            >
              {language === 'ar' ? 'دروس خصوصية فقط' : '1-on-1 Tutors Only'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-card rounded-2xl animate-pulse border border-border" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState 
            title={language === 'ar' ? 'لا يوجد معلمين' : 'No teachers found'}
            description={language === 'ar' ? 'جرب تغيير معايير البحث' : 'Try adjusting your search criteria'}
            icon={User}
            actionLabel={language === 'ar' ? 'مسح البحث' : 'Clear Search'}
            onAction={() => {setSearch(''); setTutorOnly(false);}}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((teacher: any) => (
              <Link key={teacher.id} href={`/teachers/${teacher.profileSlug || teacher.id}`}>
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group flex flex-col cursor-pointer h-full">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
                      {teacher.avatarUrl ? (
                        <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                      ) : teacher.fullName?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                          {language === 'ar' ? (teacher.fullNameAr || teacher.fullName) : teacher.fullName}
                        </h3>
                        {teacher.isVerified && <BadgeCheck className="w-5 h-5 text-primary shrink-0" />}
                        {teacher.isSponsored && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0 flex items-center gap-1">
                            <Crown className="w-3 h-3" /> {language === 'ar' ? 'مميز' : 'Sponsored'}
                          </span>
                        )}
                        {teacher.tier === 'pro' && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 shrink-0">PRO</span>
                        )}
                      </div>
                      {teacher.expertise && (
                        <p className="text-sm text-muted-foreground truncate">{teacher.expertise}</p>
                      )}
                    </div>
                  </div>
                  {(teacher.bio || teacher.bioAr) && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
                      {language === 'ar' ? (teacher.bioAr || teacher.bio) : teacher.bio}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t border-border mt-auto">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      {teacher.courseCount || 0} {language === 'ar' ? 'دورات' : 'courses'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      {teacher.studentCount || 0} {language === 'ar' ? 'طلاب' : 'students'}
                    </span>
                    {teacher.isTutoringEnabled && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 ms-auto">
                        {language === 'ar' ? 'دروس خصوصية' : 'Tutoring'}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
