import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation } from 'wouter';

type DMCAFormData = {
  reporterName: string;
  reporterEmail: string;
  reportedTeacherId: string;
  reportedLessonId?: string;
  description: string;
  proofUrl?: string;
  agreement1: boolean;
  agreement2: boolean;
  agreement3: boolean;
};

export default function DMCAComplaint() {
  const { t, language } = useLanguage();
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const { toast } = useToast();
  const api = useApi();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<DMCAFormData>({
    defaultValues: {
      reporterName: user?.fullName || '',
      reporterEmail: user?.email || '',
    }
  });

  const allAgreed = watch('agreement1') && watch('agreement2') && watch('agreement3');

  const onSubmit = async (data: DMCAFormData) => {
    if (!allAgreed) {
      toast({
        title: t('مطلوب', 'Required'),
        description: t('يجب الموافقة على جميع الإقرارات القانونية.', 'You must agree to all legal declarations.'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/copyright-complaints', {
        reporterName: data.reporterName,
        reporterEmail: data.reporterEmail,
        reportedTeacherId: parseInt(data.reportedTeacherId),
        reportedLessonId: data.reportedLessonId ? parseInt(data.reportedLessonId) : undefined,
        description: data.description,
        proofUrl: data.proofUrl,
        reporterUserId: user?.id,
      });
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast({
        title: t('حدث خطأ', 'Error'),
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <PageContainer>
        <div className="max-w-2xl mx-auto py-24 px-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4">
            {t('تم استلام البلاغ', 'Complaint Received')}
          </h1>
          <p className="text-muted-foreground mb-8 text-lg" dir={dir}>
            {t(
              'لقد استلمنا بلاغك بشأن انتهاك حقوق الملكية الفكرية وسيقوم فريقنا بمراجعته في أقرب وقت ممكن. قد نتواصل معك عبر البريد الإلكتروني إذا احتجنا إلى مزيد من المعلومات.',
              'Your copyright infringement report has been received and will be reviewed by our team as soon as possible. We may contact you via email if we need more information.'
            )}
          </p>
          <Button onClick={() => setLocation('/')} size="lg">
            {t('العودة للرئيسية', 'Return to Home')}
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="bg-primary/5 py-12 border-b border-primary/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ShieldAlert className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-4xl font-display font-bold mb-4">
            {t('الإبلاغ عن انتهاك حقوق الملكية (DMCA)', 'Report Copyright Infringement (DMCA)')}
          </h1>
          <p className="text-xl text-muted-foreground" dir={dir}>
            {t(
              'نحن نأخذ حقوق الملكية الفكرية على محمل الجد. استخدم هذا النموذج للإبلاغ عن أي محتوى مسروق أو ينتهك حقوقك على المنصة.',
              'We take intellectual property rights seriously. Use this form to report any stolen content or copyright infringement on our platform.'
            )}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 flex items-start gap-3" dir={dir}>
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-900 mb-1">
              {t('ملاحظة قانونية هامة', 'Important Legal Notice')}
            </h3>
            <p className="text-sm text-amber-800 leading-relaxed">
              {t(
                'تقديم بلاغ كاذب أو مضلل قد يعرضك للمساءلة القانونية ويؤدي إلى حظر حسابك. يرجى التأكد من أنك المالك الشرعي للمحتوى أو مخول بالتصرف نيابة عنه.',
                'Submitting a false or misleading report may expose you to legal liability and result in a ban of your account. Please ensure you are the legitimate owner of the content or authorized to act on their behalf.'
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" dir={dir}>
          {/* Section 1: Contact Info */}
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">1</span>
              {t('معلومات التواصل', 'Contact Information')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('الاسم الكامل *', 'Full Name *')}
                </label>
                <Input 
                  {...register('reporterName', { required: true })} 
                  className={errors.reporterName ? 'border-destructive' : ''}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('البريد الإلكتروني للتواصل *', 'Contact Email *')}
                </label>
                <Input 
                  type="email"
                  {...register('reporterEmail', { required: true })} 
                  className={errors.reporterEmail ? 'border-destructive' : ''}
                />
              </div>
            </div>
          </section>

          {/* Section 2: Reported Content */}
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">2</span>
              {t('تفاصيل المحتوى المخالف', 'Details of Infringing Content')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('رابط أو معرف المعلم المخالف *', 'Infringing Teacher ID or Link *')}
                </label>
                <Input 
                  {...register('reportedTeacherId', { required: true })} 
                  placeholder={t('أدخل المعرف الرقمي أو رابط صفحة المعلم', 'Enter Teacher ID or profile link')}
                  className={errors.reportedTeacherId ? 'border-destructive' : ''}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('يمكن العثور على المعرف في صفحة المعلم.', 'The ID can be found on the teacher profile page.')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('المعرف الخاص بالدرس (اختياري)', 'Lesson ID (Optional)')}
                </label>
                <Input 
                  {...register('reportedLessonId')} 
                  placeholder={t('إذا كانت المخالفة تخص درساً معيناً، أدخل المعرف هنا', 'If the infringement is about a specific lesson, enter ID here')}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('الوصف التفصيلي للمخالفة *', 'Detailed Description of Infringement *')}
                </label>
                <Textarea 
                  {...register('description', { required: true, minLength: 20 })} 
                  rows={4}
                  placeholder={t('يرجى وصف كيف تم انتهاك حقوقك، وأين يمكننا العثور على المحتوى الأصلي الخاص بك.', 'Please describe how your rights were infringed, and where we can find your original content.')}
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && (
                  <p className="text-xs text-destructive mt-1">
                    {t('الرجاء تقديم وصف تفصيلي (20 حرف على الأقل).', 'Please provide a detailed description (at least 20 chars).')}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('رابط إثبات الملكية (اختياري)', 'Proof of Ownership Link (Optional)')}
                </label>
                <Input 
                  type="url"
                  {...register('proofUrl')} 
                  placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('رابط لملفك الأصلي، قناتك على يوتيوب، أو أي دليل يثبت ملكيتك.', 'Link to your original file, YouTube channel, or any proof of ownership.')}
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Legal Declarations */}
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">3</span>
              {t('الإقرارات القانونية', 'Legal Declarations')}
            </h2>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  {...register('agreement1')}
                  className="mt-1 w-4 h-4 rounded text-primary"
                />
                <span className="text-sm">
                  {t(
                    'لدي اعتقاد حسن النية بأن استخدام المواد بالطريقة المشتكى منها غير مصرح به من قبل مالك حقوق الطبع والنشر أو وكيله أو القانون.',
                    'I have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.'
                  )}
                </span>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  {...register('agreement2')}
                  className="mt-1 w-4 h-4 rounded text-primary"
                />
                <span className="text-sm">
                  {t(
                    'المعلومات الواردة في هذا الإشعار دقيقة ومطابقة للحقيقة.',
                    'The information in this notification is accurate and truthful.'
                  )}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  {...register('agreement3')}
                  className="mt-1 w-4 h-4 rounded text-primary"
                />
                <span className="text-sm">
                  {t(
                    'أقر، تحت طائلة عقوبة الحنث باليمين، بأنني مالك الحق الحصري المزعوم انتهاكه، أو أنني مخول بالتصرف نيابة عن المالك.',
                    'I declare, under penalty of perjury, that I am the owner of the exclusive right that is allegedly infringed, or that I am authorized to act on behalf of the owner.'
                  )}
                </span>
              </label>
            </div>
          </section>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full text-lg py-6"
            disabled={!allAgreed || isSubmitting}
          >
            {isSubmitting ? t('جاري الإرسال...', 'Submitting...') : t('إرسال بلاغ الانتهاك', 'Submit Infringement Report')}
          </Button>

        </form>
      </div>
    </PageContainer>
  );
}
