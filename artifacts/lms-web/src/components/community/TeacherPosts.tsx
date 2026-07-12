import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  UserPlus, UserCheck, Megaphone, Trash2, Link2, Image as ImageIcon,
  Loader2, Send, X, ExternalLink, Heart, MessageCircle, MessageCircleOff, Flag, Reply,
} from 'lucide-react';

export interface TeacherPost {
  id: number;
  teacherId: number;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  courseId: number | null;
  commentsEnabled: boolean;
  createdAt: string;
  teacherName: string;
  teacherNameAr: string | null;
  teacherAvatarUrl: string | null;
  teacherSlug: string | null;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
}

interface PostComment {
  id: number;
  postId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  userId: number;
  userName: string;
  userNameAr: string | null;
  userAvatarUrl: string | null;
  userRole: string;
  likesCount: number;
  likedByMe: boolean;
}

export function timeAgo(dateStr: string, ar: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return ar ? 'الآن' : 'just now';
  if (mins < 60) return ar ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return ar ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return ar ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(ar ? 'ar-LY' : 'en-GB');
}

// ── Follow button (teacher profile) ──────────────────────────────────────────
export function FollowButton({ teacherId }: { teacherId: number }) {
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ar = language === 'ar';

  const { data: state } = useQuery<{ followersCount: number; following: boolean }>({
    queryKey: ['follow-state', teacherId],
    queryFn: () => api.get(`/community/follow/state/${teacherId}`),
    enabled: !!teacherId,
  });

  const toggle = useMutation({
    mutationFn: () => state?.following
      ? api.del(`/community/follow/${teacherId}`)
      : api.post(`/community/follow/${teacherId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-state', teacherId] }),
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  // Teachers don't follow themselves; hide for the profile owner
  if (user?.id === teacherId) return null;

  const following = state?.following;
  return (
    <Button
      variant={following ? 'outline' : 'default'}
      className="gap-2"
      disabled={toggle.isPending}
      onClick={() => {
        if (!isAuthenticated) {
          toast({ title: ar ? 'سجّل الدخول لمتابعة المعلم' : 'Log in to follow this teacher' });
          return;
        }
        toggle.mutate();
      }}
    >
      {following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      {following ? (ar ? 'متابَع' : 'Following') : (ar ? 'متابعة' : 'Follow')}
      {typeof state?.followersCount === 'number' && (
        <span className="text-xs opacity-70">({state.followersCount})</span>
      )}
    </Button>
  );
}

// ── A single post card ───────────────────────────────────────────────────────
export function PostCard({ post, showAuthor, onDeleted }: {
  post: TeacherPost;
  showAuthor?: boolean;
  onDeleted?: () => void;
}) {
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const ar = language === 'ar';

  const [liked, setLiked] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount ?? 0);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount ?? 0);
  const [commentsEnabled, setCommentsEnabled] = useState(post.commentsEnabled ?? true);
  const [showComments, setShowComments] = useState(false);

  const authorName = ar ? (post.teacherNameAr || post.teacherName) : post.teacherName;
  const isOwner = user?.id === post.teacherId;
  const canDelete = isOwner || user?.role === 'admin';

  const handleDelete = async () => {
    if (!window.confirm(ar ? 'حذف هذا المنشور؟' : 'Delete this post?')) return;
    try {
      await api.del(`/community/posts/${post.id}`);
      onDeleted?.();
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const toggleLike = async () => {
    if (!isAuthenticated) {
      toast({ title: ar ? 'سجّل الدخول للتفاعل' : 'Log in to react' });
      return;
    }
    // Optimistic update, corrected by the server response
    setLiked(!liked); setLikesCount((c) => c + (liked ? -1 : 1));
    try {
      const r = await api.post(`/community/posts/${post.id}/like`, {});
      setLiked(r.liked); setLikesCount(r.likesCount);
    } catch (e: any) {
      setLiked(liked); setLikesCount(likesCount);
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const toggleCommentsEnabled = async () => {
    try {
      const r = await api.patch(`/community/posts/${post.id}/comments-enabled`, {});
      setCommentsEnabled(r.commentsEnabled);
      toast({
        title: r.commentsEnabled
          ? (ar ? 'تم فتح التعليقات' : 'Comments enabled')
          : (ar ? 'تم إغلاق التعليقات' : 'Comments disabled'),
      });
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        {showAuthor ? (
          <Link href={post.teacherSlug ? `/teachers/${post.teacherSlug}` : '#'} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
              {post.teacherAvatarUrl
                ? <img src={post.teacherAvatarUrl} alt={authorName} className="w-full h-full object-cover" />
                : authorName?.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-sm group-hover:text-primary transition-colors">{authorName}</div>
              <div className="text-xs text-muted-foreground">{timeAgo(post.createdAt, ar)}</div>
            </div>
          </Link>
        ) : (
          <div className="text-xs text-muted-foreground">{timeAgo(post.createdAt, ar)}</div>
        )}
        {canDelete && (
          <button onClick={handleDelete} className="text-muted-foreground hover:text-destructive p-1 rounded-lg" aria-label="Delete post">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-sm text-foreground leading-relaxed mt-3 whitespace-pre-wrap break-words">{post.content}</p>

      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="mt-3 rounded-xl border border-border max-h-96 w-full object-cover" loading="lazy" />
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {post.linkUrl && (
          <a href={post.linkUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/8 px-2.5 py-1.5 rounded-full hover:bg-primary/15 transition-colors">
            <ExternalLink className="w-3 h-3" />
            {ar ? 'فتح الرابط' : 'Open link'}
          </a>
        )}
        {post.courseId && (
          <Link href={`/courses/${post.courseId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary bg-secondary/10 px-2.5 py-1.5 rounded-full hover:bg-secondary/20 transition-colors">
            <Megaphone className="w-3 h-3" />
            {ar ? 'عرض الدورة' : 'View course'}
          </Link>
        )}
      </div>

      {/* Interaction bar */}
      <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            liked ? 'text-rose-600 bg-rose-500/10' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500' : ''}`} />
          {likesCount > 0 && likesCount}
        </button>
        {commentsEnabled ? (
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showComments ? 'text-primary bg-primary/8' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {commentsCount > 0 ? commentsCount : (ar ? 'تعليق' : 'Comment')}
          </button>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground/60">
            <MessageCircleOff className="w-4 h-4" />
            {ar ? 'التعليقات مغلقة' : 'Comments off'}
          </span>
        )}
        {(isOwner || user?.role === 'admin') && (
          <button
            onClick={toggleCommentsEnabled}
            className="ms-auto text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted"
            title={ar ? 'فتح/إغلاق التعليقات' : 'Toggle comments'}
          >
            {commentsEnabled ? (ar ? 'إغلاق التعليقات' : 'Turn comments off') : (ar ? 'فتح التعليقات' : 'Turn comments on')}
          </button>
        )}
      </div>

      {showComments && commentsEnabled && (
        <CommentsSection
          postId={post.id}
          postOwnerId={post.teacherId}
          onCountChange={setCommentsCount}
        />
      )}
    </div>
  );
}

// ── Comments (one-level threading) ───────────────────────────────────────────
function CommentsSection({ postId, postOwnerId, onCountChange }: {
  postId: number;
  postOwnerId: number;
  onCountChange: (n: number) => void;
}) {
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ar = language === 'ar';

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: comments } = useQuery<PostComment[]>({
    queryKey: ['post-comments', postId],
    queryFn: () => api.get(`/community/posts/${postId}/comments`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });

  React.useEffect(() => {
    if (comments) onCountChange(comments.length);
  }, [comments]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/community/posts/${postId}/comments`, {
        content: text.trim(),
        parentId: replyTo?.id,
      });
      setText(''); setReplyTo(null);
      refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const topLevel = comments?.filter((c) => !c.parentId) || [];
  const repliesFor = (id: number) => comments?.filter((c) => c.parentId === id) || [];

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      {/* Input */}
      {isAuthenticated ? (
        <div>
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-t-xl px-3 py-1.5 border border-b-0 border-border">
              <span>{ar ? `رد على ${ar ? (replyTo.userNameAr || replyTo.userName) : replyTo.userName}` : `Replying to ${replyTo.userName}`}</span>
              <button onClick={() => setReplyTo(null)} className="p-0.5 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              maxLength={500}
              placeholder={ar ? 'اكتب تعليقًا...' : 'Write a comment...'}
              className={`flex-1 bg-muted/40 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${replyTo ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'}`}
            />
            <Button size="sm" disabled={submitting || !text.trim()} onClick={submit} className="shrink-0 self-end">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{ar ? 'سجّل الدخول للتعليق.' : 'Log in to comment.'}</p>
      )}

      {/* Thread */}
      <div className="space-y-3">
        {topLevel.map((c) => (
          <div key={c.id}>
            <CommentItem comment={c} postOwnerId={postOwnerId} onReply={() => setReplyTo(c)} onChanged={refresh} />
            {repliesFor(c.id).map((r) => (
              <div key={r.id} className="ms-8 mt-2">
                <CommentItem comment={r} postOwnerId={postOwnerId} onChanged={refresh} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment, postOwnerId, onReply, onChanged }: {
  comment: PostComment;
  postOwnerId: number;
  onReply?: () => void;
  onChanged: () => void;
}) {
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const ar = language === 'ar';

  const [liked, setLiked] = useState(comment.likedByMe);
  const [likesCount, setLikesCount] = useState(comment.likesCount);

  const name = ar ? (comment.userNameAr || comment.userName) : comment.userName;
  const isTeacherBadge = comment.userId === postOwnerId;
  const canDelete = user?.id === comment.userId || user?.id === postOwnerId || user?.role === 'admin';

  const toggleLike = async () => {
    if (!isAuthenticated) return;
    setLiked(!liked); setLikesCount((c) => c + (liked ? -1 : 1));
    try {
      const r = await api.post(`/community/comments/${comment.id}/like`, {});
      setLiked(r.liked); setLikesCount(r.likesCount);
    } catch {
      setLiked(liked); setLikesCount(likesCount);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(ar ? 'حذف هذا التعليق؟' : 'Delete this comment?')) return;
    try {
      await api.del(`/community/comments/${comment.id}`);
      onChanged();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const handleReport = async () => {
    if (!window.confirm(ar ? 'الإبلاغ عن هذا التعليق للإدارة؟' : 'Report this comment to the admins?')) return;
    try {
      await api.post(`/community/comments/${comment.id}/report`, { reason: 'offensive' });
      toast({ title: ar ? 'تم إرسال البلاغ — شكرًا لك' : 'Report sent — thank you' });
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 border border-border flex items-center justify-center text-primary text-xs font-bold overflow-hidden shrink-0">
        {comment.userAvatarUrl
          ? <img src={comment.userAvatarUrl} alt={name} className="w-full h-full object-cover" />
          : name?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-muted/40 border border-border rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs">{name}</span>
            {isTeacherBadge && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {ar ? 'المعلم' : 'Teacher'}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt, ar)}</span>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ps-1">
          <button onClick={toggleLike}
            className={`flex items-center gap-1 text-[11px] font-medium ${liked ? 'text-rose-600' : 'text-muted-foreground hover:text-foreground'}`}>
            <Heart className={`w-3 h-3 ${liked ? 'fill-rose-500' : ''}`} />
            {likesCount > 0 && likesCount}
          </button>
          {onReply && isAuthenticated && (
            <button onClick={onReply} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              <Reply className="w-3 h-3" /> {ar ? 'رد' : 'Reply'}
            </button>
          )}
          {isAuthenticated && user?.id !== comment.userId && (
            <button onClick={handleReport} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
              <Flag className="w-3 h-3" /> {ar ? 'بلاغ' : 'Report'}
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" /> {ar ? 'حذف' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composer (own profile, approved teachers) ────────────────────────────────
export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { language } = useLanguage();
  const api = useApi();
  const { toast } = useToast();
  const ar = language === 'ar';

  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      let imagePayload: any = {};
      if (image) {
        const formData = new FormData();
        formData.append('image', image);
        const token = localStorage.getItem('lms_token');
        const res = await fetch('/api/upload/image', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Image upload failed');
        const uploaded = await res.json();
        imagePayload = { imageUrl: uploaded.url, imagePublicId: uploaded.publicId };
      }
      await api.post('/community/posts', {
        content: content.trim(),
        linkUrl: showLink && linkUrl.trim() ? linkUrl.trim() : undefined,
        ...imagePayload,
      });
      setContent(''); setLinkUrl(''); setShowLink(false); setImage(null);
      onPosted();
      toast({ title: ar ? 'تم النشر — سيتم إشعار متابعيك' : 'Posted — your followers will be notified' });
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={ar ? 'شارك إعلانًا أو نصيحة دراسية مع طلابك...' : 'Share an announcement or study tip with your students...'}
        className="w-full bg-muted/40 border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {showLink && (
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://..."
          dir="ltr"
          className="w-full mt-2 bg-muted/40 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      )}
      {image && (
        <div className="flex items-center justify-between mt-2 bg-muted/40 border border-border rounded-xl px-3 py-2 text-sm">
          <span className="truncate">{image.name}</span>
          <button onClick={() => setImage(null)} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
        </div>
      )}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <label className="p-2 rounded-lg hover:bg-muted cursor-pointer text-muted-foreground" title={ar ? 'إضافة صورة' : 'Add image'}>
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden"
              onChange={(e) => setImage(e.target.files?.[0] || null)} />
          </label>
          <button onClick={() => setShowLink(!showLink)}
            className={`p-2 rounded-lg hover:bg-muted ${showLink ? 'text-primary' : 'text-muted-foreground'}`}
            title={ar ? 'إضافة رابط' : 'Add link'}>
            <Link2 className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-muted-foreground ms-2">{content.length}/2000</span>
        </div>
        <Button size="sm" className="gap-2" disabled={submitting || !content.trim()} onClick={submit}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {ar ? 'نشر' : 'Post'}
        </Button>
      </div>
    </div>
  );
}

// ── Posts section for a teacher profile ──────────────────────────────────────
export function TeacherPostsSection({ teacherId }: { teacherId: number }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const ar = language === 'ar';

  const { data: posts, isLoading } = useQuery<TeacherPost[]>({
    queryKey: ['teacher-posts', teacherId],
    queryFn: () => api.get(`/community/posts/teacher/${teacherId}`),
    enabled: !!teacherId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['teacher-posts', teacherId] });
  const isOwner = user?.id === teacherId && user?.role === 'teacher';

  if (isLoading) return null;
  if (!posts?.length && !isOwner) return null;

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-primary" />
        {ar ? 'المنشورات' : 'Posts'}
      </h2>
      <div className="space-y-4">
        {isOwner && <PostComposer onPosted={refresh} />}
        {posts?.map((p) => <PostCard key={p.id} post={p} onDeleted={refresh} />)}
        {!posts?.length && isOwner && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {ar ? 'لم تنشر شيئًا بعد — منشورك الأول سيصل إلى كل متابعيك.' : "You haven't posted yet — your first post will reach all your followers."}
          </p>
        )}
      </div>
    </div>
  );
}
