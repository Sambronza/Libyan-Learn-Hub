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
  const { isAuthenticated } = useAuth();
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
      setLocation('/login');
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
      <div className="relative bg-foreground text-background py-10 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <Blob color="bg-primary" size="w-[500px] h-[500px]" className="-top-24 -start-24" duration={25} />
          <Blob color="bg-secondary" size="w-[400px] h-[400px]" className="top-1/2 -end-24" delay={2} duration={30} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-12 relative z-10">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-white/10 text-sm font-medium">{course.category?.name}</span>
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-medium capitalize">{course.level}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-display font-bold mb-6 leading-tight">
              {language === 'ar' ? course.titleAr : course.title}
            </h1>
            <p className="text-lg text-background/80 mb-8 max-w-2xl leading-relaxed">
              {language === 'ar' ? course.descriptionAr : course.description}
            </p>
            <div className="flex flex-wrap items-center gap-6 text-sm text-background/70">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold text-lg">
                  {course.teacherName.charAt(0)}
                </div>
                <div>
                  <div className="text-xs opacity-70">Instructor</div>
                  <div className="font-semibold text-background">{course.teacherName}</div>
                </div>
              </div>
              <div className="h-10 w-px bg-white/10 hidden sm:block"></div>
              <div>
                <div className="text-xs opacity-70">Enrolled</div>
                <div className="font-semibold text-background">{course.enrollmentCount} students</div>
              </div>
              <div className="h-10 w-px bg-white/10 hidden sm:block"></div>
              <div>
                <div className="text-xs opacity-70">Last Updated</div>
                <div className="font-semibold text-background">{new Date(course.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* Floating Action Card */}
          <div className="w-full lg:w-96 shrink-0 lg:-mb-32 z-10">
            <div className="bg-card text-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <PlayCircle className="w-16 h-16 text-primary/40" />
                  </div>
                )}
              </div>
              <div className="p-8">
                <div className="text-3xl font-bold mb-6">
                  {course.price === 0 ? 'Free' : `${course.price} LYD`}
                </div>
                
                {course.isEnrolled ? (
                  <>
                    <Link href={`/courses/${course.id}/learn`}>
                      <Button className="w-full h-14 text-lg rounded-xl mb-3 bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        Go to Lessons
                      </Button>
                    </Link>
                    <Button 
                      variant="outline"
                      className="w-full mb-4 border-amber-200 text-amber-700 hover:bg-amber-50 gap-2"
                      onClick={() => setShowReviewModal(true)}
                    >
                      <Star className="w-4 h-4 fill-amber-500" /> Write a Review
                    </Button>
                  </>
                ) : (
                  <Button 
                    onClick={handleEnroll} 
                    disabled={enrolling}
                    className="w-full h-14 text-lg rounded-xl mb-4 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                  >
                    {enrolling ? 'Processing...' : 'Enroll Now'}
                  </Button>
                )}
                
                <p className="text-center text-xs text-muted-foreground mb-4">30-Day Money-Back Guarantee</p>

                <div className="flex justify-center mb-6">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive gap-1" onClick={() => setReportCourse(true)}>
                    <Flag className="w-3 h-3" /> Report Course
                  </Button>
                </div>
                
                <div className="space-y-4 text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <PlayCircle className="w-5 h-5 text-primary" /> {course.lessonCount} video lessons
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" /> {formatDuration(course.totalDuration)} total length
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-secondary" /> Protected content (no downloads)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 flex flex-col lg:flex-row gap-12">
        <div className="flex-1 max-w-3xl">
          <h2 className="text-2xl font-display font-bold mb-6">Course Curriculum</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {course.lessons.map((lesson, idx) => (
              <div 
                key={lesson.id} 
                className={`p-4 sm:p-5 flex items-start gap-4 ${idx !== 0 ? 'border-t border-border' : ''} ${course.isEnrolled || lesson.isFree ? 'cursor-pointer hover:bg-muted/50' : 'opacity-80 hover:bg-muted/30'} transition-colors`}
                onClick={() => {
                  if (course.isEnrolled) {
                    setLocation(`/courses/${courseId}/learn`);
                  } else if (lesson.isFree) {
                    if (lesson.type === 'video') {
                      setPreviewLessonId(lesson.id);
                    } else {
                      toast({ title: 'Preview not available', description: 'This free lesson type cannot be previewed here.', variant: 'default' });
                    }
                  } else {
                    toast({ title: 'Locked', description: 'Enroll in the course to access this lesson.', variant: 'default' });
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
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">Free Preview</span>
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
            <h2 className="text-2xl font-display font-bold mb-6">About the Instructor</h2>
            {course.teacher && (
              <div className="flex items-start gap-6 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                 <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl shrink-0 overflow-hidden">
                  {course.teacher.avatarUrl ? <img src={course.teacher.avatarUrl} alt="Teacher" className="w-full h-full object-cover"/> : course.teacherName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-foreground mb-1">{course.teacher.fullName}</h3>
                  <p className="text-primary font-medium mb-4">{course.teacher.expertise || 'Expert Instructor'}</p>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {course.teacher.bio || 'This instructor has not provided a biography yet. They are a valued member of the EduLibya community teaching high-quality courses.'}
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
                         <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span>
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
            <DialogTitle>Report Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReportSubmit(submitReport)} className="space-y-4 mt-4">
            <div className="text-sm mb-4">You are reporting the course <span className="font-bold">{language === 'ar' ? course?.titleAr : course?.title}</span>.</div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason *</label>
              <select {...registerReport('reason', { required: true })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select a reason</option>
                <option value="inappropriate_behavior">Inappropriate Content</option>
                <option value="spam">Spam / Low Quality</option>
                <option value="copyright">Copyright Violation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description (optional)</label>
              <Textarea {...registerReport('description')} placeholder="Please provide more details..." rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setReportCourse(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" className="flex-1">Submit Report</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Write a Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-4 text-center">How would you rate your experience with this course?</p>
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
              <label className="text-sm font-medium mb-1 block">Your Recommendation</label>
              <Textarea 
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="What did you like about this course? Would you recommend it?" 
                rows={4} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>Cancel</Button>
            <Button 
              onClick={() => submitReview.mutate()} 
              disabled={submitReview.isPending}
            >
              {submitReview.isPending ? 'Submitting...' : 'Submit Review'}
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
