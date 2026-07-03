import React, { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Camera, FileCheck, User, ChevronRight, ChevronLeft, Shield, Upload, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface TeacherOnboardingProps {
  onComplete: () => void;
}

export default function TeacherOnboarding({ onComplete }: TeacherOnboardingProps) {
  const { language } = useLanguage();
  const api = useApi();
  const { toast } = useToast();
  const { user, refetchUser } = useAuth();
  const [step, setStep] = useState(1);
  const [copyrightChecked, setCopyrightChecked] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [bioAr, setBioAr] = useState('');
  const [expertise, setExpertise] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const totalSteps = 3;

  // Step 1: Copyright Agreement
  const handleCopyrightAgree = async () => {
    setLoading(true);
    try {
      await api.post('/teacher-profile/copyright-agree', {});
      toast({ title: language === 'ar' ? 'تم قبول اتفاقية حقوق النشر' : 'Copyright agreement accepted' });
      setStep(2);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Face Capture
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      toast({ title: language === 'ar' ? 'لا يمكن الوصول للكاميرا' : 'Cannot access camera', variant: 'destructive' });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const handleFaceUpload = async () => {
    if (!capturedPhoto) return;
    setLoading(true);
    try {
      const blob = await (await fetch(capturedPhoto)).blob();
      const formData = new FormData();
      formData.append('photo', blob, 'face.jpg');
      await api.apiFetch('/teacher-profile/face-capture', {
        method: 'POST',
        body: formData,
        headers: {},
      });
      toast({ title: language === 'ar' ? 'تم حفظ صورة الوجه' : 'Face photo saved' });
      setStep(3);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Profile Setup
  const handleProfileComplete = async () => {
    setLoading(true);
    try {
      // Update profile
      await api.put('/teacher-profile', { bio, bioAr, expertise });

      // Upload CV if provided
      if (cvFile) {
        const formData = new FormData();
        formData.append('cv', cvFile);
        await api.apiFetch('/teacher-profile/cv', {
          method: 'POST',
          body: formData,
          headers: {},
        });
      }

      // Complete onboarding
      await api.post('/teacher-profile/complete-onboarding', {});
      toast({ title: language === 'ar' ? 'تم إكمال الإعداد بنجاح!' : 'Onboarding completed successfully!' });
      refetchUser?.();
      onComplete();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const stepIcons = [Shield, Camera, User];
  const stepLabels = [
    { en: 'Copyright', ar: 'حقوق النشر' },
    { en: 'Face Photo', ar: 'صورة الوجه' },
    { en: 'Profile', ar: 'الملف الشخصي' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Progress bar */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[1, 2, 3].map(s => {
            const Icon = stepIcons[s - 1];
            const label = stepLabels[s - 1];
            return (
              <React.Fragment key={s}>
                {s > 1 && <div className={`h-0.5 w-12 rounded ${s <= step ? 'bg-primary' : 'bg-muted'}`} />}
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    s < step ? 'bg-primary text-primary-foreground' :
                    s === step ? 'bg-primary/10 text-primary border-2 border-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {s < step ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-xs text-muted-foreground">{language === 'ar' ? label.ar : label.en}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Step 1: Copyright Agreement */}
        {step === 1 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{language === 'ar' ? 'إقرار حقوق النشر' : 'Copyright Declaration'}</h2>
              <p className="text-muted-foreground text-sm">
                {language === 'ar' ? 'يرجى قراءة والموافقة على الإقرار التالي قبل المتابعة' : 'Please read and agree to the following declaration before proceeding'}
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-sm leading-relaxed space-y-3">
              <div className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {language === 'ar'
                    ? 'إقرار بحقوق الملكية الفكرية'
                    : 'Intellectual Property Rights Declaration'}
                </p>
              </div>
              <p>{language === 'ar'
                ? 'أقر وأتعهد بأن جميع المواد التعليمية التي أقوم برفعها على هذه المنصة، بما في ذلك الفيديوهات والمستندات والاختبارات، هي من إعدادي الشخصي ولا تنتهك حقوق أي طرف آخر.'
                : 'I declare and undertake that all educational materials I upload to this platform, including videos, documents, and quizzes, are my own original work and do not infringe on any third party\'s rights.'}
              </p>
              <p>{language === 'ar'
                ? 'أتحمل المسؤولية الكاملة عن أي مطالبات تتعلق بحقوق النشر أو الملكية الفكرية الناتجة عن المحتوى الذي أقوم برفعه.'
                : 'I take full responsibility for any copyright or intellectual property claims arising from the content I upload.'}
              </p>
              <p className="font-medium">{language === 'ar'
                ? 'في حالة ثبوت انتهاك حقوق النشر، يحق للمنصة حذف المحتوى وتعليق حسابي فوراً.'
                : 'In the event of proven copyright infringement, the platform has the right to remove the content and suspend my account immediately.'}
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={copyrightChecked} onChange={e => setCopyrightChecked(e.target.checked)}
                className="accent-primary w-5 h-5 mt-0.5 shrink-0" />
              <span className="text-sm font-medium">
                {language === 'ar'
                  ? 'أوافق على إقرار حقوق النشر وأتحمل المسؤولية الكاملة عن جميع المواد التي أرفعها'
                  : 'I agree to the copyright declaration and take full responsibility for all materials I upload'}
              </span>
            </label>

            <Button className="w-full h-12 text-base" disabled={!copyrightChecked || loading} onClick={handleCopyrightAgree}>
              {loading ? (language === 'ar' ? 'جاري...' : 'Processing...') : (language === 'ar' ? 'أوافق وأتابع' : 'Agree & Continue')}
              <ChevronRight className="w-4 h-4 ms-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Face Capture */}
        {step === 2 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <Camera className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{language === 'ar' ? 'تصوير الوجه للتحقق' : 'Face Photo for Verification'}</h2>
              <p className="text-muted-foreground text-sm">
                {language === 'ar'
                  ? 'سيتم استخدام هذه الصورة داخلياً للتحقق من هويتك. لن تظهر في ملفك الشخصي.'
                  : 'This photo will be used internally to verify your identity. It will NOT appear on your profile.'}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3] mx-auto max-w-sm">
              {capturedPhoto ? (
                <img src={capturedPhoto} alt="Captured face" className="w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex gap-3 justify-center">
              {!capturedPhoto ? (
                <>
                  <Button variant="outline" onClick={startCamera} className="gap-2">
                    <Camera className="w-4 h-4" /> {language === 'ar' ? 'تشغيل الكاميرا' : 'Start Camera'}
                  </Button>
                  <Button onClick={capturePhoto} className="gap-2">
                    <Camera className="w-4 h-4" /> {language === 'ar' ? 'التقاط' : 'Capture'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setCapturedPhoto(null); startCamera(); }}>
                    {language === 'ar' ? 'إعادة التصوير' : 'Retake'}
                  </Button>
                  <Button onClick={handleFaceUpload} disabled={loading} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {loading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'استخدام هذه الصورة' : 'Use this photo')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Profile Setup */}
        {step === 3 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <User className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{language === 'ar' ? 'إعداد الملف الشخصي' : 'Profile Setup'}</h2>
              <p className="text-muted-foreground text-sm">
                {language === 'ar' ? 'أكمل معلومات ملفك الشخصي ليراها الطلاب' : 'Complete your profile information for students to see'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'نبذة عنك (عربي)' : 'Bio (Arabic)'}</label>
                <Textarea value={bioAr} onChange={e => setBioAr(e.target.value)} placeholder={language === 'ar' ? 'اكتب نبذة مختصرة عنك...' : 'Write a short bio...'} rows={3} dir="rtl" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'نبذة عنك (إنجليزي)' : 'Bio (English)'}</label>
                <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Write a short bio in English..." rows={3} dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'التخصص' : 'Expertise'}</label>
                <Input value={expertise} onChange={e => setExpertise(e.target.value)} placeholder={language === 'ar' ? 'مثال: رياضيات، فيزياء' : 'e.g. Mathematics, Physics'} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'السيرة الذاتية (PDF)' : 'CV (PDF)'}</label>
                <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            <Button className="w-full h-12 text-base" disabled={loading} onClick={handleProfileComplete}>
              {loading ? (language === 'ar' ? 'جاري...' : 'Processing...') : (language === 'ar' ? 'إكمال الإعداد' : 'Complete Setup')}
              <CheckCircle2 className="w-4 h-4 ms-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
