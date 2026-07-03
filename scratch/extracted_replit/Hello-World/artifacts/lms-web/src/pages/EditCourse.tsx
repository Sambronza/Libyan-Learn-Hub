import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useGetCategories } from '@workspace/api-client-react';
import { useLocation, useParams, Link } from 'wouter';
import { ArrowLeft, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';

export default function EditCourse() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const api = useApi();
  const { data: categories } = useGetCategories();
  const [courseLoading, setCourseLoading] = useState(true);

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
    if (user && user.role !== 'teacher') setLocation('/dashboard');
  }, [isAuthenticated, authLoading, user, setLocation]);

  const courseForm = useForm({
    defaultValues: {
      title: '', titleAr: '', description: '', descriptionAr: '',
      price: 0, categoryId: '', level: 'beginner', language: 'ar',
      thumbnailUrl: ''
    }
  });

  // Load existing course data
  useEffect(() => {
    if (!courseId || !user) return;
    api.get(`/teacher/courses`).then((courses: any[]) => {
      const course = courses?.find((c: any) => String(c.id) === String(courseId));
      if (course) {
        courseForm.reset({
          title: course.title,
          titleAr: course.titleAr,
          description: course.description,
          descriptionAr: course.descriptionAr,
          price: course.price,
          categoryId: String(course.categoryId),
          level: course.level,
          language: course.language,
          thumbnailUrl: course.thumbnailUrl || ''
        });
      }
      setCourseLoading(false);
    }).catch(() => setCourseLoading(false));
  }, [courseId, user]);

  const handleUpdateCourse = async (data: any) => {
    try {
      await api.put(`/courses/${courseId}`, {
        ...data,
        price: parseFloat(data.price) || 0,
        categoryId: parseInt(data.categoryId),
      });
      toast({ title: 'Course updated!' });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/courses'] });
      setLocation('/teacher/dashboard');
    } catch (err: any) {
      toast({ title: 'Error updating course', description: err.message, variant: 'destructive' });
    }
  };

  if (authLoading || courseLoading) {
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
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Edit className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Edit Course</h1>
              <p className="text-sm text-muted-foreground">Update your course details</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <form onSubmit={courseForm.handleSubmit(handleUpdateCourse)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Title (English) *</label>
                <Input {...courseForm.register('title', { required: true })} placeholder="e.g. Mathematics Grade 12" className="h-11" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">العنوان (عربي) *</label>
                <Input {...courseForm.register('titleAr', { required: true })} dir="rtl" placeholder="مثال: رياضيات الصف الثاني عشر" className="h-11" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (English) *</label>
              <Textarea {...courseForm.register('description', { required: true })} placeholder="Describe your course..." rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الوصف (عربي) *</label>
              <Textarea {...courseForm.register('descriptionAr', { required: true })} dir="rtl" placeholder="اوصف دورتك..." rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Thumbnail Image URL</label>
              <Input {...courseForm.register('thumbnailUrl')} placeholder="https://..." type="url" className="h-11" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category *</label>
                <select
                  {...courseForm.register('categoryId', { required: true })}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select category</option>
                  {categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Price (LYD)</label>
                <Input type="number" min="0" step="0.5" {...courseForm.register('price', { valueAsNumber: true })} placeholder="0 = Free" className="h-11" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Level</label>
                <select {...courseForm.register('level')} className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Language</label>
                <select {...courseForm.register('language')} className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="ar">Arabic</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-sm text-muted-foreground bg-blue-50 text-blue-800 p-3 rounded-md border border-blue-100">
                To change the publication status of this course, please contact an administrator.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Link href="/teacher/dashboard" className="flex-1">
                <Button type="button" variant="outline" className="w-full h-11">Cancel</Button>
              </Link>
              <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-primary/90">Save Changes</Button>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
