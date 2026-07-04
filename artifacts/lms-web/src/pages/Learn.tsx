import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { useGetCourse, useGetLesson, useUpdateProgress } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMediaActivity } from '@/contexts/MediaActivityContext';
import { ProtectedPlayer } from '@/components/ProtectedPlayer';
import { PlayCircle, FileText, CheckCircle2, ChevronLeft, Menu, X, Flag, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { Textarea } from '@/components/ui/textarea';
import DOMPurify from 'dompurify';
import { FeedbackModal } from '@/components/FeedbackModal';

// Determine if a Cloudinary URL is a PDF by checking the public_id / URL path.
// Cloudinary raw resource URLs don't carry Content-Disposition headers suitable for iframes,
// so we use Google Docs Viewer for PDFs to guarantee cross-origin viewing works in any browser.
function isPdf(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.pdf') || lower.includes('/pdf/') ||
    // Cloudinary raw URLs sometimes have no extension — check documentFileName fallback via caller
    false;
}

function getDocIcon(filename?: string | null) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return '📄';
    case 'doc': case 'docx': return '📝';
    case 'xls': case 'xlsx': return '📊';
    case 'ppt': case 'pptx': return '📑';
    default: return '📎';
  }
}

export default function Learn() {
  const [, params] = useRoute('/courses/:id/learn');
  const courseId = parseInt(params?.id || '0');
  const { language, dir } = useLanguage();
  const [, setLocation] = useLocation();
  const { pingMediaActivity, setMediaActive } = useMediaActivity();

  // Clear media activity when leaving the learn page
  useEffect(() => () => setMediaActive(false), []);

  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reportLesson, setReportLesson] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  // Track whether we already triggered the early-pulse so it only fires once per session
  const earlyPulseFired = useRef(false);
  const completionFired = useRef(false);

  // Local set of completed lesson IDs for optimistic UI updates (sidebar checkmarks)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const { toast } = useToast();
  const api = useApi();
  const { register: registerReport, handleSubmit: handleReportSubmit, reset: resetReport } = useForm();

  const { data: course, isLoading: courseLoading } = useGetCourse(courseId, {
    query: { queryKey: ['/api/courses', courseId], enabled: !!courseId }
  });

  // Seed completedIds from the course data on first load
  useEffect(() => {
    if (course?.lessons) {
      const ids = new Set<number>(
        course.lessons.filter(l => l.isCompleted).map(l => l.id)
      );
      setCompletedIds(ids);
    }
  }, [course?.id]); // only re-seed on course change, not every render

  useEffect(() => {
    if (course && !activeLessonId && course.lessons.length > 0) {
      setActiveLessonId(course.lessons[0].id);
    }
    // Redirect if not enrolled
    if (course && !course.isEnrolled) {
      setLocation(`/courses/${courseId}`);
    }
  }, [course]);

  const { data: lesson, isLoading: lessonLoading } = useGetLesson(
    courseId,
    activeLessonId || 0,
    { query: { queryKey: ['/api/courses', courseId, 'lessons', activeLessonId], enabled: !!(courseId && activeLessonId) } }
  );

  const { mutate: updateProgress } = useUpdateProgress();

  // Optimistically mark a lesson as completed locally and call the API
  const markCompleted = useCallback((lessonId: number, watchedSeconds = 0) => {
    setCompletedIds(prev => {
      const next = new Set([...prev, lessonId]);

      // ── Early-Pulse: fire after 2nd completed lesson ───────────────────
      if (next.size === 2 && !earlyPulseFired.current) {
        earlyPulseFired.current = true;
        // Check if student has already reviewed — if not, open modal
        api.get(`/feedback/course/${courseId}/mine`).then((data: any) => {
          if (!data?.submitted) setShowFeedback(true);
        }).catch(() => {/* ignore */});
      }

      return next;
    });
    updateProgress({ courseId, lessonId, data: { isCompleted: true, watchedSeconds } });
  }, [courseId, updateProgress, api]);

  const handleVideoProgress = (progress: { playedSeconds: number }) => {
    if (!lesson || lesson.isCompleted) return;
    pingMediaActivity();
    const isComplete = progress.playedSeconds > (lesson.duration * 0.9);
    if (isComplete) {
      markCompleted(lesson.id, Math.floor(progress.playedSeconds));
    } else {
      updateProgress({
        courseId,
        lessonId: lesson.id,
        data: { isCompleted: false, watchedSeconds: Math.floor(progress.playedSeconds) }
      });
    }
  };

  const handleEnded = () => {
    if (lesson) {
      markCompleted(lesson.id, lesson.duration);
    }
  };

  const handleDownloadDocument = async (url: string, filename: string) => {
    try {
      toast({ title: language === 'ar' ? 'جارٍ التنزيل...' : 'Downloading...', description: language === 'ar' ? 'يُرجى الانتظار' : 'Please wait while the file is prepared.' });
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch {
      toast({ title: language === 'ar' ? 'فشل التنزيل' : 'Download failed', description: language === 'ar' ? 'سيتم فتح الملف في علامة تبويب جديدة' : 'Opening directly in a new tab instead.', variant: 'destructive' });
      window.open(url, '_blank');
    }
  };

  const formatDuration = (secs: number): string => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  // ── Completion trigger: show review modal when course finishes ─────────
  useEffect(() => {
    if (course && (course.userProgress || 0) >= 100 && !completionFired.current) {
      completionFired.current = true;
      api.get(`/feedback/course/${courseId}/mine`).then((data: any) => {
        if (!data?.submitted) setShowFeedback(true);
      }).catch(() => {/* ignore */});
    }
  }, [course?.userProgress]);

  const handleFeedbackSubmit = async (rating: number, comment: string) => {
    await api.post(`/feedback/course/${courseId}`, { rating, comment });
  };

  const submitReport = async (data: any) => {
    if (!lesson) return;
    try {
      await api.post('/reports', {
        type: 'lesson',
        targetId: lesson.id,
        reportedUserId: course?.teacherId,
        reason: data.reason,
        description: data.description,
      });
      toast({ title: 'Report submitted. Thank you for your feedback.' });
      setReportLesson(false);
      resetReport();
    } catch (err: any) {
      toast({ title: 'Error submitting report', description: err.message, variant: 'destructive' });
    }
  };

  if (courseLoading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading learning environment...</div>;
  if (!course || !course.isEnrolled) return null;

  // Determine if the currently active lesson is completed (local state takes precedence)
  const activeIsCompleted = activeLessonId ? completedIds.has(activeLessonId) : false;

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link href={`/courses/${courseId}`}>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full">
              <ChevronLeft className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </Button>
          </Link>
          <div className="h-6 w-px bg-border"></div>
          <h1 className="font-display font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
            {language === 'ar' ? course.titleAr : course.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:flex gap-1 text-muted-foreground hover:text-destructive" onClick={() => setReportLesson(true)}>
            <Flag className="w-4 h-4" /> Report
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-black/5 flex flex-col relative z-0">
          {lessonLoading ? (
            <div className="flex-1 flex items-center justify-center">Loading lesson...</div>
          ) : lesson ? (
            <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex-1">

              {/* ── Video Lesson ─────────────────────────────────── */}
              {lesson.type === 'video' && ((lesson as any).hasVideo || lesson.videoUrl || lesson.videoFilePath) ? (
                <>
                  <div className="mb-8">
                    <ProtectedPlayer
                      url={lesson.videoUrl || lesson.videoFilePath || ''}
                      courseId={courseId}
                      lessonId={lesson.id}
                      startAt={lesson.watchedSeconds || 0}
                      onProgress={handleVideoProgress}
                      onEnded={handleEnded}
                      antiSkip={(course as any)?.certificateMode && (course as any).certificateMode !== 'none'}
                    />
                    {(course as any)?.certificateMode && (course as any).certificateMode !== 'none' && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {language === 'ar'
                          ? '🎓 دورة بشهادة — يجب مشاهدة الدروس كاملة بدون تخطي أو تسريع'
                          : '🎓 Certificate course — lessons must be watched fully, no skipping or fast-forward'}
                      </p>
                    )}
                  </div>
                  <div className="mt-8 bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <h3 className="font-display font-bold text-2xl mb-4">{language === 'ar' ? lesson.titleAr : lesson.title}</h3>
                    {lesson.content && (
                      <div className="prose prose-sm dark:prose-invert max-w-none mt-4 text-muted-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(language === 'ar' ? lesson.contentAr! : lesson.content) }} />
                    )}
                  </div>
                </>

              ) : lesson.type === 'text' ? (
                /* ── Document / Text Lesson ─────────────────────── */
                <div className="bg-card rounded-2xl p-8 shadow-sm border border-border min-h-[50vh] flex flex-col">
                  <h2 className="font-display text-3xl mb-6 mt-0">{language === 'ar' ? lesson.titleAr : lesson.title}</h2>

                  {((lesson as any).secureDocUrl || lesson.documentFilePath) && (() => {
                    // CONTENT PROTECTION: documents are served through the
                    // tokenized secure-doc proxy (raw URL never exposed);
                    // viewing is inline-only — no download button.
                    const docUrl = (lesson as any).secureDocUrl || lesson.documentFilePath!;
                    const docName = lesson.documentFileName || 'document';
                    const fileExt = docName.split('.').pop()?.toLowerCase() || '';
                    const isFilePdf = fileExt === 'pdf' || isPdf(docName);

                    return (
                      <div className="mb-8 w-full flex-1 flex flex-col">
                        {isFilePdf ? (
                          <div className="w-full flex-1 flex flex-col gap-3">
                            <div className="w-full flex-1 rounded-xl overflow-hidden border border-border" style={{ minHeight: '65vh' }}>
                              <iframe
                                src={docUrl}
                                className="w-full h-full"
                                style={{ minHeight: '65vh' }}
                                title={docName}
                                allow="fullscreen"
                              />
                            </div>
                            {/* Fallback for browsers whose built-in PDF viewer is disabled */}
                            <p className="text-xs text-muted-foreground text-center">
                              {language === 'ar' ? 'لا يظهر الملف؟ ' : "Can't see the file? "}
                              <button
                                type="button"
                                className="text-primary font-medium underline underline-offset-2"
                                onClick={() => window.open(docUrl, '_blank', 'noopener')}
                              >
                                {language === 'ar' ? 'افتحه في تبويب جديد' : 'Open it in a new tab'}
                              </button>
                            </p>
                          </div>
                        ) : (
                          /* Non-PDF document: open inline via the secure proxy */
                          <div className="bg-muted p-8 rounded-xl flex flex-col sm:flex-row items-center justify-between border border-border gap-6 text-center sm:text-start">
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                                {getDocIcon(docName)}
                              </div>
                              <div>
                                <h3 className="font-bold text-lg">{docName}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {language === 'ar' ? 'مادة محمية — للعرض داخل المنصة' : 'Protected material — view inside the platform'}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="lg"
                              className="gap-2 shrink-0"
                              onClick={() => window.open(docUrl, '_blank', 'noopener')}
                            >
                              {language === 'ar' ? 'عرض الملف' : 'View file'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {lesson.content && (
                    <div className="prose prose-slate dark:prose-invert max-w-none mt-4"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((language === 'ar' ? lesson.contentAr : lesson.content) || '') }}
                    />
                  )}

                  {/* Mark as Completed button for doc/text lessons */}
                  {!activeIsCompleted && (
                    <div className="mt-8 pt-8 border-t border-border flex justify-end">
                      <Button
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2"
                        onClick={() => markCompleted(lesson.id, 0)}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        {language === 'ar' ? 'تحديد كمكتمل' : 'Mark as Completed'}
                      </Button>
                    </div>
                  )}

                  {activeIsCompleted && (
                    <div className="mt-8 pt-8 border-t border-border flex justify-end">
                      <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                        <CheckCircle2 className="w-5 h-5" />
                        {language === 'ar' ? 'مكتمل' : 'Lesson completed'}
                      </div>
                    </div>
                  )}
                </div>

              ) : (
                /* Fallback: no video, no document */
                <div className="bg-card rounded-2xl p-12 text-center border border-border">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold">{language === 'ar' ? 'المحتوى غير متاح' : 'Content unavailable'}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {language === 'ar' ? 'لم يقم المعلم بتحميل أي محتوى لهذا الدرس بعد.' : 'The teacher has not uploaded content for this lesson yet.'}
                  </p>
                </div>
              )}

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              {language === 'ar' ? 'اختر درسًا للبدء' : 'Select a lesson to begin'}
            </div>
          )}
        </main>

        {/* Sidebar Curriculum */}
        <aside className={`absolute inset-y-0 end-0 w-80 bg-card border-s border-border transform transition-transform duration-300 z-10 lg:relative lg:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-border shrink-0 bg-muted/30">
            <h3 className="font-bold text-foreground mb-2">
              {language === 'ar' ? 'محتوى الدورة' : 'Course Content'}
            </h3>
            <div className="w-full bg-secondary/20 rounded-full h-2 mb-1 overflow-hidden">
              <div className="bg-secondary h-2 rounded-full" style={{ width: `${course.userProgress || 0}%` }}></div>
            </div>
            <div className="text-xs text-muted-foreground text-end">
              {Math.round(course.userProgress || 0)}% {language === 'ar' ? 'مكتمل' : 'Complete'}
            </div>
            {(course as any)?.certificateMode && (course as any).certificateMode !== 'none' && (
              <CertificateClaim courseId={courseId} language={language} />
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {course.lessons.map((l, idx) => {
              const isActive = activeLessonId === l.id;
              const isDone = completedIds.has(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => setActiveLessonId(l.id)}
                  className={`w-full text-start p-3 rounded-xl flex gap-3 transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
                >
                  {/* Type icon */}
                  <div className="mt-0.5 shrink-0">
                    {l.type === 'video'
                      ? <PlayCircle className={`w-4 h-4 ${isDone ? 'text-green-500' : ''}`} />
                      : <FileText className={`w-4 h-4 ${isDone ? 'text-green-500' : ''}`} />
                    }
                  </div>
                  {/* Title + duration */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium line-clamp-2 leading-tight ${isActive ? 'text-primary' : ''}`}>
                      {idx + 1}. {language === 'ar' ? l.titleAr : l.title}
                    </div>
                    <div className="text-xs opacity-70 mt-1">{formatDuration(l.duration)}</div>
                  </div>
                  {/* Completion checkmark */}
                  {isDone && (
                    <div className="shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Report Lesson Modal */}
      <Dialog open={reportLesson} onOpenChange={setReportLesson}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReportSubmit(submitReport)} className="space-y-4 mt-4">
            <div className="text-sm mb-4">You are reporting the lesson <span className="font-bold">{language === 'ar' ? lesson?.titleAr : lesson?.title}</span>. Please select a reason below.</div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason *</label>
              <select {...registerReport('reason', { required: true })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select a reason</option>
                <option value="wrong_content">Wrong / Incorrect Content</option>
                <option value="technical_issue">Technical Issue (Video not playing, etc.)</option>
                <option value="offensive">Offensive Content</option>
                <option value="copyright">Copyright Violation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description (optional)</label>
              <Textarea {...registerReport('description')} placeholder="Please provide more details..." rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setReportLesson(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" className="flex-1">Submit Report</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <FeedbackModal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSubmit={handleFeedbackSubmit}
        title={completionFired.current ? '🎓 Course Complete!' : '⭐ How is the course?'}
        subtitle={
          completionFired.current
            ? 'Congratulations! Leave a review to help other students.'
            : 'You\'ve watched a few lessons — what do you think so far?'
        }
      />
    </div>
  );
}

// ─── Certificate claim widget (certificate courses only) ─────────────────────
function CertificateClaim({ courseId, language }: { courseId: number; language: string }) {
  const isAr = language === 'ar';
  const [state, setState] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    const token = localStorage.getItem('lms_token');
    fetch(`/api/certificates/courses/${courseId}/eligibility`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState(null));
  }, [courseId]);

  React.useEffect(load, [load]);

  if (!state?.available) return null;

  if (state.issued && state.certificate) {
    return (
      <a
        href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/certificate/${state.certificate.code}`}
        className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-600 text-xs font-bold hover:bg-amber-500/20 transition-colors"
      >
        🎓 {isAr ? 'عرض شهادتك' : 'View your certificate'}
      </a>
    );
  }

  const claim = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem('lms_token');
      const res = await fetch(`/api/certificates/courses/${courseId}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(isAr ? (data.messageAr || data.error) : (data.message || data.error));
      } else {
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      {state.eligible ? (
        <button
          onClick={claim}
          disabled={busy}
          className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold shadow hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          🎓 {busy ? '…' : isAr ? 'احصل على شهادتك الآن' : 'Claim your certificate'}
        </button>
      ) : (
        <div className="text-[11px] text-muted-foreground text-center bg-muted/40 rounded-lg py-2 px-2">
          {isAr
            ? `🎓 شهادة متاحة — شاهد كل الدروس كاملة${state.mode === 'quiz' ? ' واجتز الاختبار النهائي' : ''} (${state.watch?.fullyWatched ?? 0}/${state.watch?.totalLessons ?? 0})`
            : `🎓 Certificate available — watch all lessons fully${state.mode === 'quiz' ? ' and pass the final quiz' : ''} (${state.watch?.fullyWatched ?? 0}/${state.watch?.totalLessons ?? 0})`}
        </div>
      )}
    </div>
  );
}
