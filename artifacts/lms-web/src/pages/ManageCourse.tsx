import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link, useParams } from 'wouter';
import {
  Plus, Edit, Trash2, ArrowLeft, Video, FileText, Upload,
  Eye, EyeOff, Clock, ChevronUp, ChevronDown, ChevronRight, FolderOpen, Layers, Paperclip, BookOpen, SendHorizonal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { useMediaActivity } from '@/contexts/MediaActivityContext';
import { Badge } from '@/components/ui/badge';

export default function ManageCourse() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const api = useApi();
  const { setMediaActive } = useMediaActivity();

  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollCount, setEnrollCount] = useState(0);

  // Modals
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [deletingSection, setDeletingSection] = useState<any>(null);
  const [deletingLesson, setDeletingLesson] = useState<any>(null);

  // File upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);

  // Sync upload state to media activity so the inactivity timer never fires during a long upload
  useEffect(() => {
    setMediaActive(uploading);
    return () => setMediaActive(false);
  }, [uploading]);

  // Expanded sections
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      setDraggedSectionId(null);
    };
    const handleGlobalDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) {
        setDraggedSectionId(null);
      }
    };

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    window.addEventListener('dragleave', handleGlobalDragLeave);

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
      window.removeEventListener('dragleave', handleGlobalDragLeave);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { setLocation('/login'); return; }
    if (user && user.role !== 'teacher') { setLocation('/dashboard'); return; }
  }, [isAuthenticated, authLoading, user]);

  const loadData = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const [courseData, sectionsData] = await Promise.all([
        api.get(`/courses/${courseId}`),
        api.get(`/courses/${courseId}/sections`),
      ]);
      setCourse(courseData);
      setSections(sectionsData);
      setEnrollCount(courseData.enrollmentCount || 0);
      // Expand all sections by default
      setExpanded(new Set(sectionsData.map((s: any) => s.id)));
    } catch (err: any) {
      toast({ title: 'Error loading course', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && courseId) loadData();
  }, [user, courseId]);

  // ── Section Form ────────────────────────────────────────────────
  const sectionForm = useForm({
    defaultValues: { title: '', titleAr: '', description: '', descriptionAr: '' }
  });

  const handleAddSection = async (data: any) => {
    try {
      await api.post(`/courses/${courseId}/sections`, {
        ...data,
        order: sections.length,
      });
      toast({ title: 'Section added!' });
      setIsAddSectionOpen(false);
      sectionForm.reset();
      loadData();
    } catch (err: any) {
      toast({ title: 'Error adding section', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateSection = async (data: any) => {
    if (!editingSection) return;
    try {
      await api.put(`/courses/${courseId}/sections/${editingSection.id}`, {
        ...data,
        order: editingSection.order,
      });
      toast({ title: 'Section updated!' });
      setEditingSection(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error updating section', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteSection = async (section: any) => {
    try {
      await api.del(`/courses/${courseId}/sections/${section.id}`);
      toast({ title: 'Section deleted' });
      setDeletingSection(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEditSection = (section: any) => {
    setEditingSection(section);
    sectionForm.reset({
      title: section.title, titleAr: section.titleAr,
      description: section.description || '', descriptionAr: section.descriptionAr || '',
    });
  };

  // ── Lesson Form ─────────────────────────────────────────────────
  const lessonForm = useForm({
    defaultValues: {
      title: '', titleAr: '', videoUrl: '', videoFilePath: '', documentFilePath: '', documentFileName: '',
      content: '', contentAr: '', duration: 0, isFree: false, type: 'video',
      bookName: '', bookNameAr: '', schoolYear: '', chapter: '', pageNumber: '', subjectTags: '',
    }
  });

  const uploadFileToServer = (file: File, type: 'video' | 'document', onProgress?: (percent: number) => void): Promise<any> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append(type, file);
      const token = localStorage.getItem('lms_token');
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload/${type}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            resolve({});
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || 'Upload failed'));
          } catch (err) {
            reject(new Error('Upload failed'));
          }
        }
      };
      
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  };

  const handleQuickUpload = async (sectionId: number, files: File[]) => {
    const validFiles = files.filter(f => 
      f.type.startsWith('video/') || 
      f.type.startsWith('text/') ||
      f.name.match(/\.(mp4|webm|mov|mkv|avi|wmv|pdf|txt|doc|docx|xls|xlsx|ppt|pptx)$/i)
    );
    if (!validFiles.length) {
      toast({ title: 'Unsupported file type. Only videos, PDFs, Text, and Office documents are allowed.', variant: 'destructive' });
      return;
    }

    const sectionLessons = sections.find(s => s.id === sectionId)?.lessons || [];
    let startOrder = sectionLessons.length;

    for (const file of validFiles) {
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv|avi|wmv)$/i);
      const typeStr = isVideo ? 'video' : 'document';
      const lessonType = isVideo ? 'video' : 'text';

      setUploading(true);
      setUploadProgressPercent(0);
      setUploadProgress(`Uploading ${file.name}...`);
      try {
        const result = await uploadFileToServer(file, typeStr, (p) => setUploadProgressPercent(p));
        const title = file.name.replace(/\.[^/.]+$/, "");
        setUploadProgressPercent(100);
        setUploadProgress(`Creating lesson...`);
        await api.post(`/courses/${courseId}/sections/${sectionId}/lessons`, {
          title: title,
          titleAr: title,
          videoFilePath: isVideo ? result.url : '',
          documentFilePath: !isVideo ? result.url : '',
          documentFileName: !isVideo ? result.fileName : '',
          duration: result.duration || 0,
          order: startOrder++,
          isFree: false,
          type: lessonType
        });
        toast({ title: `✓ Added "${title}"` });
      } catch (err: any) {
        toast({ title: `Failed to upload ${file.name}`, description: err.message, variant: 'destructive' });
      }
    }
    // Brief delay at 100% so the teacher can see it finished
    await new Promise(r => setTimeout(r, 800));
    setUploading(false);
    setUploadProgress('');
    setUploadProgressPercent(0);
    // Only expand the section if it isn't already open
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
    loadData();
  };

  const handleUpdateLesson = async (data: any) => {
    if (!editingLesson) return;
    try {
      setUploading(true);
      let videoFilePath = data.videoFilePath || '';
      let documentFilePath = data.documentFilePath || '';
      let documentFileName = data.documentFileName || '';
      let duration = parseInt(data.duration) || 0;

      if (videoFile) {
        setUploadProgressPercent(0);
        setUploadProgress('Uploading video...');
        const result = await uploadFileToServer(videoFile, 'video', (p) => setUploadProgressPercent(p));
        videoFilePath = result.url;
        if (result.duration) duration = result.duration;
      }
      if (documentFile) {
        setUploadProgressPercent(0);
        setUploadProgress('Uploading document...');
        const result = await uploadFileToServer(documentFile, 'document', (p) => setUploadProgressPercent(p));
        documentFilePath = result.url;
        documentFileName = result.fileName;
      }

      setUploadProgressPercent(100);
      setUploadProgress('Saving...');
      await api.put(`/courses/${courseId}/lessons/${editingLesson.id}`, {
        ...data,
        videoFilePath,
        documentFilePath,
        documentFileName,
        duration,
        isFree: data.isFree === true || data.isFree === 'true',
      });
      toast({ title: 'Lesson updated!' });
      setEditingLesson(null);
      setVideoFile(null);
      setDocumentFile(null);
      // Brief delay so teacher sees 100%
      await new Promise(r => setTimeout(r, 800));
      loadData();
    } catch (err: any) {
      toast({ title: 'Error updating lesson', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress('');
      setUploadProgressPercent(0);
    }
  };

  const handleDeleteLesson = async (lesson: any) => {
    try {
      await api.del(`/courses/${courseId}/lessons/${lesson.id}`);
      toast({ title: 'Lesson deleted' });
      setDeletingLesson(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEditLesson = (lesson: any) => {
    setEditingLesson(lesson);
    lessonForm.reset({
      title: lesson.title, titleAr: lesson.titleAr,
      videoUrl: lesson.videoUrl || '', videoFilePath: lesson.videoFilePath || '',
      documentFilePath: lesson.documentFilePath || '', documentFileName: lesson.documentFileName || '',
      content: lesson.content || '',
      contentAr: lesson.contentAr || '', duration: lesson.duration,
      isFree: lesson.isFree, type: lesson.type || 'video',
      bookName: lesson.bookName || '', bookNameAr: lesson.bookNameAr || '',
      schoolYear: lesson.schoolYear || '', chapter: lesson.chapter || '',
      pageNumber: lesson.pageNumber || '', subjectTags: Array.isArray(lesson.subjectTags) ? lesson.subjectTags.join(', ') : (lesson.subjectTags || ''),
    });
    setVideoFile(null);
    setDocumentFile(null);
  };

  const handleToggleFree = async (lesson: any) => {
    try {
      await api.put(`/courses/${courseId}/lessons/${lesson.id}`, {
        title: lesson.title, titleAr: lesson.titleAr,
        videoUrl: lesson.videoUrl, content: lesson.content, contentAr: lesson.contentAr,
        duration: lesson.duration, order: lesson.order, isFree: !lesson.isFree,
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmitForReview = async () => {
    if (!window.confirm('Submit this course for admin review? You will still be able to manage lessons while it is under review.')) return;
    try {
      await api.put(`/courses/${courseId}/submit`, {});
      toast({ title: '✓ Course submitted for review!', description: 'The admin has been notified and will review your course shortly.' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error submitting course', description: err.message, variant: 'destructive' });
    }
  };

  if (authLoading || loading) {
    return <PageContainer><div className="p-20 text-center">Loading...</div></PageContainer>;
  }
  if (!user || user.role !== 'teacher') return null;

  const canDelete = true;
  const totalLessons = sections.reduce((sum, s) => sum + (s.lessons?.length || 0), 0);
  const totalDuration = sections.reduce((sum, s) =>
    sum + (s.lessons || []).reduce((ls: number, l: any) => ls + (l.duration || 0), 0), 0
  );

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  // ── Section Form UI ─────────────────────────────────────────────
  const SectionFormUI = ({ onSubmit, submitLabel }: { onSubmit: (d: any) => void; submitLabel: string }) => (
    <form onSubmit={sectionForm.handleSubmit(onSubmit)} className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Section Title (English) *</label>
          <Input {...sectionForm.register('title', { required: true })} placeholder="e.g. Introduction" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">عنوان القسم (عربي) *</label>
          <Input {...sectionForm.register('titleAr', { required: true })} dir="rtl" placeholder="مثال: المقدمة" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Description (English)</label>
        <Textarea {...sectionForm.register('description')} placeholder="Optional description..." rows={2} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">الوصف (عربي)</label>
        <Textarea {...sectionForm.register('descriptionAr')} dir="rtl" placeholder="وصف اختياري..." rows={2} />
      </div>
      <Button type="submit" className="w-full bg-primary hover:bg-primary/90">{submitLabel}</Button>
    </form>
  );

  // ── Lesson Form UI ──────────────────────────────────────────────
  const LessonFormUI = ({ onSubmit, submitLabel }: { onSubmit: (d: any) => void; submitLabel: string }) => {
    const watchType = lessonForm.watch('type');
    const watchVideoFilePath = lessonForm.watch('videoFilePath');
    const watchDocFileName = lessonForm.watch('documentFileName');
    return (
    <form onSubmit={lessonForm.handleSubmit(onSubmit)} className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Lesson Title (EN) *</label>
          <Input {...lessonForm.register('title', { required: true })} placeholder="e.g. What is Algebra?" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">عنوان الدرس (عربي) *</label>
          <Input {...lessonForm.register('titleAr', { required: true })} dir="rtl" placeholder="ما هو الجبر؟" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Lesson Type</label>
        <select {...lessonForm.register('type')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
          <option value="video">🎬 Video</option>
          <option value="text">📄 Text / Article</option>
        </select>
      </div>

      {/* Video Upload */}
      {watchType === 'video' && (
        <div>
          <label className="text-sm font-medium mb-1 block">Upload Video (HD resolution or higher)</label>
          <div
            className="border-2 border-dashed border-primary/40 rounded-xl p-4 text-center cursor-pointer hover:border-primary/70 hover:bg-primary/5 transition-colors"
            onClick={() => document.getElementById('video-upload-input')?.click()}
          >
            <Upload className="w-8 h-8 text-primary/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {videoFile
                ? `${videoFile.name} (${(videoFile.size / (1024 * 1024)).toFixed(1)} MB)`
                : watchVideoFilePath
                  ? '✓ Video uploaded — click to replace'
                  : 'Click to select video (MP4, WebM, MOV — max 100MB)'}
            </p>
          </div>
          <input
            id="video-upload-input"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={e => {
              if (e.target.files?.[0]) setVideoFile(e.target.files[0]);
            }}
          />
        </div>
      )}

      {/* Document Upload */}
      {watchType === 'text' && (
        <div>
          <label className="text-sm font-medium mb-1 block">Upload Document (PDF, TXT, Word, Excel, PPT — max 20MB)</label>
          <div
            className="border-2 border-dashed border-primary/40 rounded-xl p-4 text-center cursor-pointer hover:border-primary/70 hover:bg-primary/5 transition-colors"
            onClick={() => document.getElementById('doc-upload-input')?.click()}
          >
            <Paperclip className="w-8 h-8 text-primary/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {documentFile
                ? `${documentFile.name} (${(documentFile.size / (1024 * 1024)).toFixed(1)} MB)`
                : watchDocFileName
                  ? `✓ ${watchDocFileName}`
                  : 'Click to select a document (PDF, TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX)'}
            </p>
          </div>
          <input
            id="doc-upload-input"
            type="file"
            accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            onChange={e => {
              if (e.target.files?.[0]) setDocumentFile(e.target.files[0]);
            }}
          />
        </div>
      )}

      <div>
        <label className="text-sm font-medium mb-1 block">Reference Link (optional)</label>
        <Input {...lessonForm.register('videoUrl')} type="url" placeholder="https://example.com/..." />
        <p className="text-xs text-muted-foreground mt-1">External link for additional info or references</p>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Content / Notes (EN)</label>
        <Textarea {...lessonForm.register('content')} placeholder="Additional notes..." rows={2} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">المحتوى / الملاحظات (عربي)</label>
        <Textarea {...lessonForm.register('contentAr')} dir="rtl" placeholder="ملاحظات إضافية..." rows={2} />
      </div>

      {/* ── Lesson Metadata (Search & Discovery) ──────────────── */}
      <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
          <BookOpen className="w-4 h-4" /> Lesson Metadata / بيانات الدرس
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Book Name (EN)</label>
            <Input {...lessonForm.register('bookName')} placeholder="e.g. Mathematics Grade 3" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">اسم الكتاب (عربي)</label>
            <Input {...lessonForm.register('bookNameAr')} dir="rtl" placeholder="مثال: الرياضيات الصف الثالث" className="h-9 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block">School Year / السنة</label>
            <select {...lessonForm.register('schoolYear')} className="w-full h-9 px-2 rounded-md border border-input bg-background text-xs">
              <option value="">— Select —</option>
              <option value="1-primary">1st Primary / أول ابتدائي</option>
              <option value="2-primary">2nd Primary / ثاني ابتدائي</option>
              <option value="3-primary">3rd Primary / ثالث ابتدائي</option>
              <option value="4-primary">4th Primary / رابع ابتدائي</option>
              <option value="5-primary">5th Primary / خامس ابتدائي</option>
              <option value="6-primary">6th Primary / سادس ابتدائي</option>
              <option value="1-preparatory">1st Prep / أول إعدادي</option>
              <option value="2-preparatory">2nd Prep / ثاني إعدادي</option>
              <option value="3-preparatory">3rd Prep / ثالث إعدادي</option>
              <option value="1-secondary">1st Secondary / أول ثانوي</option>
              <option value="2-secondary">2nd Secondary / ثاني ثانوي</option>
              <option value="3-secondary">3rd Secondary / ثالث ثانوي</option>
              <option value="university">University / جامعي</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Chapter / الفصل</label>
            <Input {...lessonForm.register('chapter')} placeholder="e.g. Chapter 3" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Page # / الصفحة</label>
            <Input type="number" min="1" {...lessonForm.register('pageNumber')} placeholder="42" className="h-9 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Subject Tags / الموضوعات</label>
          <Input {...lessonForm.register('subjectTags')} placeholder="algebra, equations, quadratic (comma separated)" className="h-9 text-sm" />
          <p className="text-xs text-muted-foreground mt-1">Helps students find this lesson via search</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Duration (seconds)</label>
          <Input type="number" min="0" {...lessonForm.register('duration', { valueAsNumber: true })} placeholder="600" />
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...lessonForm.register('isFree')} className="w-4 h-4 rounded" />
            <span className="text-sm font-medium">Free Preview</span>
          </label>
          <p className="text-xs text-muted-foreground mt-1">Students can watch without enrolling</p>
        </div>
      </div>

      {uploading && (
        <div className="flex items-center gap-3 bg-primary/10 rounded-xl p-3">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm font-medium text-primary">{uploadProgress}</span>
        </div>
      )}

      <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={uploading}>
        {uploading ? uploadProgress : submitLabel}
      </Button>
    </form>
  );
  };

  return (
    <PageContainer>
      {/* Global Upload Progress Overlay */}
      {uploading && (
        <div className="fixed bottom-6 right-6 w-80 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden z-50 animate-in slide-in-from-bottom-5">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {uploadProgressPercent < 100 ? (
                  <Upload className="w-4 h-4 text-primary animate-bounce" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{uploadProgress}</p>
                <p className="text-xs text-muted-foreground">{uploadProgressPercent}%</p>
              </div>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${uploadProgressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-primary/5 py-8 border-b border-primary/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/teacher/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 mb-4 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold">{course?.title}</h1>
              <p className="text-muted-foreground text-sm mt-1" dir="rtl">{course?.titleAr}</p>
              <div className="flex gap-3 mt-3 flex-wrap">
                <Badge variant="outline" className="gap-1"><Layers className="w-3 h-3" /> {sections.length} sections</Badge>
                <Badge variant="outline" className="gap-1"><Video className="w-3 h-3" /> {totalLessons} lessons</Badge>
                <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> {formatDuration(totalDuration)}</Badge>
                <Badge className={course?.isPublished ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}>
                  {course?.isPublished ? '✓ Published' : '⏸ Draft'}
                </Badge>
                {enrollCount > 0 && (
                  <Badge variant="secondary" className="gap-1">👥 {enrollCount} students enrolled</Badge>
                )}
              </div>
            </div>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
              onClick={() => {
                setIsAddSectionOpen(true);
                sectionForm.reset({ title: '', titleAr: '', description: '', descriptionAr: '' });
              }}
            >
              <Plus className="w-4 h-4" /> Add Section
            </Button>
          </div>
        </div>
      </div>

      {/* Submit for Review Banner (shows when draft and has lessons) */}
      {(course?.status === 'draft' || course?.status === 'rejected') && totalLessons > 0 && (
        <div className={`border-b ${
          course?.status === 'rejected'
            ? 'bg-red-50 border-red-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                course?.status === 'rejected' ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                <SendHorizonal className={`w-5 h-5 ${
                  course?.status === 'rejected' ? 'text-red-600' : 'text-blue-600'
                }`} />
              </div>
              <div>
                <p className={`font-bold text-sm ${
                  course?.status === 'rejected' ? 'text-red-800' : 'text-blue-800'
                }`}>
                  {course?.status === 'rejected'
                    ? '✗ Course Rejected — Fix & Resubmit'
                    : '🎉 Your course is ready! Submit it for admin review.'}
                </p>
                <p className={`text-xs mt-0.5 ${
                  course?.status === 'rejected' ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {course?.status === 'rejected'
                    ? (course?.rejectionReason ? `Reason: ${course.rejectionReason}` : 'Please review the feedback and resubmit.')
                    : `${totalLessons} lesson${totalLessons !== 1 ? 's' : ''} ready — the admin will review and publish it.`}
                </p>
              </div>
            </div>
            <Button
              className={`shrink-0 gap-2 text-white shadow-sm ${
                course?.status === 'rejected'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              onClick={handleSubmitForReview}
            >
              <SendHorizonal className="w-4 h-4" />
              {course?.status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
            </Button>
          </div>
        </div>
      )}

      {/* Under Review Banner */}
      {course?.status === 'pending_review' && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm text-amber-800">
              <span className="font-bold">⏳ Under Review</span> — Your course is currently being reviewed by the admin. You will be notified once it is approved.
            </p>
          </div>
        </div>
      )}

      {/* Sections List */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Enrollment deletion restriction removed */}
        {sections.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
            <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">No sections yet</h3>
            <p className="text-muted-foreground mt-2 mb-6">Create your first section to organize your course content.</p>
            <Button onClick={() => setIsAddSectionOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add First Section
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section, sIdx) => {
              const isOpen = expanded.has(section.id);
              const sectionLessons = section.lessons || [];

              return (
                <div 
                  key={section.id} 
                  className={`bg-card rounded-2xl border ${draggedSectionId === section.id ? 'border-primary ring-4 ring-primary/20' : 'border-border'} shadow-sm overflow-hidden relative transition-all duration-200`}
                  onDragOver={e => e.preventDefault()}
                  onDragEnter={e => {
                    e.preventDefault();
                    if (e.dataTransfer.types.includes('Files')) {
                      setDraggedSectionId(section.id);
                    }
                  }}
                  onDragLeave={e => {
                    e.preventDefault();
                    // If the overlay is active, let the overlay handle its own dragLeave
                    // Only clear here if we truly left this card's DOM boundary
                    if (draggedSectionId === section.id) return;
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDraggedSectionId(null);
                    }
                  }}
                  onDrop={e => {
                    // Fallback in case overlay is missed
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggedSectionId(null);
                    if (e.dataTransfer.files?.length) {
                      handleQuickUpload(section.id, Array.from(e.dataTransfer.files));
                    }
                  }}
                >
                  {/* WhatsApp-style full-section drag overlay */}
                  {draggedSectionId === section.id && (
                    <div 
                      className="absolute inset-0 z-50 bg-primary/95 backdrop-blur-sm flex flex-col items-center justify-center text-primary-foreground animate-in fade-in duration-200"
                      onDragEnter={e => e.preventDefault()}
                      onDragOver={e => e.preventDefault()}
                      onDragLeave={e => {
                        e.preventDefault();
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDraggedSectionId(null);
                        }
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraggedSectionId(null);
                        if (e.dataTransfer.files?.length) {
                          handleQuickUpload(section.id, Array.from(e.dataTransfer.files));
                        }
                      }}
                    >
                      <div className="p-6 bg-primary-foreground/10 rounded-full mb-4 pointer-events-none">
                        <Upload className="w-16 h-16 text-primary-foreground animate-bounce pointer-events-none" />
                      </div>
                      <h3 className="text-3xl font-bold font-display pointer-events-none">Drop to Upload</h3>
                      <p className="text-primary-foreground/80 mt-2 text-lg pointer-events-none">Lessons will be auto-created in "{section.title}"</p>
                    </div>
                  )}

                  {/* Section Header */}
                  <div
                    className="flex items-center gap-3 p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleExpand(section.id)}
                  >
                    <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {sIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base">{section.title}</h3>
                      <p className="text-xs text-muted-foreground" dir="rtl">{section.titleAr}</p>
                    </div>
                    <Badge variant="secondary" className="gap-1 shrink-0">
                      {sectionLessons.length} lessons
                    </Badge>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditSection(section)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeletingSection(section)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Section Content (lessons) */}
                  {isOpen && (
                    <div className="border-t border-border px-5 pb-5">
                      {sectionLessons.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No lessons in this section yet
                        </div>
                      ) : (
                        <div className="space-y-2 mt-4">
                          {sectionLessons.map((lesson: any, lIdx: number) => (
                            <div key={lesson.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 hover:bg-muted/50 transition-colors">
                              <span className="text-xs text-muted-foreground font-mono w-6 text-center">{lIdx + 1}</span>
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                {lesson.type === 'video' ? <Video className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{lesson.title}</span>
                                  {lesson.isFree && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Free</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground" dir="rtl">{lesson.titleAr}</p>
                              </div>
                              {lesson.duration > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3" /> {formatDuration(lesson.duration)}
                                </span>
                              )}
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600" title={lesson.isFree ? 'Remove free' : 'Mark free'} onClick={() => handleToggleFree(lesson)}>
                                  {lesson.isFree ? <Eye className="w-3.5 h-3.5 text-blue-500" /> : <EyeOff className="w-3.5 h-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditLesson(lesson)}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeletingLesson(lesson)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4">
                        <input
                          id={`upload-${section.id}`}
                          type="file"
                          multiple
                          accept="video/mp4,video/webm,video/quicktime,video/*"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files?.length) {
                              handleQuickUpload(section.id, Array.from(e.target.files));
                            }
                            e.target.value = '';
                          }}
                        />
                        <label
                          htmlFor={`upload-${section.id}`}
                          className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-xl cursor-pointer transition-colors relative"
                          onDragEnter={e => e.preventDefault()}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.dataTransfer.files?.length) {
                              handleQuickUpload(section.id, Array.from(e.dataTransfer.files));
                            }
                          }}
                        >
                          {uploading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10" />}
                          <Upload className="w-5 h-5 text-primary opacity-60 pointer-events-none" />
                          <span className="text-sm font-medium text-foreground pointer-events-none">Drag videos here or click to upload</span>
                          <span className="text-xs text-muted-foreground pointer-events-none">Lessons will be auto-created for each video</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Section Modal */}
      <Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
        <DialogContent className="sm:max-w-[520px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Add New Section</DialogTitle>
          </DialogHeader>
          <SectionFormUI onSubmit={handleAddSection} submitLabel="Add Section" />
        </DialogContent>
      </Dialog>

      {/* Edit Section Modal */}
      <Dialog open={!!editingSection} onOpenChange={(o) => !o && setEditingSection(null)}>
        <DialogContent className="sm:max-w-[520px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Section</DialogTitle>
          </DialogHeader>
          <SectionFormUI onSubmit={handleUpdateSection} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>



      {/* Edit Lesson Modal */}
      <Dialog open={!!editingLesson} onOpenChange={(o) => !o && setEditingLesson(null)}>
        <DialogContent className="sm:max-w-[580px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Lesson</DialogTitle>
          </DialogHeader>
          <LessonFormUI onSubmit={handleUpdateLesson} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {/* Delete Section Confirmation */}
      <Dialog open={!!deletingSection} onOpenChange={(o) => !o && setDeletingSection(null)}>
        <DialogContent className="sm:max-w-[400px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Delete Section?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will permanently delete the section <strong>"{deletingSection?.title}"</strong> and all its lessons.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingSection(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deletingSection && handleDeleteSection(deletingSection)}>
              Delete Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Lesson Confirmation */}
      <Dialog open={!!deletingLesson} onOpenChange={(o) => !o && setDeletingLesson(null)}>
        <DialogContent className="sm:max-w-[400px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Delete Lesson?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">This lesson will be permanently removed.</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingLesson(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deletingLesson && handleDeleteLesson(deletingLesson)}>
              Delete Lesson
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
