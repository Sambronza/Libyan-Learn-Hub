import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { 
  GraduationCap, Calendar, Clock, BookOpen, FileText, 
  MapPin, CheckCircle2, Clock3, AlertCircle, PlayCircle, Loader2 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AcademyDashboard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const isRtl = language === 'ar';

  const { data: enrollmentData, isLoading: loadingEnrollment } = useQuery({
    queryKey: ['academy-enrollment'],
    queryFn: () => api.get('/academy/my-enrollment')
  });

  const { data: applications, isLoading: loadingApps } = useQuery({
    queryKey: ['academy-application'],
    queryFn: () => api.get('/academy/my-application'),
  });

  if (loadingEnrollment || loadingApps) {
    return (
      <PageContainer>
        <div className="flex justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </PageContainer>
    );
  }

  const { enrolled, current } = enrollmentData || { enrolled: false, current: null };
  const hasPendingApp = applications?.some((a: any) => a.status === 'pending' || a.status === 'waitlisted');
  const latestApp = applications?.[0];

  // ─── Unenrolled State (Show Applications or CTA) ──────────────
  if (!enrolled) {
    return (
      <PageContainer>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-card border border-border rounded-3xl p-10 shadow-sm text-center">
            
            {hasPendingApp ? (
              <div className="space-y-6">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
                  <Clock3 className="w-10 h-10 text-blue-600" />
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground">
                  {isRtl ? 'طلبك قيد المراجعة' : 'Application Under Review'}
                </h1>
                <p className="text-lg text-muted-foreground mx-auto max-w-lg">
                  {isRtl 
                    ? `لقد استلمنا طلب التحاقك ببرنامج ${latestApp?.programNameAr || ''}. فريقنا يقوم حالياً بمراجعة طلبك والمستندات المرفقة وسنعلمك بالنتيجة قريباً استعد لبدء رحلتك الأكاديمية!`
                    : `We've received your application to the ${latestApp?.programName || ''} program. Our team is reviewing it and will notify you soon. Get ready to start your academic journey!`}
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200 mt-4">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  {isRtl ? 'الطلب قيد المعالجة' : 'Processing Application'}
                </div>
              </div>
            ) : latestApp?.status === 'rejected' ? (
              <div className="space-y-6">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground">
                  {isRtl ? 'حالة الطلب' : 'Application Status'}
                </h1>
                <p className="text-lg text-muted-foreground mx-auto max-w-lg">
                  {isRtl
                    ? `نعتذر، لم يتم قبول طلبك للالتحاق ببرنامج ${latestApp?.programNameAr || ''}. يرجى مراجعة الملاحظات أو التواصل مع الإدارة.`
                    : `We're sorry, your application to the ${latestApp?.programName || ''} program was not accepted. Please review the notes or contact administration.`}
                </p>
                {latestApp.reviewNotes && (
                  <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 mt-4 max-w-md mx-auto text-sm text-start">
                     <strong>{isRtl ? 'ملاحظات الإدارة: ' : 'Admin Notes: '}</strong>
                     {latestApp.reviewNotes}
                  </div>
                )}
                <Button 
                  onClick={() => setLocation('/academy/apply')}
                  className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl h-12 px-8 shadow-lg shadow-amber-500/20"
                >
                  {isRtl ? 'تقديم طلب جديد' : 'Submit New Application'}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="w-10 h-10 text-amber-500" />
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-4">
                  {isRtl ? 'أكاديمية EduLibya' : 'EduLibya Academy'}
                </h1>
                <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8">
                  {isRtl
                    ? 'أنت غير مسجل حالياً في أي برنامج أكاديمي. انضم لتكمل تعليمك الأساسي والثانوي من المنزل.'
                    : 'You are not currently enrolled in any academic program. Join to complete your education from home.'}
                </p>
                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={() => setLocation('/academy/apply')}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl h-12 px-8 shadow-lg shadow-amber-500/20"
                  >
                    {isRtl ? 'قدم طلب التحاق' : 'Apply for Admission'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/academy')}
                    className="font-medium rounded-xl h-12 px-8 border-2"
                  >
                    {isRtl ? 'استعراض البرامج' : 'Explore Programs'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    );
  }

  // ─── Enrolled State (Show Dashboard) ──────────────────────────
  
  return (
    <PageContainer>
      {/* Header Profile section */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent py-10 border-b border-amber-500/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-display font-bold shadow-lg">
              {user?.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">
                   {isRtl ? 'طالب أكاديمية' : 'Academy Student'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${current?.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground border border-border'}`}>
                   {current?.status === 'active' ? (isRtl ? 'نشط' : 'Active') : current?.status}
                </span>
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {isRtl ? `مرحباً، ${user?.fullName}` : `Welcome back, ${user?.fullName}`}
              </h1>
              <p className="text-muted-foreground text-sm font-medium mt-1">
                {isRtl ? current?.programNameAr : current?.programName} — {isRtl ? `الصف ${current?.currentGradeLevel}` : `Grade ${current?.currentGradeLevel}`}
              </p>
            </div>
          </div>

          {/* Academic Info Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-0.5">{isRtl ? 'الفصل الدراسي' : 'Current Semester'}</div>
                <div className="font-bold">{isRtl ? current?.semesterNameAr : current?.semesterName}</div>
              </div>
            </div>
            
            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-0.5">{isRtl ? 'المقررات' : 'Registered Subjects'}</div>
                <div className="font-bold">{current?.registrations?.length || 0} {isRtl ? 'مواد' : 'Classes'}</div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-0.5">{isRtl ? 'المعدل التراكمي' : 'Current GPA'}</div>
                <div className="font-bold">{current?.gpa ? Number(current.gpa).toFixed(2) : '-.--'}</div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-0.5">{isRtl ? 'مركز الاختبار' : 'Exam Center'}</div>
                <div className="font-bold">{isRtl ? 'طرابلس (المركز الرئيسي)' : 'Tripoli (Main)'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Enrolled Subjects */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              {isRtl ? 'مقررات الفصل الدراسي' : 'Semester Subjects'}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {current?.registrations && current.registrations.length > 0 ? (
              current.registrations.map((reg: any) => (
                <div key={reg.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-amber-500/30 transition-all flex flex-col h-full group">
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-amber-600 shadow-sm" />
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                        reg.grade && Number(reg.grade) >= 50 ? 'bg-emerald-100 text-emerald-700' :
                        reg.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {reg.grade ? `${reg.grade}%` : (isRtl ? 'قيد الدراسة' : 'In Progress')}
                      </span>
                    </div>
                    
                    <h3 className={`font-display font-bold text-lg mb-1 ${isRtl ? 'text-right' : ''}`}>
                      {isRtl ? reg.subjectNameAr : reg.subjectName}
                    </h3>
                    
                    <p className={`text-sm text-muted-foreground mb-4 ${isRtl ? 'text-right' : ''}`}>
                      {isRtl ? `أستاذ: ${reg.teacherNameAr || reg.teacherName || 'يحدد قريباً'}` : `Prof. ${reg.teacherName || 'TBD'}`}
                    </p>
                    
                    <div className="flex items-center gap-4 text-[12px] font-medium text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded">
                        <Clock className="w-3.5 h-3.5" />
                        {reg.creditHours} {isRtl ? 'ساعات معتمدة' : 'Credits'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 border-t border-border bg-muted/20">
                    <Button variant="secondary" className="w-full bg-amber-50 text-amber-700 hover:bg-amber-100 gap-2 border border-amber-200">
                      <PlayCircle className="w-4 h-4" />
                      {isRtl ? 'دخول قاعة الدروس' : 'Enter Classroom'}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-3xl bg-card">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">{isRtl ? 'لم يتم تسجيل أي مواد' : 'No Subjects Registered'}</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {isRtl 
                    ? 'سيتم إضافة المواد الدراسية الخاصة بك هنا بمجرد اعتمادها من الإدارة.'
                    : 'Your registered subjects will appear here once approved by administration.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
