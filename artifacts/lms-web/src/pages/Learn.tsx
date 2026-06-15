import React, { useState, useEffect } from 'react';
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
  
  const { toast } = useToast();
  const api = useApi();
  const { register: registerReport, handleSubmit: handleReportSubmit, reset: resetReport } = useForm();

  const { data: course, isLoading: courseLoading } = useGetCourse(courseId, { query: { queryKey: ['/api/courses', courseId], enabled: !!courseId } });
  
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

  const handleVideoProgress = (progress: { playedSeconds: number }) => {
    if (!lesson || lesson.isCompleted) return;
    
    // Signal to the inactivity timer that the user is actively watching
    pingMediaActivity();
    
    // Mark complete if 90% watched. lesson.duration is in seconds.
    const isComplete = progress.playedSeconds > (lesson.duration * 0.9);
    
    updateProgress({
      courseId,
      lessonId: lesson.id,
      data: { isCompleted: isComplete, watchedSeconds: Math.floor(progress.playedSeconds) }
    });
  };

  const handleEnded = () => {
    if (lesson && !lesson.isCompleted) {
      updateProgress({
        courseId,
        lessonId: lesson.id,
        data: { isCompleted: true, watchedSeconds: lesson.duration }
      });
    }
  };

  const handleDownloadDocument = async (url: string, filename: string) => {
    try {
      toast({ title: "Downloading...", description: "Please wait while the file is prepared." });
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch (err: any) {
      toast({ title: "Download failed", description: "Opening directly in a new tab instead.", variant: "destructive" });
      window.open(url, '_blank');
    }
  };

  const formatDuration = (secs: number): string => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
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
              {lesson.type === 'video' && (lesson.videoUrl || lesson.videoFilePath) ? (
                <div className="mb-8">
                  <ProtectedPlayer 
                    url={(lesson.videoUrl || lesson.videoFilePath)!} 
                    courseId={courseId}
                    lessonId={lesson.id}
                    startAt={lesson.watchedSeconds || 0}
                    onProgress={handleVideoProgress}
                    onEnded={handleEnded}
                  />
                </div>
              ) : lesson.type === 'text' ? (
                <div className="bg-card rounded-2xl p-8 shadow-sm border border-border protection-overlay min-h-[50vh] flex flex-col">
                  <h2 className="font-display text-3xl mb-6 mt-0">{language === 'ar' ? lesson.titleAr : lesson.title}</h2>
                  
                  {lesson.documentFilePath && (
                    <div className="mb-8 w-full flex-1 min-h-[60vh] flex flex-col">
                      {lesson.documentFilePath.toLowerCase().endsWith('.pdf') ? (
                        <div className="w-full flex-1 rounded-xl overflow-hidden border border-border">
                          <iframe 
                            src={lesson.documentFilePath} 
                            className="w-full h-full min-h-[60vh]" 
                            title={lesson.documentFileName || 'PDF Document'}
                          />
                        </div>
                      ) : (
                        <div className="bg-muted p-8 rounded-xl flex flex-col sm:flex-row items-center justify-between border border-border my-auto gap-6 text-center sm:text-start">
                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary shrink-0">
                              <FileText className="w-8 h-8" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{lesson.documentFileName || 'Attached Document'}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {language === 'ar' ? 'قم بتنزيل الملف لعرضه' : 'Download the file to view its contents'}
                              </p>
                            </div>
                          </div>
                          <Button 
                            size="lg" 
                            className="gap-2 shrink-0"
                            onClick={() => handleDownloadDocument(lesson.documentFilePath!, lesson.documentFileName || 'document')}
                          >
                            <Download className="w-5 h-5" /> {language === 'ar' ? 'تنزيل' : 'Download'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {lesson.content && (
                    <div className="prose prose-slate dark:prose-invert max-w-none mt-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((language === 'ar' ? lesson.contentAr : lesson.content) || '') }} />
                  )}
                  
                  {!lesson.isCompleted && (
                    <div className="mt-8 pt-8 border-t border-border flex justify-end">
                      <Button 
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                        onClick={() => updateProgress({ courseId, lessonId: lesson.id, data: { isCompleted: true, watchedSeconds: 0 }})}
                      >
                        <CheckCircle2 className="w-5 h-5 me-2" />
                        {language === 'ar' ? 'تحديد كمكتمل' : 'Mark as Completed'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-card rounded-2xl p-12 text-center border border-border">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold">Content unavailable</h3>
                </div>
              )}
              
              {lesson.type === 'video' && (
                <div className="mt-8 bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <h3 className="font-display font-bold text-2xl mb-4">{language === 'ar' ? lesson.titleAr : lesson.title}</h3>
                  {lesson.content && (
                    <div className="prose prose-sm dark:prose-invert max-w-none mt-4 text-muted-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(language === 'ar' ? lesson.contentAr! : lesson.content) }} />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a lesson to begin</div>
          )}
        </main>

        {/* Sidebar Curriculum */}
        <aside className={`absolute inset-y-0 end-0 w-80 bg-card border-s border-border transform transition-transform duration-300 z-10 lg:relative lg:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-border shrink-0 bg-muted/30">
            <h3 className="font-bold text-foreground mb-2">Course Content</h3>
            <div className="w-full bg-secondary/20 rounded-full h-2 mb-1 overflow-hidden">
              <div className="bg-secondary h-2 rounded-full" style={{ width: `${course.userProgress || 0}%` }}></div>
            </div>
            <div className="text-xs text-muted-foreground text-end">{Math.round(course.userProgress || 0)}% Complete</div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {course.lessons.map((l, idx) => {
              const isActive = activeLessonId === l.id;
              // We don't have isCompleted in LessonSummary strictly, assuming we might need to fetch full list to get accurate status or pass it down. 
              // For UI demonstration, we'll use a placeholder or rely on active state heavily.
              return (
                <button
                  key={l.id}
                  onClick={() => setActiveLessonId(l.id)}
                  className={`w-full text-start p-3 rounded-xl flex gap-3 transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {l.type === 'video' ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium line-clamp-2 leading-tight ${isActive ? 'text-primary' : ''}`}>
                      {idx + 1}. {language === 'ar' ? l.titleAr : l.title}
                    </div>
                    <div className="text-xs opacity-70 mt-1">{formatDuration(l.duration)}</div>
                  </div>
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
    </div>
  );
}
