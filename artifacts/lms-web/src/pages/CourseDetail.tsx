import React from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { PageContainer } from '@/components/layout/PageContainer';
import { useGetCourse, useEnrollCourse } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Clock, PlayCircle, FileText, CheckCircle2, ShieldAlert, Flag, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSEO } from '@/hooks/useSEO';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { useApi } from '@/hooks/useApi';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Blob } from '@/components/ui/Blob';
import { ProtectedPlayer } from '@/components/ProtectedPlayer';

export default function CourseDetail() {
  const [, params] = useRoute('/courses/:id');
  const courseId = parseInt(params?.id || '0');
  const { language, t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const api = useApi();
  const queryClient = useQueryClient();
  const [reportCourse, setReportCourse] = useState(false);
  const { register: registerReport, handleSubmit: handleReportSubmit, reset: resetReport } = useForm();
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  
  const { data: course, isLoading, isError, refetch } = useGetCourse(courseId, { query: { queryKey: ['/api/courses', courseId], enabled: !!courseId } });
  
  const [previewLessonId, setPreviewLessonId] = useState<number | null>(null);
  const previewLesson = previewLessonId && course ? course.lessons.find((l: any) => l.id === previewLessonId) : null;
  
  const { data: reviews = [] } = useQuery({
    queryKey: ['/api/courses', courseId, 'reviews'],
    queryFn: () => api.get(`/courses/${courseId}/reviews`),
    enabled: !!courseId,
  });
  const { mutate: enroll, isPending: enrolling } = useEnrollCourse({
    mutation: {
      onSuccess: () => {
        toast({ title: "Successfully enrolled!", description: "You can now start learning." });
        refetch();
      },
      onError: (err) => {
        toast({ title: "Failed to enroll", description: err.message, variant: "destructive" });
      }
    }
  });

  const submitReport = async (data: any) => {
    if (!course) return;
    try {
      await api.post('/reports', {
        type: 'course',
        targetId: course.id,
        reportedUserId: course.teacherId, // assuming populated or we can omit it if strictly course 
        reason: data.reason,
        description: data.description,
      });
      toast({ title: 'Report submitted. Thank you for your feedback.' });
      setReportCourse(false);
      resetReport();
    } catch (err: any) {
      toast({ title: 'Error submitting report', description: err.message, variant: 'destructive' });
    }
  };

  const submitReview = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/reviews`, { rating: reviewRating, comment: reviewComment }),
    onSuccess: () => {
      toast({ title: "Review submitted!", description: "Thank you for your feedback." });
      queryClient.invalidateQueries({ queryKey: ['/api/courses', courseId, 'reviews'] });
      setShowReviewModal(false);
      setReviewComment("");
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit review", description: err.message, variant: "destructive" });
    }
  });

  const title = course ? (language === 'ar' ? course.titleAr : course.title) : 'Loading Course...';
  const description = course ? (language === 'ar' ? course.descriptionAr : course.description) : 'Libyan Learn Hub Course';

  useSEO({
    title,
    description,
    schema: course ? {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": title,
      "description": description,
      "provider": {
        "@type": "Organization",
        "name": "Libyan Learn Hub",
        "sameAs": "https://libyan-learn-hub.com"
      },
      "hasCourseInstance": {
        "@type": "CourseInstance",
        "courseMode": "online",
        "instructor": {
          "@type": "Person",
          "name": course.teacherName || 'Instructor'
        }
      },
      "offers": {
        "@type": "Offer",
        "category": "Paid",
        "price": course.price,
        "priceCurrency": course.currency || "LYD"
      }
    } : undefined
  });

  if (isLoading) return <PageContainer><div className="p-20 text-center">Loading...</div></PageContainer>;
  if (isError) return <div className="min-h-screen pt-24 text-center text-red-500">Error loading course</div>;
  if (!course) return null;

  const formatDuration = (secs: number): string => {
    if (!secs) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const handleEnroll = () => {
    if (!isAuthenticated) {
      setLocation(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (course.price > 0) {
      setLocation(`/checkout/course/${courseId}`);
    } else {
      enroll({ courseId });
    }
  };

  return (
    <PageContainer>
      {/* Header Banner */}
      <div className="relative text-white py-12 lg:py-28 overflow-hidden min-h-[500px]">
        {/* Background Image with blur and overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center scale-110"
          style={{ backgroundImage: `url(${course.thumbnailUrl || ''})` }}
        ></div>
        <div className="absolute inset-0 z-0 bg-black/70 backdrop-blur-3xl"></div>
        
        {/* Ambient Blobs */}
        <div className="absolute inset-0 opacity-30 pointer-events-none z-0 mix-blend-screen">
          <Blob color="bg-primary" size="w-[600px] h-[600px]" className="-top-32 -start-32" duration={25} />
          <Blob color="bg-secondary" size="w-[500px] h-[500px]" className="top-1/3 -end-32" delay={2} duration={30} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-12 lg:gap-20 relative z-10">
          <div className="flex-1 pb-8 lg:pb-0">
            <nav className="flex items-center gap-2 text-sm text-white/60 mb-8 font-medium tracking-wide">
              <Link href="/"><a className="hover:text-white transition-colors">{language === 'ar' ? 'الرئيسية' : 'Home'}</a></Link>
              <span className="opacity-50">/</span>
              <Link href="/courses"><a className="hover:text-white transition-colors">{language === 'ar' ? 'الدورات' : 'Courses'}</a></Link>
              <span className="opacity-50">/</span>
              <span className="text-white/90 line-clamp-1">{title}</span>
            </nav>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium backdrop-blur-md shadow-sm">{course.category?.name}</span>
              <span className="px-4 py-1.5 rounded-full bg-primary/40 border border-primary/30 text-white text-sm font-medium capitalize backdrop-blur-md shadow-sm">{course.level}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold mb-6 leading-[1.15] text-white drop-shadow-lg">
              {language === 'ar' ? course.titleAr : course.title}
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl leading-relaxed drop-shadow-md">
              {language === 'ar' ? course.descriptionAr : course.description}
            </p>
            
            <div className="flex flex-wrap items-center gap-8 text-sm text-white/80 mt-10">
              <Link href={`/teachers/${course.teacher?.id}`}>
                <a className="group flex items-center gap-4 hover:text-white transition-colors cursor-pointer">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xl overflow-hidden border border-white/20 group-hover:border-primary transition-all shadow-xl backdrop-blur-md group-hover:scale-105">
                    {course.teacher?.avatarUrl ? (
                      <img src={course.teacher.avatarUrl} alt={course.teacherName} className="w-full h-full object-cover" />
                    ) : (
                      course.teacherName.charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1 uppercase tracking-wider">{language === 'ar' ? 'المعلم' : 'Instructor'}</div>
                    <div className="font-semibold text-lg text-white group-hover:text-primary transition-colors">{course.teacherName}</div>
                  </div>
                </a>
              </Link>
              <div className="h-12 w-px bg-white/20 hidden sm:block"></div>
              <div>
                <div className="text-xs opacity-70 mb-1 uppercase tracking-wider">{language === 'ar' ? 'المسجلين' : 'Enrolled'}</div>
                <div className="font-semibold text-lg text-white">{course.enrollmentCount} <span className="text-sm font-normal opacity-80">{language === 'ar' ? 'طلاب' : 'students'}</span></div>
              </div>
              <div className="h-12 w-px bg-white/20 hidden sm:block"></div>
              <div>
                <div className="text-xs opacity-70 mb-1 uppercase tracking-wider">{language === 'ar' ? 'آخر تحديث' : 'Last Updated'}</div>
                <div className="font-semibold text-lg text-white">{new Date(course.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          </div>

          {/* Floating Action Card */}
          <div className="w-full md:w-[420px] lg:w-[420px] shrink-0 lg:-mb-40 z-20 perspective-1000">
            <div className="bg-white/10 dark:bg-black/40 text-white rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden backdrop-blur-xl ring-1 ring-white/10 transform-gpu hover:shadow-primary/20 transition-all duration-500">
              <div className="aspect-video relative group overflow-hidden bg-black/40">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PlayCircle className="w-20 h-20 text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                   <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white group-hover:bg-primary/80 group-hover:scale-110 transition-all duration-300 shadow-xl">
                      <PlayCircle className="w-8 h-8 fill-white/20" />
                   </div>
                </div>
                {/* Free Badge if free */}
                {course.price === 0 && (
                  <div className="absolute top-4 end-4 z-20 bg-gradient-to-r from-emerald-400 to-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg border border-white/20 backdrop-blur-md">
                    {language === 'ar' ? 'مجاني 100%' : '100% FREE'}
                  </div>
                )}
              </div>
              <div className="p-8 lg:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="text-4xl font-bold mb-8 flex items-end gap-2 text-white">
                  {course.price === 0 ? (
                    <span className="text-emerald-400 drop-shadow-md">{language === 'ar' ? 'مجاناً' : 'Free'}</span>
                  ) : (
                    <span>{course.price} <span className="text-2xl text-white/70">{language === 'ar' ? 'د.ل' : 'LYD'}</span></span>
                  )}
                </div>
                
                {course.isEnrolled ? (
                  <>
                    <Link href={`/courses/${course.id}/learn`}>
                      <Button className="w-full h-16 text-lg font-bold rounded-2xl mb-4 bg-white/20 hover:bg-white/30 text-white border border-white/20 transition-all shadow-xl hover:-translate-y-1 backdrop-blur-sm">
                        {language === 'ar' ? 'الذهاب للدروس' : 'Go to Lessons'}
                      </Button>
                    </Link>
                    <Button 
                      variant="outline"
                      className="w-full h-12 mb-6 bg-transparent border-white/20 text-white hover:bg-white/10 gap-2 font-medium rounded-xl"
                      onClick={() => setShowReviewModal(true)}
                    >
                      <Star className="w-4 h-4 text-amber-400" /> {language === 'ar' ? 'كتابة مراجعة' : 'Write a Review'}
                    </Button>
                  </>
                ) : (
                  <div className="mb-8 relative">
                    <Button 
                      onClick={handleEnroll} 
                      disabled={enrolling}
                      className="w-full h-16 text-xl font-bold rounded-2xl bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90 text-white shadow-[0_0_40px_-10px_rgba(var(--primary),0.5)] hover:shadow-[0_0_60px_-15px_rgba(var(--primary),0.6)] border border-white/10 hover:-translate-y-1 transition-all duration-300"
                    >
                      {enrolling ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...') : (language === 'ar' ? 'سجل الآن' : 'Enroll Now')}
                    </Button>
                    <p className="text-center text-sm text-white/60 mt-4 font-medium">{language === 'ar' ? 'ابدأ التعلم فوراً' : 'Start learning instantly'}</p>
                  </div>
                )}
                
                {course.price > 0 && <p className="text-center text-sm text-white/60 mb-6 font-medium">{language === 'ar' ? 'ضمان استرجاع الأموال خلال 30 يوماً' : '30-Day Money-Back Guarantee'}</p>}

                <div className="space-y-5 text-sm font-medium text-white/80 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><PlayCircle className="w-4 h-4 text-white/90" /></div>
                    {course.lessonCount} {language === 'ar' ? 'دروس فيديو' : 'video lessons'}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><Clock className="w-4 h-4 text-white/90" /></div>
                    {formatDuration(course.totalDuration)} {language === 'ar' ? 'المدة الإجمالية' : 'total length'}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><ShieldAlert className="w-4 h-4 text-white/90" /></div>
                    {language === 'ar' ? 'محتوى محمي (غير قابل للتنزيل)' : 'Protected content (no downloads)'}
                  </div>
                </div>

                <div className="flex justify-center mt-8">
                  <Button variant="ghost" size="sm" className="text-xs text-white/40 hover:text-white hover:bg-white/10 gap-1 rounded-lg px-3 py-1" onClick={() => setReportCourse(true)}>
                    <Flag className="w-3 h-3" /> {language === 'ar' ? 'الإبلاغ عن الدورة' : 'Report Course'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 flex flex-col lg:flex-row gap-12">
        <div className="flex-1 max-w-3xl">
          <h2 className="text-2xl font-display font-bold mb-6">{language === 'ar' ? 'منهج الدورة' : 'Course Curriculum'}</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {course.lessons.map((lesson, idx) => (
              <div 
                key={lesson.id} 
                className={`p-4 sm:p-5 flex items-start gap-4 ${idx !== 0 ? 'border-t border-border' : ''} ${course.isEnrolled || lesson.isFree || user?.id === course.teacherId ? 'cursor-pointer hover:bg-muted/50' : 'opacity-80 hover:bg-muted/30'} transition-colors`}
                onClick={() => {
                  if (course.isEnrolled) {
                    setLocation(`/courses/${courseId}/learn`);
                  } else if (lesson.isFree || user?.id === course.teacherId) {
                    if (lesson.type === 'video') {
                      setPreviewLessonId(lesson.id);
                    } else {
                      toast({ title: language === 'ar' ? 'المعاينة غير متاحة' : 'Preview not available', description: language === 'ar' ? 'لا يمكن معاينة هذا النوع من الدروس هنا.' : 'This lesson type cannot be previewed here.', variant: 'default' });
                    }
                  } else {
                    toast({ title: language === 'ar' ? 'مغلق' : 'Locked', description: language === 'ar' ? 'سجل في الدورة للوصول إلى هذا الدرس.' : 'Enroll in the course to access this lesson.', variant: 'default' });
                  }
                }}
              >
                <div className="mt-1">
                  {lesson.type === 'video' ? <PlayCircle className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-secondary" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">
                    {idx + 1}. {language === 'ar' ? lesson.titleAr : lesson.title}
                  </h4>
                  {lesson.isFree && !course.isEnrolled && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">{language === 'ar' ? 'معاينة مجانية' : 'Free Preview'}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDuration(lesson.duration)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-display font-bold mb-6">{language === 'ar' ? 'عن المعلم' : 'About the Instructor'}</h2>
            {course.teacher && (
              <div className="flex items-start gap-6 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                 <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl shrink-0 overflow-hidden">
                  {course.teacher.avatarUrl ? <img src={course.teacher.avatarUrl} alt="Teacher" className="w-full h-full object-cover"/> : course.teacherName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-foreground mb-1">{course.teacher.fullName}</h3>
                  <p className="text-primary font-medium mb-4">{course.teacher.expertise || (language === 'ar' ? 'معلم خبير' : 'Expert Instructor')}</p>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {course.teacher.bio || (language === 'ar' ? 'لم يقدم هذا المعلم سيرة ذاتية بعد. إنه عضو قيم في مجتمع إديوليبيا لتدريس دورات عالية الجودة.' : 'This instructor has not provided a biography yet. They are a valued member of the EduLibya community teaching high-quality courses.')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" /> 
              {language === 'ar' ? 'مراجعات الطلاب' : 'Student Reviews'}
            </h2>
            {reviews.length === 0 ? (
               <div className="p-8 text-center bg-card rounded-2xl border border-border">
                 <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد مراجعات حتى الآن. كن أول من يكتب مراجعة!' : 'No reviews yet. Be the first to review this course!'}</p>
               </div>
            ) : (
               <div className="space-y-4">
                 {reviews.map((review: any) => (
                   <div key={review.id} className="p-5 bg-card rounded-2xl border border-border shadow-sm flex gap-4">
                     <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0 overflow-hidden">
                       {review.user?.avatarUrl ? <img src={review.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : review.user?.fullName?.charAt(0) || 'S'}
                     </div>
                     <div className="flex-1">
                       <div className="flex items-center justify-between mb-1">
                         <h4 className="font-bold">{language === 'ar' ? (review.user?.fullNameAr || review.user?.fullName) : review.user?.fullName}</h4>
                         <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                       </div>
                       <div className="flex gap-0.5 mb-2">
                         {[...Array(5)].map((_, i) => (
                           <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-border fill-muted'}`} />
                         ))}
                       </div>
                       {review.comment && <p className="text-sm text-foreground/80 whitespace-pre-line">{review.comment}</p>}
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Course Modal */}
      <Dialog open={reportCourse} onOpenChange={setReportCourse}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'الإبلاغ عن الدورة' : 'Report Course'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReportSubmit(submitReport)} className="space-y-4 mt-4">
            <div className="text-sm mb-4">{language === 'ar' ? 'أنت تبلغ عن الدورة' : 'You are reporting the course'} <span className="font-bold">{language === 'ar' ? course?.titleAr : course?.title}</span>.</div>
            <div>
              <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'السبب *' : 'Reason *'}</label>
              <select {...registerReport('reason', { required: true })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">{language === 'ar' ? 'اختر سبباً' : 'Select a reason'}</option>
                <option value="inappropriate_behavior">{language === 'ar' ? 'محتوى غير لائق' : 'Inappropriate Content'}</option>
                <option value="spam">{language === 'ar' ? 'رسائل مزعجة / جودة منخفضة' : 'Spam / Low Quality'}</option>
                <option value="copyright">{language === 'ar' ? 'انتهاك حقوق النشر' : 'Copyright Violation'}</option>
                <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'الوصف (اختياري)' : 'Description (optional)'}</label>
              <Textarea {...registerReport('description')} placeholder={language === 'ar' ? 'يرجى تقديم مزيد من التفاصيل...' : 'Please provide more details...'} rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setReportCourse(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" variant="destructive" className="flex-1">{language === 'ar' ? 'إرسال البلاغ' : 'Submit Report'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Write a Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'كتابة مراجعة' : 'Write a Review'}</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-4 text-center">{language === 'ar' ? 'كيف تقيم تجربتك مع هذه الدورة؟' : 'How would you rate your experience with this course?'}</p>
            <div className="flex gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  type="button"
                  className="focus:outline-none transition-transform hover:scale-110"
                  onClick={() => setReviewRating(star)}
                >
                  <Star className={`w-10 h-10 ${star <= reviewRating ? 'text-amber-500 fill-amber-500' : 'text-border fill-muted'}`} />
                </button>
              ))}
            </div>
            <div className="w-full">
              <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'توصيتك' : 'Your Recommendation'}</label>
              <Textarea 
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={language === 'ar' ? 'ما الذي أعجبك في هذه الدورة؟ هل تنصح بها؟' : 'What did you like about this course? Would you recommend it?'} 
                rows={4} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            <Button 
              onClick={() => submitReview.mutate()} 
              disabled={submitReview.isPending}
            >
              {submitReview.isPending ? (language === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : (language === 'ar' ? 'إرسال المراجعة' : 'Submit Review')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free Preview Modal */}
      <Dialog open={!!previewLessonId} onOpenChange={(open) => !open && setPreviewLessonId(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-border">
          <DialogHeader className="p-4 bg-card border-b border-border absolute top-0 w-full z-10 opacity-0 hover:opacity-100 transition-opacity">
            <DialogTitle className="text-white">{previewLesson ? (language === 'ar' ? previewLesson.titleAr : previewLesson.title) : ''}</DialogTitle>
          </DialogHeader>
          <div className="w-full aspect-video bg-black flex items-center justify-center pt-8 sm:pt-0">
            {previewLesson && (previewLesson.type === 'video') && (
              <ProtectedPlayer
                url={((previewLesson as any).videoUrl || (previewLesson as any).videoFilePath) || ""}
                courseId={courseId}
                lessonId={previewLesson.id}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
