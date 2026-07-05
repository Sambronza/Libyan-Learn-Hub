import React, { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2, Camera, FileCheck, User, ChevronRight,
  Shield, Upload, AlertTriangle, GraduationCap, Clock,
  XCircle, FileText,
} from 'lucide-react';

interface TeacherOnboardingProps {
  onComplete: () => void;
}

// ─── Tiny upload-field component ──────────────────────────────────────────────
function DocUploadField({
  label, hint, accept, required, file, onChange, language,
}: {
  label: string; hint: string; accept: string;
  required?: boolean; file: File | null;
  onChange: (f: File | null) => void; language: string;
}) {
  const id = `upload-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium mb-1 flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {!required && (
          <span className="text-xs text-muted-foreground ml-1">
            ({language === 'ar' ? 'اختياري' : 'optional'})
          </span>
        )}
      </label>
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-colors cursor-pointer
          ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}`}
        onClick={() => document.getElementById(id)?.click()}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => onChange(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">{hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TeacherOnboarding({ onComplete }: TeacherOnboardingProps) {
  const { language } = useLanguage();
  const api = useApi();
  const { toast } = useToast();
  const { user, refetchUser } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1
  const [copyrightChecked, setCopyrightChecked] = useState(false);

  // Step 2
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Step 3
  const [bio, setBio] = useState('');
  const [bioAr, setBioAr] = useState('');
  const [expertise, setExpertise] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);

  // Step 4 (new)
  const [qualificationFile, setQualificationFile] = useState<File | null>(null);
  const [experienceLetterFile, setExperienceLetterFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const TOTAL_STEPS = 4;

  // ── Step helpers ──────────────────────────────────────────────────────────
  const handleCopyrightAgree = async () => {
    setLoading(true);
    try {
      await api.post('/teacher-profile/copyright-agree', {});
      toast({ title: language === 'ar' ? 'تم قبول اتفاقية حقوق النشر' : 'Copyright agreement accepted' });
      setStep(2);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch {
      toast({ title: language === 'ar' ? 'لا يمكن الوصول للكاميرا' : 'Cannot access camera', variant: 'destructive' });
    }
  };
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.drawImage(videoRef.current, 0, 0); setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8)); stopCamera(); }
  };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };

  const handleFaceUpload = async () => {
    if (!capturedPhoto) return;
    setLoading(true);
    try {
      const blob = await (await fetch(capturedPhoto)).blob();
      const formData = new FormData();
      formData.append('photo', blob, 'face.jpg');
      await api.apiFetch('/teacher-profile/face-capture', { method: 'POST', body: formData, headers: {} });
      toast({ title: language === 'ar' ? 'تم حفظ صورة الوجه' : 'Face photo saved' });
      setStep(3);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleProfileSave = async () => {
    if (!bio && !bioAr) {
      toast({ title: language === 'ar' ? 'يرجى كتابة نبذة عنك' : 'Please add a bio', variant: 'destructive' }); return;
    }
    if (!cvFile) {
      toast({ title: language === 'ar' ? 'السيرة الذاتية مطلوبة' : 'CV is required', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      await api.put('/teacher-profile', { bio, bioAr, expertise });
      const formData = new FormData();
      formData.append('cv', cvFile);
      await api.apiFetch('/teacher-profile/cv', { method: 'POST', body: formData, headers: {} });
      toast({ title: language === 'ar' ? 'تم حفظ الملف الشخصي' : 'Profile saved' });
      setStep(4);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleDocumentSubmit = async () => {
    if (!qualificationFile) {
      toast({ title: language === 'ar' ? 'الشهادة الأكاديمية مطلوبة' : 'Academic qualification is required', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      // Upload qualification (required)
      const qFormData = new FormData();
      qFormData.append('qualification', qualificationFile);
      await api.apiFetch('/teacher-profile/qualification', { method: 'POST', body: qFormData, headers: {} });

      // Upload experience letter (optional)
      if (experienceLetterFile) {
        const eFormData = new FormData();
        eFormData.append('experienceLetter', experienceLetterFile);
        await api.apiFetch('/teacher-profile/experience-letter', { method: 'POST', body: eFormData, headers: {} });
      }

      // Submit for admin approval
      await api.post('/teacher-profile/complete-onboarding', {});
      toast({ title: language === 'ar' ? 'تم إرسال طلبك بنجاح!' : 'Application submitted!' });
      await refetchUser?.();
      // Show pending screen (step 5 = success state)
      setStep(5);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // ── Step indicators ───────────────────────────────────────────────────────
  const steps = [
    { icon: Shield,         label: { en: 'Agreement', ar: 'الإقرار' } },
    { icon: Camera,         label: { en: 'Face Photo', ar: 'صورة الوجه' } },
    { icon: User,           label: { en: 'Profile', ar: 'الملف الشخصي' } },
    { icon: GraduationCap,  label: { en: 'Documents', ar: 'الوثائق' } },
  ];

  if (step === 5) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <div className="bg-card rounded-2xl border border-border p-10 space-y-6 shadow-xl">
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-amber-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {language === 'ar' ? 'طلبك قيد المراجعة' : 'Application Under Review'}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {language === 'ar'
                  ? 'تم استلام طلبك بنجاح. سيقوم فريق الإدارة بمراجعة وثائقك وإخطارك بالقرار عبر البريد الإلكتروني في أقرب وقت.'
                  : 'Your application has been received. Our admin team will review your documents and notify you by email as soon as possible.'}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
              {language === 'ar'
                ? '⏳ يستغرق المراجعة عادةً 1-3 أيام عمل'
                : '⏳ Review usually takes 1-3 business days'}
            </div>
            <Button className="w-full" onClick={onComplete}>
              {language === 'ar' ? 'الذهاب إلى لوحة التحكم' : 'Go to Dashboard'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-12">

        {/* Progress stepper */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => {
            const n = i + 1;
            const Icon = s.icon;
            return (
              <React.Fragment key={n}>
                {n > 1 && <div className={`h-0.5 w-8 sm:w-12 rounded transition-colors ${n <= step ? 'bg-primary' : 'bg-muted'}`} />}
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${n < step  ? 'bg-primary text-primary-foreground shadow-md' :
                      n === step ? 'bg-primary/10 text-primary border-2 border-primary' :
                                   'bg-muted text-muted-foreground'}`}>
                    {n < step ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground hidden sm:block">
                    {language === 'ar' ? s.label.ar : s.label.en}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Step 1: Copyright ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{language === 'ar' ? 'إقرار حقوق النشر' : 'Copyright Declaration'}</h2>
              <p className="text-muted-foreground text-sm">{language === 'ar' ? 'يرجى قراءة والموافقة على الإقرار التالي قبل المتابعة' : 'Please read and agree to the following declaration before proceeding'}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-sm leading-relaxed space-y-3">
              <div className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="font-medium text-amber-800 dark:text-amber-200">{language === 'ar' ? 'إقرار بحقوق الملكية الفكرية' : 'Intellectual Property Rights Declaration'}</p>
              </div>
              <p>{language === 'ar' ? 'أقر وأتعهد بأن جميع المواد التعليمية التي أقوم برفعها على هذه المنصة، بما في ذلك الفيديوهات والمستندات والاختبارات، هي من إعدادي الشخصي ولا تنتهك حقوق أي طرف آخر.' : 'I declare and undertake that all educational materials I upload to this platform, including videos, documents, and quizzes, are my own original work and do not infringe on any third party\'s rights.'}</p>
              <p>{language === 'ar' ? 'أتحمل المسؤولية الكاملة عن أي مطالبات تتعلق بحقوق النشر أو الملكية الفكرية الناتجة عن المحتوى الذي أقوم برفعه.' : 'I take full responsibility for any copyright or intellectual property claims arising from the content I upload.'}</p>
              <p className="font-medium">{language === 'ar' ? 'في حالة ثبوت انتهاك حقوق النشر، يحق للمنصة حذف المحتوى وتعليق حسابي فوراً.' : 'In the event of proven copyright infringement, the platform has the right to remove the content and suspend my account immediately.'}</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={copyrightChecked} onChange={e => setCopyrightChecked(e.target.checked)} className="accent-primary w-5 h-5 mt-0.5 shrink-0" />
              <span className="text-sm font-medium">{language === 'ar' ? 'أوافق على إقرار حقوق النشر وأتحمل المسؤولية الكاملة عن جميع المواد التي أرفعها' : 'I agree to the copyright declaration and take full responsibility for all materials I upload'}</span>
            </label>
            <Button className="w-full h-12 text-base" disabled={!copyrightChecked || loading} onClick={handleCopyrightAgree}>
              {loading ? (language === 'ar' ? 'جاري...' : 'Processing...') : (language === 'ar' ? 'أوافق وأتابع' : 'Agree & Continue')}
              <ChevronRight className="w-4 h-4 ms-2" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Face Capture ──────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <Camera className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{language === 'ar' ? 'تصوير الوجه للتحقق' : 'Face Photo for Verification'}</h2>
              <p className="text-muted-foreground text-sm">{language === 'ar' ? 'سيتم استخدام هذه الصورة داخلياً للتحقق من هويتك. لن تظهر في ملفك الشخصي.' : 'This photo will be used internally to verify your identity. It will NOT appear on your profile.'}</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3] mx-auto max-w-sm">
              {capturedPhoto ? <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" /> : <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-3 justify-center">
              {!capturedPhoto ? (
                <>
                  <Button variant="outline" onClick={startCamera} className="gap-2"><Camera className="w-4 h-4" /> {language === 'ar' ? 'تشغيل الكاميرا' : 'Start Camera'}</Button>
                  <Button onClick={capturePhoto} className="gap-2"><Camera className="w-4 h-4" /> {language === 'ar' ? 'التقاط' : 'Capture'}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setCapturedPhoto(null); startCamera(); }}>{language === 'ar' ? 'إعادة التصوير' : 'Retake'}</Button>
                  <Button onClick={handleFaceUpload} disabled={loading} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {loading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'استخدام هذه الصورة' : 'Use this photo')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Profile + CV ──────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <User className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{language === 'ar' ? 'إعداد الملف الشخصي' : 'Profile Setup'}</h2>
              <p className="text-muted-foreground text-sm">{language === 'ar' ? 'أكمل معلومات ملفك الشخصي ليراها الطلاب' : 'Complete your profile information for students to see'}</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'نبذة عنك (عربي)' : 'Bio (Arabic)'} <span className="text-destructive">*</span></label>
                <Textarea value={bioAr} onChange={e => setBioAr(e.target.value)} placeholder={language === 'ar' ? 'اكتب نبذة مختصرة عنك...' : 'Write a short bio...'} rows={3} dir="rtl" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'نبذة عنك (إنجليزي)' : 'Bio (English)'} <span className="text-destructive">*</span></label>
                <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Write a short bio in English..." rows={3} dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'التخصص' : 'Expertise'}</label>
                <Input value={expertise} onChange={e => setExpertise(e.target.value)} placeholder={language === 'ar' ? 'مثال: رياضيات، فيزياء' : 'e.g. Mathematics, Physics'} />
              </div>
              <DocUploadField
                label={language === 'ar' ? 'السيرة الذاتية (CV)' : 'CV / Resume'}
                hint={language === 'ar' ? 'PDF أو Word — بحد أقصى 10 ميجابايت' : 'PDF or Word file — max 10 MB'}
                accept=".pdf,.doc,.docx"
                required
                file={cvFile}
                onChange={setCvFile}
                language={language}
              />
            </div>
            <Button className="w-full h-12 text-base" disabled={loading} onClick={handleProfileSave}>
              {loading ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'التالي' : 'Next')}
              <ChevronRight className="w-4 h-4 ms-2" />
            </Button>
          </div>
        )}

        {/* ── Step 4: Academic Documents ────────────────────────────── */}
        {step === 4 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <GraduationCap className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{language === 'ar' ? 'الوثائق الأكاديمية' : 'Academic Documents'}</h2>
              <p className="text-muted-foreground text-sm">
                {language === 'ar'
                  ? 'ارفع وثائقك الأكاديمية لمراجعتها من قِبل الإدارة. ستُستخدم فقط للتحقق ولن تظهر للطلاب.'
                  : 'Upload your academic documents for admin review. They are used for verification only and will not be shown to students.'}
              </p>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 flex gap-3">
              <FileCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">{language === 'ar' ? 'ما الذي نقبله؟' : 'Accepted formats'}</p>
                <p>{language === 'ar' ? 'PDF، صورة (JPG/PNG) — الحد الأقصى 10 ميجابايت لكل ملف' : 'PDF, image (JPG/PNG) — max 10 MB per file'}</p>
              </div>
            </div>

            <div className="space-y-5">
              <DocUploadField
                label={language === 'ar' ? 'الشهادة الأكاديمية' : 'Academic Qualification'}
                hint={language === 'ar' ? 'شهادة البكالوريوس أو الدراسات العليا أو أي مؤهل علمي — PDF أو صورة' : 'Bachelor\'s, postgraduate, or any academic certificate — PDF or image'}
                accept=".pdf,.jpg,.jpeg,.png"
                required
                file={qualificationFile}
                onChange={setQualificationFile}
                language={language}
              />
              <DocUploadField
                label={language === 'ar' ? 'خطاب الخبرة التدريسية' : 'Teaching Experience Letter'}
                hint={language === 'ar' ? 'خطاب من مؤسسة تعليمية سابقة إن وُجد — PDF أو صورة' : 'Letter from a previous school or institution if available — PDF or image'}
                accept=".pdf,.jpg,.jpeg,.png"
                file={experienceLetterFile}
                onChange={setExperienceLetterFile}
                language={language}
              />
            </div>

            <Button className="w-full h-12 text-base" disabled={loading || !qualificationFile} onClick={handleDocumentSubmit}>
              {loading
                ? (language === 'ar' ? 'جاري الإرسال...' : 'Submitting...')
                : (language === 'ar' ? 'إرسال للمراجعة' : 'Submit for Review')}
              <FileCheck className="w-4 h-4 ms-2" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {language === 'ar'
                ? 'بالإرسال، توافق على مراجعة بياناتك من قِبل فريق الإدارة'
                : 'By submitting, you agree to your information being reviewed by the admin team'}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
