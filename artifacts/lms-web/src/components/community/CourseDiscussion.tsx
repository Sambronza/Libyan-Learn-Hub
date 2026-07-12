import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MessagesSquare, Send, Loader2, X, Trash2, Reply, ExternalLink, Link2 } from 'lucide-react';
import { timeAgo } from './TeacherPosts';

interface DiscussionMessage {
  id: number;
  courseId: number;
  parentId: number | null;
  content: string;
  linkUrl: string | null;
  libraryResourceId: number | null;
  createdAt: string;
  userId: number;
  userName: string;
  userNameAr: string | null;
  userAvatarUrl: string | null;
  userRole: string;
}

/**
 * Private discussion space for a course — enrolled students + the teacher.
 * The backend returns 403 for anyone else; we simply render nothing then.
 */
export function CourseDiscussion({ courseId }: { courseId: number }) {
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ar = language === 'ar';

  const [text, setText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [replyTo, setReplyTo] = useState<DiscussionMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, isError } = useQuery<{ teacherId: number | null; messages: DiscussionMessage[] }>({
    queryKey: ['course-discussion', courseId],
    queryFn: () => api.get(`/community/course/${courseId}/discussion`),
    enabled: isAuthenticated && !!courseId,
    retry: false,
  });

  // Not enrolled (403) or logged out: the section simply doesn't render
  if (!isAuthenticated || isError) return null;
  if (isLoading) return null;

  const teacherId = data?.teacherId ?? null;
  const messages = data?.messages || [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['course-discussion', courseId] });

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/community/course/${courseId}/discussion`, {
        content: text.trim(),
        parentId: replyTo?.id,
        linkUrl: showLink && linkUrl.trim() ? linkUrl.trim() : undefined,
      });
      setText(''); setLinkUrl(''); setShowLink(false); setReplyTo(null);
      refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (m: DiscussionMessage) => {
    if (!window.confirm(ar ? 'حذف هذه الرسالة؟' : 'Delete this message?')) return;
    try {
      await api.del(`/community/discussion-messages/${m.id}`);
      refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const topLevel = messages.filter((m) => !m.parentId);
  const repliesFor = (id: number) => messages.filter((m) => m.parentId === id);

  const MessageItem = ({ m, canReply }: { m: DiscussionMessage; canReply?: boolean }) => {
    const name = ar ? (m.userNameAr || m.userName) : m.userName;
    const isTeacher = m.userId === teacherId;
    const canDelete = user?.id === m.userId || user?.id === teacherId || user?.role === 'admin';
    return (
      <div className="flex gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/5 border border-border flex items-center justify-center text-secondary text-xs font-bold overflow-hidden shrink-0">
          {m.userAvatarUrl
            ? <img src={m.userAvatarUrl} alt={name} className="w-full h-full object-cover" />
            : name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`border rounded-xl px-3 py-2 ${isTeacher ? 'bg-primary/5 border-primary/20' : 'bg-muted/40 border-border'}`}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">{name}</span>
              {isTeacher && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {ar ? 'المعلم' : 'Teacher'}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">{timeAgo(m.createdAt, ar)}</span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">{m.content}</p>
            {m.linkUrl && (
              <a href={m.linkUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary bg-primary/8 px-2.5 py-1 rounded-full hover:bg-primary/15 transition-colors">
                <ExternalLink className="w-3 h-3" />
                {ar ? 'فتح الرابط' : 'Open link'}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 ps-1">
            {canReply && (
              <button onClick={() => setReplyTo(m)} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <Reply className="w-3 h-3" /> {ar ? 'رد' : 'Reply'}
              </button>
            )}
            {canDelete && (
              <button onClick={() => handleDelete(m)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" /> {ar ? 'حذف' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <MessagesSquare className="w-5 h-5 text-primary" />
        {ar ? 'نقاش الدورة' : 'Course Discussion'}
      </h2>
      <p className="text-xs text-muted-foreground mb-5">
        {ar
          ? 'مساحة خاصة بطلاب هذه الدورة والمعلم — اطرح أسئلتك وشارك الروابط المفيدة.'
          : 'A private space for this course’s students and teacher — ask questions and share useful links.'}
      </p>

      {/* Composer */}
      <div className="mb-6">
        {replyTo && (
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-t-xl px-3 py-1.5 border border-b-0 border-border">
            <span>{ar ? `رد على ${replyTo.userNameAr || replyTo.userName}` : `Replying to ${replyTo.userName}`}</span>
            <button onClick={() => setReplyTo(null)} className="p-0.5 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            maxLength={500}
            placeholder={ar ? 'اكتب رسالة للصف...' : 'Write a message to the class...'}
            className={`flex-1 bg-muted/40 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${replyTo ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'}`}
          />
          <button
            onClick={() => setShowLink(!showLink)}
            className={`p-2 rounded-xl border border-border hover:bg-muted ${showLink ? 'text-primary' : 'text-muted-foreground'}`}
            title={ar ? 'إرفاق رابط' : 'Attach link'}
          >
            <Link2 className="w-4 h-4" />
          </button>
          <Button size="sm" disabled={submitting || !text.trim()} onClick={submit} className="shrink-0 self-stretch">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        {showLink && (
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            dir="ltr"
            className="w-full mt-2 bg-muted/40 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
      </div>

      {/* Thread */}
      {topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {ar ? 'لا توجد رسائل بعد — كن أول من يبدأ النقاش!' : 'No messages yet — be the first to start the discussion!'}
        </p>
      ) : (
        <div className="space-y-4">
          {topLevel.map((m) => (
            <div key={m.id}>
              <MessageItem m={m} canReply />
              {repliesFor(m.id).map((r) => (
                <div key={r.id} className="ms-8 mt-2">
                  <MessageItem m={r} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
