import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar, Clock, CheckCircle2, ChevronRight, ChevronLeft,
  Radio, Trash2, RotateCcw, BookOpen, DollarSign, Users,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionSlot {
  scheduledAt: string; // datetime-local value (local time string)
}

interface WizardState {
  // Step 1
  title: string;
  titleAr: string;
  description: string;
  lessonCount: number;
  pricePerSession: number;
  durationMinutes: number;
  maxParticipants: number;
  meetingUrl: string;
  // Step 2
  sessions: SessionSlot[];
  // Recurring helper
  recurringStartDate: string;
  recurringTime: string;
  recurringDays: number[]; // 0=Sun … 6=Sat
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIER_DURATION_LIMITS: Record<string, number> = {
  free: 30,
  bronze: 45,
  golden: 90,
  diamond: 360,
};

// ─── Utility: next occurrence of a weekday on/after a given date ───────────────
function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Given a start date, a list of weekdays, a time string (HH:MM), and a count,
 * generates `count` datetime-local strings distributed across chosen weekdays.
 */
function generateRecurringSlots(
  startDate: string,
  weekdays: number[],
  time: string,
  count: number
): string[] {
  if (!startDate || weekdays.length === 0 || !time || count <= 0) return [];

  const slots: string[] = [];
  const [hours, minutes] = time.split(':').map(Number);
  const sorted = [...weekdays].sort((a, b) => a - b);

  // Build an ordered list of (year/month/day) candidates starting from startDate
  let cursor = new Date(startDate + 'T00:00:00');

  while (slots.length < count) {
    for (const wd of sorted) {
      if (slots.length >= count) break;
      let d = nextWeekday(cursor, wd);
      // Make sure d >= cursor (nextWeekday can return the same day)
      if (d < cursor) d.setDate(d.getDate() + 7);
      const dt = new Date(d);
      dt.setHours(hours, minutes, 0, 0);
      // format as datetime-local value
      const pad = (n: number) => String(n).padStart(2, '0');
      const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(hours)}:${pad(minutes)}`;
      slots.push(local);
    }
    // Advance cursor by one week
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return slots.slice(0, count);
}

// ─── Step indicators ──────────────────────────────────────────────────────────
function StepDot({ step, current, label }: { step: number; current: number; label: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          done
            ? 'bg-green-500 text-white'
            : active
            ? 'bg-primary text-white ring-4 ring-primary/20'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {done ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span className={`text-[11px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ScheduleLiveCourseModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tier = (user as any)?.tier ?? 'free';
  const maxDuration = TIER_DURATION_LIMITS[tier] ?? 30;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const defaultState: WizardState = {
    title: '',
    titleAr: '',
    description: '',
    lessonCount: 4,
    pricePerSession: 0,
    durationMinutes: Math.min(60, maxDuration),
    maxParticipants: 30,
    meetingUrl: '',
    sessions: Array.from({ length: 4 }, () => ({ scheduledAt: '' })),
    recurringStartDate: '',
    recurringTime: '10:00',
    recurringDays: [],
  };

  const [form, setForm] = useState<WizardState>(defaultState);

  const resetAndClose = useCallback(() => {
    setForm(defaultState);
    setStep(1);
    onClose();
  }, [onClose]);

  // ── Step 1 helpers ──────────────────────────────────────────────────────────
  const handleLessonCountChange = (count: number) => {
    const clamped = Math.max(1, Math.min(100, count));
    setForm((prev) => {
      const newSessions = Array.from({ length: clamped }, (_, i) => ({
        scheduledAt: prev.sessions[i]?.scheduledAt ?? '',
      }));
      return { ...prev, lessonCount: clamped, sessions: newSessions };
    });
  };

  // ── Step 2 helpers ──────────────────────────────────────────────────────────
  const applyRecurringPattern = () => {
    const slots = generateRecurringSlots(
      form.recurringStartDate,
      form.recurringDays,
      form.recurringTime,
      form.lessonCount
    );
    if (slots.length === 0) {
      toast({ title: 'Please set a start date, weekdays, and time first.', variant: 'destructive' });
      return;
    }
    setForm((prev) => ({
      ...prev,
      sessions: slots.map((s) => ({ scheduledAt: s })),
    }));
  };

  const updateSession = (idx: number, value: string) => {
    setForm((prev) => {
      const sessions = [...prev.sessions];
      sessions[idx] = { scheduledAt: value };
      return { ...prev, sessions };
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const step1Valid =
    form.title.trim() !== '' &&
    form.titleAr.trim() !== '' &&
    form.lessonCount >= 1 &&
    form.lessonCount <= 100 &&
    form.durationMinutes >= 15 &&
    form.durationMinutes <= maxDuration;

  const step2Valid = form.sessions.every((s) => s.scheduledAt !== '');

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!step2Valid) {
      toast({ title: 'Please fill in all session dates and times.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/live-session-courses', {
        title: form.title,
        titleAr: form.titleAr,
        description: form.description || undefined,
        pricePerSession: form.pricePerSession,
        durationMinutes: form.durationMinutes,
        maxParticipants: form.maxParticipants,
        meetingUrl: form.meetingUrl || undefined,
        sessions: form.sessions.map((s) => ({
          scheduledAt: new Date(s.scheduledAt).toISOString(),
        })),
      });
      toast({ title: '🎉 Live session course created!', description: `${form.lessonCount} sessions scheduled.` });
      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/live-session-courses'] });
      resetAndClose();
    } catch (err: any) {
      toast({ title: 'Failed to create course', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Radio className="w-5 h-5 text-red-600" />
            </div>
            <DialogTitle className="text-xl font-display font-bold">
              Schedule Live Session Course
            </DialogTitle>
          </div>

          {/* Step progress bar */}
          <div className="flex items-center justify-center gap-4 pt-2 pb-1">
            <StepDot step={1} current={step} label="Details" />
            <div className={`flex-1 h-0.5 rounded-full transition-colors ${step > 1 ? 'bg-green-400' : 'bg-border'}`} />
            <StepDot step={2} current={step} label="Schedule" />
            <div className={`flex-1 h-0.5 rounded-full transition-colors ${step > 2 ? 'bg-green-400' : 'bg-border'}`} />
            <StepDot step={3} current={step} label="Confirm" />
          </div>
        </DialogHeader>

        {/* ── Step 1: Course Details ── */}
        {step === 1 && (
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Course Title (EN) *</label>
                <Input
                  id="lsc-title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Advanced Arabic Grammar"
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">العنوان (AR) *</label>
                <Input
                  id="lsc-title-ar"
                  dir="rtl"
                  value={form.titleAr}
                  onChange={(e) => setForm((p) => ({ ...p, titleAr: e.target.value }))}
                  placeholder="مثال: قواعد اللغة العربية المتقدمة"
                  className="h-11"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
              <Textarea
                id="lsc-description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What will students learn in this course?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Lessons *
                </label>
                <Input
                  id="lsc-lesson-count"
                  type="number"
                  min={1}
                  max={100}
                  value={form.lessonCount}
                  onChange={(e) => handleLessonCountChange(parseInt(e.target.value) || 1)}
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Duration
                  {tier !== 'diamond' && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold ml-1">
                      max {maxDuration}m
                    </span>
                  )}
                </label>
                <Input
                  id="lsc-duration"
                  type="number"
                  min={15}
                  max={maxDuration}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      durationMinutes: Math.min(maxDuration, Math.max(15, parseInt(e.target.value) || 15)),
                    }))
                  }
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Max Seats
                </label>
                <Input
                  id="lsc-max-participants"
                  type="number"
                  min={1}
                  value={form.maxParticipants}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, maxParticipants: parseInt(e.target.value) || 1 }))
                  }
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Price/session
                </label>
                <Input
                  id="lsc-price"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.pricePerSession}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, pricePerSession: parseFloat(e.target.value) || 0 }))
                  }
                  className="h-11"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">External Meeting Link (optional)</label>
              <Input
                id="lsc-meeting-url"
                type="url"
                value={form.meetingUrl}
                onChange={(e) => setForm((p) => ({ ...p, meetingUrl: e.target.value }))}
                placeholder="https://zoom.us/j/..."
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed bg-primary/5 p-2 rounded-lg border border-primary/10">
                💡 <strong>Leave blank</strong> to auto-generate an embedded EduLibya live room per session.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                id="lsc-step1-next"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="gap-2"
              >
                Next: Schedule Sessions <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Schedule Sessions ── */}
        {step === 2 && (
          <div className="space-y-5 pt-2">
            {/* Recurring pattern helper */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-primary" />
                Auto-fill recurring pattern
                <span className="text-xs text-muted-foreground font-normal">(optional helper)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Start date</label>
                  <Input
                    type="date"
                    value={form.recurringStartDate}
                    onChange={(e) => setForm((p) => ({ ...p, recurringStartDate: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Time (per session)</label>
                  <Input
                    type="time"
                    value={form.recurringTime}
                    onChange={(e) => setForm((p) => ({ ...p, recurringTime: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Repeat on days</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((name, idx) => {
                    const selected = form.recurringDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            recurringDays: selected
                              ? p.recurringDays.filter((d) => d !== idx)
                              : [...p.recurringDays, idx],
                          }))
                        }
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          selected
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-primary border-primary/30"
                onClick={applyRecurringPattern}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Apply to all {form.lessonCount} sessions
              </Button>
            </div>

            {/* Per-session date/time pickers */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {form.sessions.map((s, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <Input
                      type="datetime-local"
                      value={s.scheduledAt}
                      onChange={(e) => updateSession(idx, e.target.value)}
                      className={`h-10 text-sm ${!s.scheduledAt ? 'border-destructive/50' : ''}`}
                    />
                  </div>
                  {s.scheduledAt && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                      {format(new Date(s.scheduledAt), 'EEE, MMM d')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-1">
              <Button id="lsc-step2-back" variant="ghost" className="gap-2" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                id="lsc-step2-next"
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="gap-2"
              >
                Next: Confirm <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm Summary ── */}
        {step === 3 && (
          <div className="space-y-5 pt-2">
            {/* Course card summary */}
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg leading-tight">{form.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5" dir="rtl">{form.titleAr}</p>
                  {form.description && (
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{form.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Sessions', value: form.lessonCount, icon: BookOpen },
                  { label: 'Duration', value: `${form.durationMinutes} min`, icon: Clock },
                  { label: 'Max seats', value: form.maxParticipants, icon: Users },
                  { label: 'Price/session', value: form.pricePerSession === 0 ? 'Free' : `${form.pricePerSession} LYD`, icon: DollarSign },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-background/60 rounded-xl p-3 border border-border">
                    <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
                    <div className="font-bold text-sm">{value}</div>
                    <div className="text-[11px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session list */}
            <div>
              <h4 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Scheduled Sessions
              </h4>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {form.sessions.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-card rounded-xl border border-border px-4 py-2.5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {s.scheduledAt ? format(new Date(s.scheduledAt), "EEE, MMM d yyyy 'at' h:mm a") : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">{form.durationMinutes} min · {form.maxParticipants} seats</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                      Scheduled
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {form.pricePerSession > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <strong>Total course value:</strong> {(form.pricePerSession * form.lessonCount).toFixed(2)} LYD
                &nbsp;({form.lessonCount} × {form.pricePerSession} LYD)
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button id="lsc-step3-back" variant="ghost" className="gap-2" onClick={() => setStep(2)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                id="lsc-create-btn"
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 bg-primary hover:bg-primary/90 text-white px-6"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Create Course ({form.lessonCount} sessions)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
