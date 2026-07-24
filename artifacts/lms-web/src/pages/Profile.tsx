import React, { useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { useLocation, Link } from 'wouter';
import { User, BookOpen, Clock, Trophy, Mail, Settings, PlayCircle, Shield, Globe, Pencil, Wallet, CreditCard, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PasskeyModal } from '@/components/layout/PasskeyModal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUpdateProfile } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  bio: z.string().optional(),
  language: z.enum(['en', 'ar']),
  email: z.string().email('Invalid email address').optional(),
  avatarUrl: z.string().optional(),
  currentPassword: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
}).refine(data => {
  if (data.newPassword && !data.currentPassword) return false;
  return true;
}, { message: "Current password is required to set a new password", path: ["currentPassword"] });

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user, isAuthenticated, isLoading: authLoading, refetchUser } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const { toast } = useToast();
  const { t, language: currentLanguage, setLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [redeemCode, setRedeemCode] = React.useState('');
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [isPasskeyOpen, setIsPasskeyOpen] = React.useState(false);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const token = localStorage.getItem('lms_token');
      const resRaw = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!resRaw.ok) {
        const errorData = await resRaw.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || resRaw.statusText);
      }

      const res = await resRaw.json();

      form.setValue('avatarUrl', res.url);
      toast({ title: 'Image uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Error uploading image', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode) return;
    setIsRedeeming(true);
    try {
      const res = await api.post('/payments/redeem-code', { code: redeemCode });
      toast({ title: currentLanguage === 'ar' ? 'تم بنجاح' : 'Success', description: currentLanguage === 'ar' ? `تم استخدام البطاقة بنجاح! أُضيف ${res.value || ''} د.ل.` : `Card redeemed successfully! Added ${res.value || ''} LYD.` });
      setRedeemCode('');
      refetchUser();
    } catch (err: any) {
      toast({ title: currentLanguage === 'ar' ? 'خطأ' : 'Error', description: err.message || (currentLanguage === 'ar' ? 'فشل استخدام الرمز' : 'Failed to redeem code'), variant: "destructive" });
    } finally {
      setIsRedeeming(false);
    }
  };

  const { mutateAsync: updateProfileAsync, isPending: isUpdating } = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        toast({ title: t('profile.update_success') });
      },
      onError: (err: any) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    }
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      bio: user?.bio || '',
      language: user?.language || currentLanguage,
      avatarUrl: user?.avatarUrl || '',
    }
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      // 1. Update Profile (Name, Bio, Language, Avatar)
      await updateProfileAsync({ data: { fullName: data.fullName, bio: data.bio, language: data.language, avatarUrl: data.avatarUrl } as any });
      
      // 2. Update Email if changed
      if (data.email && data.email !== user?.email) {
        await api.put('/users/email', { newEmail: data.email });
        toast({ title: currentLanguage === 'ar' ? 'تم تحديث البريد الإلكتروني. يرجى تأكيد بريدك الجديد.' : 'Email updated successfully. Please verify your new email.' });
      }

      // 3. Update Password if provided
      if (data.currentPassword && data.newPassword) {
        await api.post('/auth/update-password', {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        });
        toast({ title: currentLanguage === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully' });
      }

      if (data.language !== currentLanguage) {
        setLanguage(data.language);
      }
      
      form.reset({
        fullName: data.fullName,
        bio: data.bio,
        language: data.language,
        avatarUrl: data.avatarUrl,
        email: data.email,
        currentPassword: '',
        newPassword: '',
      });
      setIsSettingsOpen(false);
      refetchUser();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'An error occurred during update', variant: 'destructive' });
    }
  };

  // Reset form when user data changes or modal opens
  useEffect(() => {
    if (user && isSettingsOpen) {
      form.reset({
        fullName: user.fullName || '',
        bio: user.bio || '',
        language: user.language || currentLanguage,
        avatarUrl: user.avatarUrl || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
      });
    }
  }, [user, isSettingsOpen, form, currentLanguage]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['progress-summary'],
    queryFn: () => api.get('/progress/summary'),
    enabled: !!user,
  });

  if (authLoading || isLoading) {
    return <PageContainer><div className="p-20 text-center">Loading profile...</div></PageContainer>;
  }

  if (!user) return null;

  return (
    <PageContainer>
      {/* Profile Header */}
      <div className="bg-card border-b border-border">
        {/* Gradient cover banner */}
        <div className="h-32 sm:h-40 bg-gradient-to-r from-primary via-violet-600 to-secondary relative overflow-hidden">
          <div className="absolute -top-16 -left-10 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 right-0 w-96 h-96 rounded-full bg-secondary/30 blur-3xl" />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 -mt-16 md:-mt-20">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-5xl font-display font-bold shadow-xl border-4 border-background shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                user.fullName.charAt(0)
              )}
            </div>
            <div className="flex-1 text-center md:text-start md:pt-20">
              <h1 className="text-4xl font-display font-bold text-foreground mb-2">{user.fullName}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-muted-foreground mb-6">
                <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user.email}</span>
                <span className="flex items-center gap-1.5 capitalize"><User className="w-4 h-4" /> {user.role}</span>
              </div>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl">
                      <Settings className="w-4 h-4 mr-2" /> {t('profile.settings')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-display font-bold">{t('profile.settings')}</DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                          <User className="w-4 h-4" /> {t('profile.personal_info')}
                        </div>
                        
                        <div className="grid gap-2">
                          <Label>Profile Picture</Label>
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                              {form.watch('avatarUrl') ? (
                                <img src={form.watch('avatarUrl')} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-8 h-8 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <Input 
                                type="file" 
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={isUploadingImage}
                                className="bg-muted/50 border-transparent focus:bg-background rounded-xl"
                              />
                              {isUploadingImage && <p className="text-xs text-primary mt-1">Uploading...</p>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="fullName">{t('profile.name')}</Label>
                          <Input 
                            id="fullName" 
                            {...form.register('fullName')} 
                            className="bg-muted/50 border-transparent focus:bg-background h-12 rounded-xl"
                          />
                          {form.formState.errors.fullName && (
                            <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="bio">{t('profile.bio')}</Label>
                          <Textarea 
                            id="bio" 
                            {...form.register('bio')} 
                            className="bg-muted/50 border-transparent focus:bg-background rounded-xl min-h-[100px]"
                            placeholder="Tell us about yourself..."
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="language">{t('profile.language')}</Label>
                          <select 
                            id="language"
                            {...form.register('language')}
                            className="flex h-12 w-full rounded-xl border border-transparent bg-muted/50 px-3 py-2 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          >
                            <option value="ar">العربية</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                          <Shield className="w-4 h-4" /> {t('profile.security')}
                        </div>
                        
                        <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border">
                          <div>
                            <p className="font-semibold text-sm flex items-center gap-2">
                              <Lock className="w-4 h-4 text-primary" /> Session Passkey
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Lock your session when inactive or closed.</p>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            className="rounded-lg"
                            onClick={() => setIsPasskeyOpen(true)}
                          >
                            {(user as any)?.hasPasskey ? 'Change / Remove' : 'Set up Passkey'}
                          </Button>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label>{t('profile.email')}</Label>
                          <Input 
                            type="email"
                            {...form.register('email')}
                            className="bg-muted/50 border-transparent focus:bg-background h-12 rounded-xl"
                          />
                          {form.formState.errors.email && (
                            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label>Current Password</Label>
                          <Input 
                            type="password"
                            {...form.register('currentPassword')}
                            placeholder="Leave blank if not changing"
                            className="bg-muted/50 border-transparent focus:bg-background h-12 rounded-xl"
                          />
                          {form.formState.errors.currentPassword && (
                            <p className="text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label>New Password</Label>
                          <Input 
                            type="password"
                            {...form.register('newPassword')}
                            placeholder="Leave blank if not changing"
                            className="bg-muted/50 border-transparent focus:bg-background h-12 rounded-xl"
                          />
                          {form.formState.errors.newPassword && (
                            <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
                          )}
                        </div>
                      </div>

                      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20" disabled={isUpdating}>
                        {isUpdating ? t('common.loading') : t('profile.save')}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Overall Stats */}
            <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 md:pt-20 hide-scrollbar">
              <div className="bg-muted/30 border border-border rounded-2xl p-4 min-w-[140px] flex-1 text-center">
                <BookOpen className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{summary?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Enrolled</div>
              </div>
              <div className="bg-muted/30 border border-border rounded-2xl p-4 min-w-[140px] flex-1 text-center">
                <Trophy className="w-6 h-6 text-success mx-auto mb-2" />
                <div className="text-2xl font-bold">
                  {summary?.filter((s: any) => s.overallProgress >= 100).length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              
              {user.role === 'student' && (
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 min-w-[200px] flex-1">
                  <div className="flex items-center gap-2 text-primary font-bold mb-2 justify-center">
                    <Wallet className="w-5 h-5" />
                    My Wallet
                  </div>
                  <div className="text-2xl font-bold text-center text-primary mb-1">
                    {parseFloat(user.balance || "0").toFixed(2)} LYD
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="w-full mt-2" variant="outline">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Redeem Card
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px] rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-display font-bold">Redeem Card</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-muted-foreground">Enter your 12-character code to add credit to your wallet.</p>
                        <Input 
                          placeholder="e.g. LLH-XXXX-XXXX" 
                          value={redeemCode}
                          onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                          className="h-12 text-center text-lg font-mono uppercase tracking-widest bg-muted/50 rounded-xl"
                        />
                        <Button 
                          onClick={handleRedeem} 
                          disabled={!redeemCode || isRedeeming} 
                          className="w-full h-12 text-base font-bold rounded-xl"
                        >
                          {isRedeeming ? "Redeeming..." : "Redeem Now"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-2xl font-display font-bold mb-8">My Learning Progress</h2>
        
        {(!summary || summary.length === 0) ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">No course progress yet</h3>
            <p className="text-muted-foreground mt-2 mb-6">Explore our catalog and start learning today.</p>
            <Link href="/courses">
              <Button>Browse Courses</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {summary.map((course: any) => (
              <div key={course.courseId} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="w-full md:w-48 aspect-video rounded-xl bg-muted overflow-hidden shrink-0 relative">
                    {course.thumbnailUrl ? (
                      <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <PlayCircle className="w-8 h-8 text-primary/40" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-xl font-bold truncate">{course.title}</h3>
                      {course.overallProgress >= 100 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
                          <Trophy className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">Instructor: {course.teacherName}</p>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Overall Progress</span>
                        <span className="text-primary">{Math.round(course.overallProgress)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-500 ease-out" 
                          style={{ width: `${Math.min(course.overallProgress, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-border">
                    <Link href={`/courses/${course.courseId}/learn`}>
                      <Button className="w-full md:w-auto" variant={course.overallProgress >= 100 ? "outline" : "default"}>
                        {course.overallProgress >= 100 ? 'Review Course' : course.overallProgress > 0 ? 'Continue' : 'Start'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PasskeyModal open={isPasskeyOpen} onOpenChange={setIsPasskeyOpen} />
    </PageContainer>
  );
}
