import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useGetTeacherCourses } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { ArrowLeft, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';

export default function CreateSession() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const api = useApi();

  const { data: courses } = useGetTeacherCourses({
    query: { queryKey: ['/api/teacher/courses'], enabled: !!user && user.role === 'teacher' }
  });

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
    if (user && user.role !== 'teacher') setLocation('/dashboard');
  }, [isAuthenticated, authLoading, user, setLocation]);

  const sessionForm = useForm({
    defaultValues: {
      title: '', titleAr: '', description: '',
      scheduledAt: '', durationMinutes: 60,
      maxParticipants: 100, meetingUrl: '', price: 0,
      courseId: ''
    }
  });

  const handleCreateSession = async (data: any) => {
    try {
      await api.post('/live-sessions', {
        ...data,
        durationMinutes: parseInt(data.durationMinutes),
        maxParticipants: parseInt(data.maxParticipants),
        price: parseFloat(data.price) || 0,
        courseId: data.courseId ? parseInt(data.courseId) : undefined,
      });
      toast({ title: 'Live session scheduled!' });
      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions'] });
      setLocation('/teacher/dashboard');
    } catch (err: any) {
      toast({ title: 'Error scheduling session', description: err.message, variant: 'destructive' });
    }
  };

  if (authLoading) {
    return <PageContainer><div className="p-20 text-center">Loading...</div></PageContainer>;
  }
  if (!user || user.role !== 'teacher') return null;

  return (
    <PageContainer>
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-8 border-b border-primary/10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <Link href="/teacher/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <Radio className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Schedule Live Session</h1>
              <p className="text-sm text-muted-foreground">Set up a live interactive session with your students</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <form onSubmit={sessionForm.handleSubmit(handleCreateSession)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Session Title (EN) *</label>
                <Input {...sessionForm.register('title', { required: true })} placeholder="e.g. Live Q&A — Chapter 5" className="h-11" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">العنوان (AR) *</label>
                <Input {...sessionForm.register('titleAr', { required: true })} dir="rtl" placeholder="مراجعة مباشرة" className="h-11" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea {...sessionForm.register('description')} placeholder="What will you cover in this session?" rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date & Time *</label>
                <Input type="datetime-local" {...sessionForm.register('scheduledAt', { required: true })} className="h-11" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                  Duration (minutes)
                  {(user as any)?.tier === 'free' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">Max 30 min</span>}
                  {(user as any)?.tier === 'bronze' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">Max 45 min</span>}
                  {(user as any)?.tier === 'golden' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">Max 90 min</span>}
                </label>
                <Input 
                  type="number" 
                  min="15" 
                  max={(user as any)?.tier === 'free' ? 30 : (user as any)?.tier === 'bronze' ? 45 : (user as any)?.tier === 'golden' ? 90 : 360} 
                  {...sessionForm.register('durationMinutes', { valueAsNumber: true })} 
                  className="h-11" 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Max Participants</label>
                <Input type="number" min="1" {...sessionForm.register('maxParticipants', { valueAsNumber: true })} className="h-11" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Price (LYD, 0 = Free)</label>
                <Input type="number" min="0" step="0.5" {...sessionForm.register('price', { valueAsNumber: true })} className="h-11" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-foreground">External Meeting Link (Optional)</label>
              <Input type="url" {...sessionForm.register('meetingUrl')} placeholder="https://zoom.us/j/..." className="h-11" />
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed bg-primary/5 p-2 rounded-lg border border-primary/10">
                💡 <strong>EduLibya Live Classroom:</strong> If you leave this blank, the platform will automatically generate a fully featured, embedded live room for you and your students.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Link to Course (optional)</label>
              <select {...sessionForm.register('courseId')} className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">No course (standalone session)</option>
                {courses?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Link href="/teacher/dashboard" className="flex-1">
                <Button type="button" variant="outline" className="w-full h-11">Cancel</Button>
              </Link>
              <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-primary/90">Schedule Session</Button>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
