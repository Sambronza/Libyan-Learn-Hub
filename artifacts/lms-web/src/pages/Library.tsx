import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Library as LibraryIcon, BookOpen, FileText, Image as ImageIcon, Link2,
  Search, Plus, Trash2, Download, ExternalLink, Loader2, X, ArrowDownWideNarrow, Eye,
} from 'lucide-react';

type ResourceType = 'book' | 'article' | 'image' | 'link';

interface LibraryResource {
  id: number;
  title: string;
  titleAr: string | null;
  author: string | null;
  description: string | null;
  type: ResourceType;
  categoryId: number | null;
  categoryName: string | null;
  categoryNameAr: string | null;
  gradeLevel: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  externalUrl: string | null;
  viewCount: number;
  uploadedBy: number;
  uploaderName: string | null;
  uploaderRole: string | null;
  createdAt: string;
}

interface Category { id: number; name: string; nameAr: string; icon?: string; }

const TYPE_META: Record<ResourceType, { icon: React.ElementType; en: string; ar: string; badge: string; cover: string; tint: string }> = {
  book:    { icon: BookOpen,  en: 'Book',    ar: 'كتاب',  badge: 'bg-info/10 text-info',       cover: 'from-info/25 via-info/10 to-transparent',       tint: 'text-info' },
  article: { icon: FileText,  en: 'Article', ar: 'مقال',  badge: 'bg-success/10 text-success', cover: 'from-success/25 via-success/10 to-transparent', tint: 'text-success' },
  image:   { icon: ImageIcon, en: 'Image',   ar: 'صورة',  badge: 'bg-primary/10 text-primary', cover: 'from-primary/25 via-violet-500/10 to-transparent', tint: 'text-primary' },
  link:    { icon: Link2,     en: 'Link',    ar: 'رابط',  badge: 'bg-warning/10 text-warning', cover: 'from-warning/25 via-warning/10 to-transparent', tint: 'text-warning' },
};

const GRADE_LEVELS = [
  { value: 'primary',    en: 'Primary',      ar: 'ابتدائي' },
  { value: 'middle',     en: 'Middle',       ar: 'إعدادي' },
  { value: 'secondary',  en: 'Secondary',    ar: 'ثانوي' },
  { value: 'university', en: 'University',   ar: 'جامعي' },
  { value: 'general',    en: 'General',      ar: 'عام' },
];

// File pickers per type (validated again server-side)
const FILE_ACCEPT: Record<Exclude<ResourceType, 'link'>, string> = {
  book: '.pdf,.doc,.docx,.epub',
  article: '.pdf,.doc,.docx,.txt',
  image: '.jpg,.jpeg,.png',
};

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Library() {
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ar = language === 'ar';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ResourceType | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [sort, setSort] = useState<'newest' | 'popular' | 'oldest' | 'title'>('newest');
  const [showUpload, setShowUpload] = useState(false);

  const canUpload = user?.role === 'admin' || (
    user?.role === 'teacher' &&
    ((user as any)?.isVerified || (user as any)?.teacherApprovalStatus === 'approved')
  );

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['library-categories'],
    queryFn: () => api.get('/categories'),
  });

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (typeFilter) params.set('type', typeFilter);
  if (categoryFilter) params.set('categoryId', categoryFilter);
  if (gradeFilter) params.set('gradeLevel', gradeFilter);
  if (sort && sort !== 'newest') params.set('sort', sort);
  const qs = params.toString();

  const hasActiveFilters = !!(search.trim() || typeFilter || categoryFilter || gradeFilter);
  const clearFilters = () => { setSearch(''); setTypeFilter(''); setCategoryFilter(''); setGradeFilter(''); };

  const { data: resources, isLoading } = useQuery<LibraryResource[]>({
    queryKey: ['library-resources', qs],
    queryFn: () => api.get(`/library${qs ? `?${qs}` : ''}`),
  });

  const handleDelete = async (r: LibraryResource) => {
    if (!window.confirm(ar ? 'هل أنت متأكد من حذف هذا المورد؟' : 'Delete this resource?')) return;
    try {
      await api.del(`/library/${r.id}`);
      queryClient.invalidateQueries({ queryKey: ['library-resources'] });
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const openResource = (r: LibraryResource) => {
    const url = r.type === 'link' ? r.externalUrl : r.fileUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener');
    // Fire-and-forget popularity tracking; don't block or error the open.
    api.post(`/library/${r.id}/view`, {})
      .then(() => queryClient.invalidateQueries({ queryKey: ['library-resources'] }))
      .catch(() => {});
  };

  return (
    <PageContainer>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <LibraryIcon className="w-8 h-8 text-primary" />
            {ar ? 'المكتبة' : 'Library'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {ar
              ? 'مركز الموارد التعليمية — كتب، مقالات، صور وروابط موثوقة'
              : 'Your hub for educational resources — books, articles, images and trusted links'}
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setShowUpload(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            {ar ? 'إضافة مورد' : 'Add Resource'}
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-8 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ar ? 'ابحث عن كتاب، مقال، أو موضوع...' : 'Search for a book, article, or topic...'}
            className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ResourceType | '')}
          className="px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">{ar ? 'كل الأنواع' : 'All types'}</option>
          {(Object.keys(TYPE_META) as ResourceType[]).map((t) => (
            <option key={t} value={t}>{ar ? TYPE_META[t].ar : TYPE_META[t].en}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">{ar ? 'كل المواد' : 'All subjects'}</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{ar ? c.nameAr : c.name}</option>
          ))}
        </select>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">{ar ? 'كل المراحل' : 'All grades'}</option>
          {GRADE_LEVELS.map((g) => (
            <option key={g.value} value={g.value}>{ar ? g.ar : g.en}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-destructive shrink-0">
            <X className="w-4 h-4" /> {ar ? 'مسح' : 'Clear'}
          </Button>
        )}
      </div>

      {/* Result count + sort */}
      {!isLoading && !!resources?.length && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {ar
              ? `${resources.length} ${resources.length === 1 ? 'مورد' : 'موارد'}`
              : `${resources.length} ${resources.length === 1 ? 'resource' : 'resources'}`}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <ArrowDownWideNarrow className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{ar ? 'ترتيب:' : 'Sort:'}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="newest">{ar ? 'الأحدث' : 'Newest'}</option>
              <option value="popular">{ar ? 'الأكثر رواجاً' : 'Most Popular'}</option>
              <option value="oldest">{ar ? 'الأقدم' : 'Oldest'}</option>
              <option value="title">{ar ? 'الاسم (أ-ي)' : 'Title (A–Z)'}</option>
            </select>
          </label>
        </div>
      )}

      {/* Resource grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !resources?.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <LibraryIcon className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-xl font-bold">{ar ? 'لا توجد موارد بعد' : 'No resources yet'}</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {ar ? 'سيتم إضافة الموارد التعليمية قريبًا.' : 'Educational resources will appear here soon.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {resources.map((r) => {
            const meta = TYPE_META[r.type];
            const Icon = meta.icon;
            const canDelete = user?.role === 'admin' || r.uploadedBy === user?.id;
            const isImage = r.type === 'image' && !!r.fileUrl;
            return (
              <div key={r.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 group">
                {/* Cover / thumbnail */}
                <button
                  type="button"
                  onClick={() => openResource(r)}
                  className="relative aspect-[16/10] w-full overflow-hidden bg-muted text-left"
                >
                  {isImage ? (
                    <img src={r.fileUrl!} alt={r.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${meta.cover} relative`}>
                      <div className="absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:16px_16px]" />
                      <Icon className={`w-12 h-12 ${meta.tint} opacity-80 group-hover:scale-110 transition-transform duration-300`} />
                    </div>
                  )}
                  {/* Hover quick-preview overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm">
                      {r.type === 'link' ? <ExternalLink className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {r.type === 'link' ? (ar ? 'زيارة' : 'Visit') : (ar ? 'معاينة' : 'Preview')}
                    </span>
                  </div>
                  {/* Type badge */}
                  <span className={`absolute top-3 start-3 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm ${meta.badge}`}>
                    {ar ? meta.ar : meta.en}
                  </span>
                </button>

                <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {ar && r.titleAr ? r.titleAr : r.title}
                </h3>
                {r.author && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {ar ? 'المؤلف: ' : 'By '}{r.author}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {r.categoryName && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
                      {ar && r.categoryNameAr ? r.categoryNameAr : r.categoryName}
                    </span>
                  )}
                  {r.gradeLevel && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
                      {(() => { const g = GRADE_LEVELS.find(g => g.value === r.gradeLevel); return g ? (ar ? g.ar : g.en) : r.gradeLevel; })()}
                    </span>
                  )}
                  {r.fileSize ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">{formatSize(r.fileSize)}</span>
                  ) : null}
                  {r.viewCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
                      <Eye className="w-3 h-3" />{r.viewCount}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-muted-foreground mt-3">
                  {ar ? 'أضافه: ' : 'Uploaded by '}
                  <span className="font-medium">
                    {r.uploaderRole === 'admin' ? (ar ? 'الإدارة' : 'Admin') : (r.uploaderName || '—')}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => openResource(r)}>
                    {r.type === 'link'
                      ? (<><ExternalLink className="w-3.5 h-3.5" />{ar ? 'زيارة الرابط' : 'Visit link'}</>)
                      : (<><Download className="w-3.5 h-3.5" />{ar ? 'فتح / تحميل' : 'Open / Download'}</>)}
                  </Button>
                  {isAuthenticated && canDelete && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 px-2" onClick={() => handleDelete(r)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canUpload && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          categories={categories || []}
          onCreated={() => {
            setShowUpload(false);
            queryClient.invalidateQueries({ queryKey: ['library-resources'] });
          }}
        />
      )}
    </div>
    </PageContainer>
  );
}

// ── Upload dialog (admins & approved teachers) ────────────────────────────────
function UploadDialog({ open, onClose, categories, onCreated }: {
  open: boolean; onClose: () => void; categories: Category[]; onCreated: () => void;
}) {
  const { language } = useLanguage();
  const api = useApi();
  const { toast } = useToast();
  const ar = language === 'ar';

  const [type, setType] = useState<ResourceType>('book');
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [author, setAuthor] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setType('book'); setTitle(''); setTitleAr(''); setAuthor('');
    setCategoryId(''); setGradeLevel(''); setExternalUrl('');
    setFile(null); setProgress(null); setSubmitting(false);
  };

  const uploadFile = (f: File): Promise<any> => new Promise((resolve, reject) => {
    const formData = new FormData();
    const endpoint = type === 'image' ? 'image' : 'document';
    formData.append(endpoint, f);
    const token = localStorage.getItem('lms_token');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload/${endpoint}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed')); }
        catch { reject(new Error('Upload failed')); }
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: ar ? 'العنوان مطلوب' : 'Title is required', variant: 'destructive' });
      return;
    }
    if (type === 'link' && !externalUrl.trim()) {
      toast({ title: ar ? 'الرابط مطلوب' : 'URL is required', variant: 'destructive' });
      return;
    }
    if (type !== 'link' && !file) {
      toast({ title: ar ? 'الملف مطلوب' : 'A file is required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let filePayload: any = {};
      if (type !== 'link' && file) {
        const uploaded = await uploadFile(file);
        filePayload = {
          fileUrl: uploaded.url,
          filePublicId: uploaded.publicId,
          fileName: uploaded.fileName || file.name,
          fileSize: uploaded.size || file.size,
        };
      }
      await api.post('/library', {
        title, titleAr: titleAr || undefined, author: author || undefined,
        type,
        categoryId: categoryId || undefined,
        gradeLevel: gradeLevel || undefined,
        externalUrl: type === 'link' ? externalUrl.trim() : undefined,
        ...filePayload,
      });
      toast({ title: ar ? 'تمت إضافة المورد بنجاح' : 'Resource added successfully' });
      reset();
      onCreated();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ar ? 'إضافة مورد إلى المكتبة' : 'Add a Library Resource'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Type selector */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(TYPE_META) as ResourceType[]).map((t) => {
              const Icon = TYPE_META[t].icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setFile(null); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-colors ${
                    type === t ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {ar ? TYPE_META[t].ar : TYPE_META[t].en}
                </button>
              );
            })}
          </div>

          <input className={inputCls} placeholder={ar ? 'العنوان *' : 'Title *'} value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inputCls} placeholder={ar ? 'العنوان بالعربية (اختياري)' : 'Arabic title (optional)'} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
          <input className={inputCls} placeholder={ar ? 'المؤلف (اختياري)' : 'Author (optional)'} value={author} onChange={(e) => setAuthor(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{ar ? 'المادة / التصنيف' : 'Subject / Category'}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{ar ? c.nameAr : c.name}</option>)}
            </select>
            <select className={inputCls} value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
              <option value="">{ar ? 'المرحلة (اختياري)' : 'Grade level (optional)'}</option>
              {GRADE_LEVELS.map((g) => <option key={g.value} value={g.value}>{ar ? g.ar : g.en}</option>)}
            </select>
          </div>

          {type === 'link' ? (
            <input
              className={inputCls}
              placeholder="https://..."
              dir="ltr"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
          ) : (
            <div>
              {file ? (
                <div className="flex items-center justify-between bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm">
                  <span className="truncate">{file.name} <span className="text-muted-foreground">({formatSize(file.size)})</span></span>
                  <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-sm text-muted-foreground">
                  <Plus className="w-5 h-5" />
                  {ar ? `اختر ملفًا (${FILE_ACCEPT[type]})` : `Choose a file (${FILE_ACCEPT[type]})`}
                  <input
                    type="file"
                    className="hidden"
                    accept={FILE_ACCEPT[type]}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
              {progress !== null && (
                <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { reset(); onClose(); }}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {ar ? 'إضافة' : 'Add'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
