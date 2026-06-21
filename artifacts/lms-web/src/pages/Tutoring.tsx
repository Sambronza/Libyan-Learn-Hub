import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Clock, Calendar, MessageSquare, Send, Settings, ExternalLink, Plus
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { TUTORING_SUBJECTS } from '@/constants/subjects';

// ─── Constants ─────────────────────────────────────────────────────────────────
const GRADE_LEVELS = [
  { value: 'grade_1_6',   label: 'Grade 1–6 / الصف الأول - السادس' },
  { value: 'grade_7',     label: 'Grade 7 / الصف السابع' },
  { value: 'grade_8',     label: 'Grade 8 / الصف الثامن' },
  { value: 'grade_9',     label: 'Grade 9 / الصف التاسع' },
  { value: 'grade_10',    label: 'Grade 10 / الصف العاشر' },
  { value: 'grade_11',    label: 'Grade 11 / الصف الحادي عشر' },
  { value: 'grade_12',    label: 'Grade 12 / الصف الثاني عشر' },
  { value: 'university',  label: 'University / الجامعة' },
];



/** Minimum hourly rates per grade level — must mirror the backend constant. */
const GRADE_LEVEL_RATES_INTL: Record<string, number> = {
  grade_1_6:   70,
  grade_7:    100,
  grade_8:    100,
  grade_9:    100,
  grade_10:   150,
  grade_11:   150,
  grade_12:   150,
  university:  150,
};

const GRADE_LEVEL_RATES_LOCAL: Record<string, number> = {
  grade_1_6:   30,
  grade_7:     50,
  grade_8:     50,
  grade_9:     70,
  grade_10:    60,
  grade_11:    60,
  grade_12:   100,
  university:  150,
};

function getGradeRate(level: string, educationType?: string | null): number {
  const table = educationType === "local" ? GRADE_LEVEL_RATES_LOCAL : GRADE_LEVEL_RATES_INTL;
  return table[level] ?? 100;
}

const STATUS_COLORS: Record<string, string> = {
  pending:                 'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted:                'bg-green-100 text-green-800 border-green-200',
  rescheduled_by_teacher:  'bg-blue-100 text-blue-800 border-blue-200',
  declined:                'bg-red-100 text-red-800 border-red-200',
  cancelled:               'bg-gray-100 text-gray-700 border-gray-200',
  completed:               'bg-purple-100 text-purple-800 border-purple-200',
  completed_pending_review:'bg-indigo-100 text-indigo-800 border-indigo-200',
  approved:                'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected:                'bg-red-100 text-red-800 border-red-200',
  partially_approved:      'bg-teal-100 text-teal-800 border-teal-200',
  cancelled_no_show:       'bg-orange-100 text-orange-800 border-orange-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending:                'Pending / قيد الانتظار',
  accepted:               'Accepted / مقبول',
  rescheduled_by_teacher: 'New Time Proposed / وقت مقترح',
  declined:               'Declined / مرفوض',
  cancelled:              'Cancelled / ملغي',
  completed:              'Completed / مكتمل',
  completed_pending_review:'Pending Admin Review / قيد مراجعة الإدارة',
  approved:               'Approved / تمت الموافقة',
  rejected:               'Rejected / مرفوض',
  partially_approved:     'Partially Approved / موافقة جزئية',
  cancelled_no_show:      'No-Show / لم يحضر المعلم',
};

// ─── Settings Modal (Teacher) ─────────────────────────────────────────────────
function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useApi();
  const { toast } = useToast();
  const { user, refetchUser } = useAuth();

  const { control, register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      isTutoringEnabled: !!(user as any)?.isTutoringEnabled,
      tutoringHourlyRate: (user as any)?.tutoringHourlyRate?.toString() || '0',
      tutoringSubjects: (user as any)?.tutoringSubjects || '',
    }
  });

  // Re-populate form when user data arrives (async) or modal re-opens
  React.useEffect(() => {
    if (user) {
      reset({
        isTutoringEnabled: !!(user as any).isTutoringEnabled,
        tutoringHourlyRate: (user as any).tutoringHourlyRate?.toString() || '0',
        tutoringSubjects: (user as any).tutoringSubjects || '',
      });
    }
  }, [user, open, reset]);

  const onSubmit = async (data: any) => {
    try {
      await api.put('/tutoring/settings', {
        isTutoringEnabled: !!data.isTutoringEnabled,
        tutoringHourlyRate: parseFloat(data.tutoringHourlyRate) || 0,
        tutoringSubjects: data.tutoringSubjects,
      });
      refetchUser();
      toast({ title: 'Tutoring settings updated successfully!' });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Tutoring Settings / إعدادات التدريس الخاص</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
          {/* Enable toggle */}
          <Controller
            name="isTutoringEnabled"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={e => field.onChange(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                  id="isTutoringEnabled"
                />
                <div>
                  <div className="text-sm font-semibold">Enable 1-to-1 Tutoring</div>
                  <div className="text-xs text-muted-foreground">Students will be able to request private sessions with you</div>
                </div>
              </label>
            )}
          />

          <div>
            <label className="text-sm font-medium block mb-1">Hourly Rate (LYD) <span className="text-muted-foreground text-xs">(max 100)</span></label>
            <Input
              {...register('tutoringHourlyRate')}
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g. 80"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Subjects Taught <span className="text-destructive">*</span></label>
            <Controller
              name="tutoringSubjects"
              control={control}
              render={({ field }) => {
                const selectedSubjects = field.value ? field.value.split(',').filter(Boolean) : [];
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {TUTORING_SUBJECTS.map((subject) => (
                      <label key={subject} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(subject)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              field.onChange([...selectedSubjects, subject].join(','));
                            } else {
                              field.onChange(selectedSubjects.filter((s: string) => s !== subject).join(','));
                            }
                          }}
                          className="w-4 h-4 accent-primary rounded"
                        />
                        {subject}
                      </label>
                    ))}
                  </div>
                );
              }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// ─── Feedback Modal (Student) ─────────────────────────────────────────────────
function FeedbackModal({ requestId, open, onClose }: { requestId: number | null; open: boolean; onClose: () => void }) {
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      await api.post(`/tutoring/requests/${requestId}/rate`, { rating, review });
      toast({ title: 'Feedback submitted successfully. Thank you!' });
      queryClient.invalidateQueries({ queryKey: ['/api/tutoring/requests'] });
      setRating(5);
      setReview('');
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Session Feedback / تقييم الجلسة</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Please rate your recent session. Your feedback helps us ensure quality tutoring.
          </p>
          <div>
            <label className="text-sm font-medium block mb-2">Rating (1-5 Stars)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`p-2 rounded-full transition-colors ${rating >= star ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-300 hover:text-gray-400'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill={rating >= star ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Comment (Optional)</label>
            <textarea
              value={review}
              onChange={e => setReview(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none"
              placeholder="How was the session?"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={onSubmit} disabled={loading} className="flex-1">
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </Button>
            <Button variant="outline" onClick={onClose}>Skip</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Propose Time Modal (Teacher) ─────────────────────────────────────────────
function ProposeTimeModal({
  request, open, onClose
}: { request: any; open: boolean; onClose: () => void }) {
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [proposedAt, setProposedAt] = useState('');
  const [loading, setLoading] = useState(false);

  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 5);
  const minStr = minDateTime.toISOString().slice(0, 16);

  const onSubmit = async () => {
    if (!proposedAt) return;
    setLoading(true);
    try {
      await api.post(`/tutoring/requests/${request.id}/propose-time`, { proposedAt });
      toast({ title: 'New time proposed to student' });
      queryClient.invalidateQueries({ queryKey: ['/api/tutoring/requests'] });
      setProposedAt('');
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setProposedAt(''); onClose(); } }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Propose New Time</DialogTitle>
        </DialogHeader>
        {request && (
          <p className="text-sm text-muted-foreground -mt-2">
            For: <strong>{request.subject}</strong>
            {request.topic ? ` — ${request.topic}` : ''}
          </p>
        )}
        <div className="py-2">
          <label className="text-sm font-medium block mb-1">New Date &amp; Time</label>
          <Input
            type="datetime-local"
            value={proposedAt}
            min={minStr}
            onChange={e => setProposedAt(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={onSubmit} disabled={loading || !proposedAt} className="flex-1">
            {loading ? 'Sending...' : 'Send Proposal'}
          </Button>
          <Button variant="outline" onClick={() => { setProposedAt(''); onClose(); }}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Request Session Modal (Student) ─────────────────────────────────────────
function RequestSessionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tutors = [] } = useQuery<any[]>({
    queryKey: ['/api/tutoring/tutors'],
    queryFn: () => api.get('/tutoring/tutors'),
    enabled: open,
  });

  const {
    register, handleSubmit, watch, reset, control,
    formState: { isSubmitting, errors }
  } = useForm({
    defaultValues: {
      isUrgent: false,
      teacherId: '',
      subject: '',
      lecturerLevel: 'grade_10',
      educationType: '',
      topic: '',
      preferredAt: '',
      durationMinutes: '60',
      message: '',
    }
  });

  const isUrgent = watch('isUrgent');
  const selectedTeacherId = watch('teacherId');
  const selectedDuration = watch('durationMinutes');
  const selectedLevel = watch('lecturerLevel');
  const selectedEducationType = watch('educationType');

  const selectedTeacher = tutors.find((t: any) => String(t.id) === String(selectedTeacherId));
  const estimatedCost = React.useMemo(() => {
    const gradeMinRate = getGradeRate(selectedLevel, selectedEducationType);
    const mins = parseInt(selectedDuration) || 60;

    let hourlyRate = gradeMinRate;
    if (!isUrgent && selectedTeacherId && selectedTeacher) {
      const teacherRate = parseFloat(selectedTeacher.tutoringHourlyRate ?? 0);
      hourlyRate = Math.max(teacherRate, gradeMinRate);
    }

    return parseFloat(((hourlyRate * mins) / 60).toFixed(2));
  }, [isUrgent, selectedTeacherId, selectedTeacher, selectedDuration, selectedLevel, selectedEducationType]);

  const minDT = new Date();
  minDT.setHours(minDT.getHours() + 1);
  // Format as local YYYY-MM-DDTHH:mm to avoid UTC offset bugs in datetime-local
  const minDTStr = new Date(minDT.getTime() - minDT.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const onSubmit = async (data: any) => {
    try {
      await api.post('/tutoring/requests', {
        ...data,
        isUrgent: !!data.isUrgent,
        teacherId: data.isUrgent ? null : (data.teacherId ? parseInt(data.teacherId) : null),
        durationMinutes: parseInt(data.durationMinutes),
      });
      toast({ title: `✅ Request submitted! ${estimatedCost} LYD has been held from your balance.` });
      queryClient.invalidateQueries({ queryKey: ['/api/tutoring/requests'] });
      reset();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Failed to submit request',
        description: err.message || 'Please check your balance and try again.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent 
        className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            Request a 1-to-1 Session
            <span className="block text-sm font-normal text-muted-foreground mt-0.5">
              طلب جلسة خاصة
            </span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2 pb-2 border-b border-border">
          A reservation of <strong>{estimatedCost} LYD</strong> will be held from your wallet based on the selected teacher &amp; duration. It's refunded instantly if the request is cancelled or declined.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-1">
          {/* Row 1: Lecturer Level + Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Lecturer Level</label>
              <select {...register('lecturerLevel')} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm">
                {GRADE_LEVELS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Subject <span className="text-destructive">*</span></label>
              <select
                {...register('subject', { required: 'Subject is required' })}
                className={`w-full px-3 py-2 rounded-xl border bg-background text-sm ${errors.subject ? 'border-destructive' : 'border-input'}`}
              >
                <option value="">-- Select Subject / اختر المادة --</option>
                {TUTORING_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject.message as string}</p>}
            </div>
          </div>

          {/* Education Type (Hidden for Uni-level) */}
          {selectedLevel !== 'university' && (
            <div className="space-y-2">
              <label className="text-sm font-medium block">Education Type / نوع التعليم <span className="text-destructive">*</span></label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    value="international"
                    {...register('educationType', { required: selectedLevel !== 'university' ? 'Education Type is required' : false })}
                    className="w-4 h-4 accent-primary"
                  />
                  International / تعليم دولي
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    value="local"
                    {...register('educationType', { required: selectedLevel !== 'university' ? 'Education Type is required' : false })}
                    className="w-4 h-4 accent-primary"
                  />
                  Local / تعليم محلي
                </label>
              </div>
              {errors.educationType && <p className="text-xs text-destructive">{errors.educationType.message as string}</p>}
            </div>
          )}

          {/* Urgent toggle */}
          <Controller
            name="isUrgent"
            control={control}
            render={({ field }) => (
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${field.value ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : 'border-border bg-muted/30 hover:bg-muted/50'}`}>
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={e => field.onChange(e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                  id="isUrgent"
                />
                <div>
                  <div className="text-sm font-semibold">🚨 Mark as Urgent</div>
                  <div className="text-xs text-muted-foreground">Any available teacher can accept immediately — you can't pick a specific teacher</div>
                </div>
              </label>
            )}
          />

          {/* Teacher select — only shown if not urgent */}
          {!isUrgent && (
            <div>
              <label className="text-sm font-medium block mb-1">Select Teacher (Optional)</label>
              <select {...register('teacherId')} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm">
                <option value="">Any Teacher / أي معلم متاح</option>
                {tutors.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}{t.tutoringSubjects ? ` — ${t.tutoringSubjects}` : ''}
                  </option>
                ))}
              </select>
              {tutors.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No tutors have enabled 1-to-1 sessions yet.</p>
              )}
            </div>
          )}

          {/* Row 2: Date/Time + Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Preferred Date &amp; Time <span className="text-destructive">*</span></label>
              <Input
                {...register('preferredAt', { required: 'Date & time is required' })}
                type="datetime-local"
                min={minDTStr}
                className={errors.preferredAt ? 'border-destructive' : ''}
              />
              {errors.preferredAt && <p className="text-xs text-destructive mt-1">{errors.preferredAt.message as string}</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Duration</label>
              <select {...register('durationMinutes')} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm">
                <option value="30">30 minutes</option>
                <option value="60">60 minutes (1 hour)</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes (2 hours)</option>
              </select>
            </div>
          </div>

          {/* Specific Topic */}
          <div>
            <label className="text-sm font-medium block mb-1">Specific Topic</label>
            <Input {...register('topic')} placeholder="e.g. Quadratic equations, Photosynthesis..." />
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium block mb-1">Message to Teacher</label>
            <textarea
              {...register('message')}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none"
              placeholder="Any extra context, your current level, resources needed..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1 gap-2 h-11" disabled={isSubmitting}>
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting…' : `Submit Request (${estimatedCost} LYD reserved)`}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({
  r,
  isTeacher,
  onTeacherAction,
  onStudentAction,
  onProposeTime,
}: {
  r: any;
  isTeacher: boolean;
  onTeacherAction: (id: number, action: 'accept' | 'decline') => void;
  onStudentAction: (id: number, action: 'accept-proposed-time' | 'cancel' | 'complete') => void;
  onProposeTime: (r: any) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Status + badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status] || r.status}</Badge>
            {r.isUrgent && <Badge className="bg-red-100 text-red-800 border-red-200">🚨 Urgent</Badge>}
            <span className="text-xs text-muted-foreground font-mono">#{r.id}</span>
          </div>

          {/* Subject + topic */}
          <h3 className="font-bold text-lg leading-tight">
            {r.subject}
            {r.topic && <span className="text-muted-foreground font-normal text-base"> — {r.topic}</span>}
          </h3>

          {/* Counterpart name */}
          <p className="text-sm text-muted-foreground mt-1">
            {isTeacher
              ? `Student: ${r.studentName || '—'}`
              : `Teacher: ${r.teacherName || 'Any Available Teacher'}`}
          </p>

          {/* Level */}
          {r.lecturerLevel && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Level: {GRADE_LEVELS.find(g => g.value === r.lecturerLevel)?.label || r.lecturerLevel}
            </p>
          )}

          {/* Times */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1.5 text-foreground">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span>Preferred: {new Date(r.preferredAt).toLocaleString()}</span>
            </div>
            {r.proposedAt && (
              <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Proposed: {new Date(r.proposedAt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{r.durationMinutes} min</span>
            </div>
          </div>

          {/* Message */}
          {r.message && (
            <div className="mt-3 p-3 bg-muted/50 rounded-xl text-sm border border-border/50">
              <MessageSquare className="w-4 h-4 inline mr-2 text-muted-foreground" />
              {r.message}
            </div>
          )}
        </div>

        {/* Right side: amount + actions */}
        <div className="shrink-0 flex flex-col items-end gap-2 min-w-[140px]">
          <div className="text-xl font-bold text-primary">{r.totalAmount} LYD</div>

          {/* Meeting link (if accepted) */}
          {r.status === 'accepted' && r.meetingUrl && (
            <Button asChild size="sm" className="w-full bg-green-600 hover:bg-green-700 gap-2">
              <Link href={`/tutoring/room/${r.id}`}>
                <ExternalLink className="w-3.5 h-3.5" /> Join Meeting
              </Link>
            </Button>
          )}

          {/* Teacher actions */}
          {isTeacher && r.status === 'pending' && (
            <div className="flex flex-col gap-2 w-full">
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => onTeacherAction(r.id, 'accept')}>
                ✓ Accept
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => onProposeTime(r)}>
                📅 Propose Time
              </Button>
              <Button size="sm" variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onTeacherAction(r.id, 'decline')}>
                ✗ Decline
              </Button>
            </div>
          )}

          {/* Student: accept/decline proposed time */}
          {!isTeacher && r.status === 'rescheduled_by_teacher' && (
            <div className="flex flex-col gap-2 w-full">
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => onStudentAction(r.id, 'accept-proposed-time')}>
                ✓ Accept New Time
              </Button>
              <Button size="sm" variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onStudentAction(r.id, 'cancel')}>
                ✗ Decline &amp; Refund
              </Button>
            </div>
          )}

          {/* Student: cancel pending request */}
          {!isTeacher && r.status === 'pending' && (
            <Button size="sm" variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => onStudentAction(r.id, 'cancel')}>
              Cancel &amp; Refund
            </Button>
          )}


        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Tutoring() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proposeFor, setProposeFor] = useState<any>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [feedbackRequestId, setFeedbackRequestId] = useState<number | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('feedbackFor');
    if (id) {
      setFeedbackRequestId(parseInt(id));
      window.history.replaceState({}, '', '/tutoring');
    }
  }, []);

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tutoring/requests'],
    queryFn: () => api.get('/tutoring/requests'),
    refetchInterval: 12000,
    enabled: !!user,
  });

  const handleTeacherAction = async (id: number, action: 'accept' | 'decline') => {
    try {
      await api.post(`/tutoring/requests/${id}/${action}`, {});
      toast({ title: action === 'accept' ? '✅ Request accepted! Meeting link generated.' : '✅ Request declined. Student has been refunded.' });
      queryClient.invalidateQueries({ queryKey: ['/api/tutoring/requests'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleStudentAction = async (id: number, action: 'accept-proposed-time' | 'cancel' | 'complete') => {
    try {
      await api.post(`/tutoring/requests/${id}/${action}`, {});
      const messages: Record<string, string> = {
        'accept-proposed-time': '✅ New time accepted! Meeting link is ready.',
        'cancel': '✅ Request cancelled. Your balance has been refunded.',
        'complete': '✅ Session marked as complete. Thank you!',
      };
      toast({ title: messages[action] });
      queryClient.invalidateQueries({ queryKey: ['/api/tutoring/requests'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (authLoading) {
    return <PageContainer><div className="p-20 text-center text-muted-foreground">Loading...</div></PageContainer>;
  }

  const showLoginModal = !user;

  return (
    <PageContainer>
      {showLoginModal && (
        <Dialog open={showLoginModal} onOpenChange={(open) => {
          if (!open) {
            setLocation('/');
          }
        }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-center text-xl">Login Required / تسجيل الدخول مطلوب</DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <p className="text-muted-foreground mb-6 text-sm">
                Please log in to request a 1-to-1 session or manage your tutoring schedule.
                <br /><br />
                يرجى تسجيل الدخول لطلب جلسة خاصة أو إدارة جدول التدريس الخاص بك.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  onClick={() => setLocation('/login?returnTo=%2Ftutoring')}
                >
                  Log In / Sign Up
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation('/')}
                >
                  Back to Home / العودة للرئيسية
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className={showLoginModal ? 'pointer-events-none select-none' : ''}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-primary font-semibold uppercase tracking-widest mb-1">1-to-1 Tutoring</p>
                <h1 className="text-3xl font-display font-bold">
                  {isTeacher ? 'Manage Tutoring Sessions' : 'My Sessions / جلساتي'}
                </h1>
                <p className="text-muted-foreground mt-2 max-w-xl">
                  {isTeacher
                    ? 'Accept student requests, propose alternative times, and conduct private sessions.'
                    : 'All your private tutoring sessions in one place. Request a new session whenever you need help.'}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {isTeacher && (
                  <Button variant="outline" className="gap-2 shrink-0 bg-background" onClick={() => setSettingsOpen(true)}>
                    <Settings className="w-4 h-4" /> Tutoring Settings
                  </Button>
                )}
                {!isTeacher && (
                  <Button
                    className="gap-2 shrink-0 h-11 px-5 shadow-md"
                    onClick={() => setRequestModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Request Session
                    <span className="text-xs opacity-70 hidden sm:inline">/ طلب جلسة</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Pending count banner for students */}
          {!isTeacher && requests.filter((r: any) => r.status === 'pending').length > 0 && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-medium">
              <Clock className="w-4 h-4 shrink-0" />
              You have <strong>{requests.filter((r: any) => r.status === 'pending').length}</strong> pending session{requests.filter((r: any) => r.status === 'pending').length > 1 ? 's' : ''} awaiting teacher response.
            </div>
          )}

          {/* Session List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-10 text-center text-muted-foreground">Loading sessions…</div>
            ) : requests.length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-bold">
                  {isTeacher ? 'No sessions yet' : 'No sessions yet / لا توجد جلسات بعد'}
                </h3>
                <p className="text-muted-foreground text-sm mt-1 mb-6">
                  {isTeacher
                    ? 'Student requests will appear here. Make sure you have enabled tutoring in settings.'
                    : 'Click the button below to request your first private tutoring session.'}
                </p>
                {isTeacher ? (
                  <Button variant="outline" className="gap-2" onClick={() => setSettingsOpen(true)}>
                    <Settings className="w-4 h-4" /> Open Tutoring Settings
                  </Button>
                ) : (
                  <Button className="gap-2 h-11 px-6" onClick={() => setRequestModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Request Your First Session
                  </Button>
                )}
              </div>
            ) : (
              requests.map((r: any) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  isTeacher={isTeacher}
                  onTeacherAction={handleTeacherAction}
                  onStudentAction={handleStudentAction}
                  onProposeTime={setProposeFor}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProposeTimeModal request={proposeFor} open={!!proposeFor} onClose={() => setProposeFor(null)} />
      <RequestSessionModal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} />
      <FeedbackModal requestId={feedbackRequestId} open={!!feedbackRequestId} onClose={() => setFeedbackRequestId(null)} />
    </PageContainer>
  );
}
