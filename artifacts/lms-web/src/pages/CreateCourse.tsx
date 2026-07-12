import { PageSkeleton } from '@/components/ui/skeleton';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useGetCategories } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import {
  Upload, Video, CheckCircle2, XCircle, Loader2,
  ArrowLeft, GripVertical, Pencil, AlertTriangle,
  ChevronRight, BookOpen, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// ── Types ────────────────────────────────────────────────────────────────────
type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface LessonDraft {
  id: string;          // local UUID
  file: File;
  title: string;
  status: UploadStatus;
  progress: number;    // 0-100
  type: 'video' | 'text';
  videoFilePath: string; // cloudinary URL once uploaded
  documentFilePath?: string;
  documentFileName?: string;
  duration: number;
  isFree: boolean;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2);
}

function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')       // strip extension
    .replace(/[-_]/g, ' ')          // hyphens/underscores → spaces
    .replace(/\b\w/g, c => c.toUpperCase()); // title case
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreateCourse() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: categories } = useGetCategories();

  // Redirect if not a teacher
  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
    if (user && user.role !== 'teacher') setLocation('/dashboard');
  }, [isAuthenticated, authLoading, user]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [lessons, setLessons] = useState<LessonDraft[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sidebar course metadata
  const [courseTitle, setCourseTitle] = useState('');
  const [courseTitleAr, setCourseTitleAr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('0'); // 1-month subscription price; 0 = free course
  const [priceMonth3, setPriceMonth3] = useState('');
  const [priceMonth6, setPriceMonth6] = useState('');
  const [priceMonth12, setPriceMonth12] = useState('');

  // Inline title editing
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasVideos = lessons.length > 0;
  const allDone = lessons.length > 0 && lessons.every(l => l.status === 'done');
  const anyUploading = lessons.some(l => l.status === 'uploading' || l.status === 'pending');
  const anyErrored = lessons.some(l => l.status === 'error');
  const pricesComplete = parseFloat(price) <= 0 || (parseFloat(priceMonth3) > 0 && parseFloat(priceMonth6) > 0 && parseFloat(priceMonth12) > 0);
  const canSubmit = allDone && !anyErrored && courseTitle.trim() && categoryId && pricesComplete && !isSubmitting;

  // ── Upload helpers ─────────────────────────────────────────────────────────
  const uploadLesson = useCallback(async (draft: LessonDraft) => {
    const token = localStorage.getItem('lms_token');
    const formData = new FormData();
    const isVideo = draft.type === 'video';
    formData.append(isVideo ? 'video' : 'document', draft.file);

    setLessons(prev => prev.map(l =>
      l.id === draft.id ? { ...l, status: 'uploading', progress: 0 } : l
    ));

    try {
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 95);
            setLessons(prev => prev.map(l =>
              l.id === draft.id ? { ...l, progress: pct } : l
            ));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            setLessons(prev => prev.map(l =>
              l.id === draft.id
                ? { 
                    ...l, 
                    status: 'done', 
                    progress: 100, 
                    videoFilePath: isVideo ? result.url : '', 
                    documentFilePath: !isVideo ? result.url : undefined,
                    documentFileName: !isVideo ? result.fileName : undefined,
                    duration: result.duration || 0 
                  }
                : l
            ));
            resolve();
          } else {
            const err = JSON.parse(xhr.responseText || '{}');
            reject(new Error(err.error || `Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('POST', `/api/upload/${isVideo ? 'video' : 'document'}`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    } catch (err: any) {
      setLessons(prev => prev.map(l =>
        l.id === draft.id ? { ...l, status: 'error', error: err.message } : l
      ));
    }
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(f => 
      f.type.startsWith('video/') || 
      f.type.startsWith('text/') ||
      f.name.match(/\.(mp4|webm|mov|mkv|avi|wmv|pdf|txt|doc|docx|xls|xlsx|ppt|pptx)$/i)
    );
    if (!validFiles.length) {
      toast({ title: 'Unsupported file type. Only videos, PDFs, Text, and Office documents are allowed.', variant: 'destructive' });
      return;
    }

    const newDrafts: LessonDraft[] = validFiles.map(file => {
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv|avi|wmv)$/i);
      return {
        id: uid(),
        file,
        title: filenameToTitle(file.name),
        status: 'pending',
        progress: 0,
        type: isVideo ? 'video' : 'text',
        videoFilePath: '',
        duration: 0,
        isFree: false,
      };
    });

    setLessons(prev => [...prev, ...newDrafts]);

    // Start uploads sequentially to avoid hammering the server
    (async () => {
      for (const draft of newDrafts) {
        await uploadLesson(draft);
      }
    })();
  }, [uploadLesson, toast]);

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = (e: React.DragEvent) => {
    // Only clear drag state if we've left the drop zone entirely (not moved to a child)
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  // ── Inline title edit ──────────────────────────────────────────────────────
  const renameLesson = (id: string, title: string) => {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, title } : l));
  };

  const removeLesson = (id: string) => {
    setLessons(prev => prev.filter(l => l.id !== id));
  };

  const retryLesson = (id: string) => {
    const draft = lessons.find(l => l.id === id);
    if (draft) uploadLesson(draft);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('lms_token');
      const res = await fetch('/api/courses/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: courseTitle.trim(),
          titleAr: courseTitleAr.trim() || courseTitle.trim(),
          price: parseFloat(price) || 0,
          ...(parseFloat(price) > 0 ? {
            priceMonth1: parseFloat(price) || 0,
            priceMonth3: parseFloat(priceMonth3) || 0,
            priceMonth6: parseFloat(priceMonth6) || 0,
            priceMonth12: parseFloat(priceMonth12) || 0,
          } : {}),
          categoryId: parseInt(categoryId),
          lessons: lessons.map(l => ({
            title: l.title,
            type: l.type,
            videoFilePath: l.videoFilePath,
            documentFilePath: l.documentFilePath,
            documentFileName: l.documentFileName,
            duration: l.duration,
            isFree: l.isFree,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to create course');
      }

      toast({ title: '🎉 Course submitted for review!', description: 'Admin will review it shortly.' });
      setLocation('/teacher/dashboard');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <PageContainer><PageSkeleton /></PageContainer>;
  }
  if (!user || user.role !== 'teacher') return null;

  return (
    <PageContainer>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-4">
          <Link href="/teacher/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">New Course</h1>
              <p className="text-xs text-muted-foreground">Drop your files to get started</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left: Drop zone + lesson cards ─────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none
              ${isDragOver
                ? 'border-primary bg-primary/10 scale-[1.01]'
                : hasVideos
                  ? 'border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 py-5'
                  : 'border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 py-20'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
              className="hidden"
              onChange={e => {
                if (e.target.files) addFiles(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            <div className={`flex flex-col items-center gap-3 text-center px-6 ${hasVideos ? 'py-3' : ''}`}>
              <div className={`rounded-2xl bg-primary/10 flex items-center justify-center transition-all
                ${isDragOver ? 'scale-110' : ''} ${hasVideos ? 'w-10 h-10' : 'w-20 h-20'}`}>
                <Upload className={`text-primary ${hasVideos ? 'w-5 h-5' : 'w-9 h-9'}`} />
              </div>
              <div>
                <p className={`font-semibold text-foreground ${hasVideos ? 'text-sm' : 'text-xl'}`}>
                  {isDragOver ? 'Release to upload!' : hasVideos ? 'Drop more files here' : 'Drag your files here'}
                </p>
                {!hasVideos && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Videos, PDFs, Word, Excel, PPT, Text — multiple files accepted
                  </p>
                )}
              </div>
              {!hasVideos && (
                <Button variant="outline" size="sm" className="mt-2 gap-2 pointer-events-none">
                  <Video className="w-4 h-4" /> Or browse files
                </Button>
              )}
            </div>
          </div>

          {/* ── Lesson Cards ─────────────────────────────────────────────── */}
          {lessons.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Lessons ({lessons.length})
                </h2>
                <span className="text-xs text-muted-foreground">
                  {lessons.filter(l => l.status === 'done').length}/{lessons.length} uploaded
                </span>
              </div>

              {lessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  className={`bg-card rounded-2xl border transition-all duration-200 overflow-hidden
                    ${lesson.status === 'error' ? 'border-destructive/40' : 'border-border hover:border-primary/30'}`}
                >
                  {/* Progress bar */}
                  {lesson.status === 'uploading' && (
                    <div className="h-1 bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300 rounded-full"
                        style={{ width: `${lesson.progress}%` }}
                      />
                    </div>
                  )}
                  {lesson.status === 'done' && (
                    <div className="h-1 bg-success/100" />
                  )}
                  {lesson.status === 'error' && (
                    <div className="h-1 bg-destructive" />
                  )}

                  <div className="flex items-center gap-3 p-4">
                    {/* Order number + drag handle placeholder */}
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <GripVertical className="w-4 h-4 opacity-40" />
                      <span className="text-xs font-mono w-5 text-center">{idx + 1}</span>
                    </div>

                    {/* Status icon */}
                    <div className="shrink-0">
                      {lesson.status === 'done' && <CheckCircle2 className="w-5 h-5 text-success" />}
                      {lesson.status === 'uploading' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                      {lesson.status === 'pending' && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
                      {lesson.status === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
                    </div>

                    {/* Inline title */}
                    <div className="flex-1 min-w-0">
                      {editingId === lesson.id ? (
                        <Input
                          autoFocus
                          value={lesson.title}
                          onChange={e => renameLesson(lesson.id, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={e => { if (e.key === 'Enter') setEditingId(null); }}
                          className="h-8 text-sm font-medium border-primary"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingId(lesson.id)}
                          className="group flex items-center gap-1.5 text-left w-full"
                        >
                          <span className="font-medium text-sm truncate">{lesson.title}</span>
                          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      )}

                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatFileSize(lesson.file.size)}</span>
                        {lesson.status === 'uploading' && (
                          <span className="text-xs text-primary">{lesson.progress}%</span>
                        )}
                        {lesson.status === 'done' && lesson.duration > 0 && (
                          <span className="text-xs text-success">{formatDuration(lesson.duration)}</span>
                        )}
                        {lesson.status === 'error' && (
                          <span className="text-xs text-destructive">{lesson.error}</span>
                        )}
                      </div>
                    </div>

                    {/* Free toggle */}
                    {lesson.status === 'done' && (
                      <button
                        onClick={() => setLessons(prev => prev.map(l =>
                          l.id === lesson.id ? { ...l, isFree: !l.isFree } : l
                        ))}
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border transition-colors
                          ${lesson.isFree
                            ? 'bg-info/10 text-info border-info/30'
                            : 'bg-muted text-muted-foreground border-border hover:border-info/40'
                          }`}
                      >
                        {lesson.isFree ? 'Free' : 'Paid'}
                      </button>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      {lesson.status === 'error' && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => retryLesson(lesson.id)}>
                          Retry
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLesson(lesson.id)}
                        disabled={lesson.status === 'uploading'}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Minimal sidebar ──────────────────────────────────────── */}
        {hasVideos && (
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-card rounded-3xl border border-border p-6 space-y-5 sticky top-24">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-base">Course Details</h2>
              </div>

              {/* Title EN */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Course Title (EN) *
                </label>
                <Input
                  value={courseTitle}
                  onChange={e => setCourseTitle(e.target.value)}
                  placeholder="e.g. Mathematics Grade 12"
                  className="h-10"
                />
              </div>

              {/* Title AR */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  العنوان بالعربية
                </label>
                <Input
                  value={courseTitleAr}
                  onChange={e => setCourseTitleAr(e.target.value)}
                  placeholder="رياضيات الصف الثاني عشر"
                  dir="rtl"
                  className="h-10"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Category *
                </label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select category</option>
                  {categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Subscription Prices */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  1-Month Price (LYD)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0 = Free"
                  className="h-10"
                />
              </div>
              {parseFloat(price) > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Paid courses use subscriptions — set a price for every duration.
                  </p>
                  {([
                    ['3-Month Price (LYD)', priceMonth3, setPriceMonth3],
                    ['6-Month Price (LYD)', priceMonth6, setPriceMonth6],
                    ['12-Month Price (LYD)', priceMonth12, setPriceMonth12],
                  ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                    <div key={label}>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        {label}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={value}
                        onChange={e => setter(e.target.value)}
                        placeholder="Required"
                        className="h-10"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Status indicator */}
              <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                <StatusRow
                  done={lessons.some(l => l.status === 'done')}
                  loading={anyUploading}
                  label="Videos uploaded"
                />
                <StatusRow done={!!courseTitle.trim()} label="Course title" />
                <StatusRow done={!!categoryId} label="Category selected" />
                {parseFloat(price) > 0 && (
                  <StatusRow
                    done={parseFloat(priceMonth3) > 0 && parseFloat(priceMonth6) > 0 && parseFloat(priceMonth12) > 0}
                    label="All subscription prices set"
                  />
                )}
              </div>

              {/* Submit */}
              <Button
                className="w-full h-11 gap-2 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md shadow-primary/20"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                ) : anyUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><ChevronRight className="w-4 h-4" /> Submit for Review</>
                )}
              </Button>

              {!canSubmit && !anyUploading && !anyErrored && hasVideos && (
                <p className="text-xs text-muted-foreground text-center flex items-center gap-1 justify-center">
                  <AlertTriangle className="w-3 h-3" />
                  Fill in title &amp; category to continue
                </p>
              )}
              {anyErrored && (
                <p className="text-xs text-destructive text-center flex items-center gap-1 justify-center">
                  <AlertTriangle className="w-3 h-3" />
                  Fix or remove failed uploads first
                </p>
              )}

              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Course is saved as <strong>Draft</strong> and sent for admin review before publishing.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

// ── Status row helper ─────────────────────────────────────────────────────────
function StatusRow({ done, loading, label }: { done: boolean; loading?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
      ) : done ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />
      )}
      <span className={done ? 'text-foreground font-medium' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}
