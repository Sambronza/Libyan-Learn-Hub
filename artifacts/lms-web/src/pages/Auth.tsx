import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin, useRegister } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, GraduationCap, Presentation, Phone, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Logo } from '@/components/ui/Logo';
import { Blob } from '@/components/ui/Blob';
import { getDeviceInfo } from '@/lib/deviceFingerprint';
import { FaceCapture } from '@/components/FaceCapture';
import { FaceEnroll } from '@/components/FaceEnroll';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(9, 'Enter a valid phone number').regex(/^[0-9+\s\-()]+$/, 'Invalid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'teacher']),
  referralCode: z.string().optional(),
  agreedToCommission: z.boolean().optional(),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the Terms & Conditions",
  }),
}).refine((data) => {
  if (data.role === 'teacher') {
    return data.agreedToCommission === true;
  }
  return true;
}, {
  message: "You must agree to the platform commission terms",
  path: ["agreedToCommission"]
});

export default function Auth() {
  const [location, setLocation] = useLocation();
  const isLogin = location.startsWith('/login');

  // Extract redirect param from query string (e.g. /login?redirect=/academy/apply)
  const redirectTo = (() => {
    const search = window.location.search;
    const params = new URLSearchParams(search);
    return params.get('redirect') || params.get('returnTo') || null;
  })();
  const { login: setAuthContext } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isRtl = language === 'ar';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const api = useApi();
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<'form' | 'otp' | 'forgot' | 'reset' | 'newDevice' | 'faceVerify' | 'reverify' | 'faceEnroll'>('form');
  // Credentials kept in memory for the device-switch / reverify face calls
  const [securityCreds, setSecurityCreds] = useState<{ email: string; password: string } | null>(null);
  const [securityMsg, setSecurityMsg] = useState<{ message: string; messageAr: string } | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [pendingToken, setPendingToken] = useState<string>('');
  const [pendingRole, setPendingRole] = useState<string>('student');
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [commissionPercent, setCommissionPercent] = useState('20');
  const [termsOpen, setTermsOpen] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/auth/settings').then((res: any) => {
      const setting = res.find((s: any) => s.key === 'teacher_commission_percent');
      if (setting) setCommissionPercent(setting.value);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRef.current?.focus();
      setResendTimer(60); // 60 seconds countdown
    }
  }, [step]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setErrorMsg('');
    try {
      localStorage.setItem('lms_token', pendingToken);
      const isPhone = !!registerForm.getValues('phoneNumber');
      await api.post('/auth/send-otp', { 
        type: isPhone ? 'phone' : 'email' 
      });
      setResendTimer(60);
      toast({ title: 'Code resent!', description: 'Please check your inbox (and spam folder).' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Resend failed');
    }
  };

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phoneNumber: '', password: '', role: 'student' as 'student' | 'teacher', referralCode: '', agreedToCommission: false, agreedToTerms: false }
  });

  const { mutate: loginMutate, isPending: isLoggingIn } = useLogin({
    mutation: {
      onSuccess: (data: any) => {
        if (data.requireVerification) {
          setPendingToken(data.token);
          setPendingRole(data.user.role);
          setPendingEmail(data.user.email);
          setStep('otp');
          toast({
            title: 'Verification required',
            description: 'A new verification code has been sent to your email.',
            variant: 'default',
          });
          return;
        }
        
        // Pre-seed the user cache to avoid a second /auth/me round-trip
        setAuthContext(data.token, data.user);

        // Grandfathered student with no face profile yet: enroll before continuing
        if (data.faceEnrollmentRequired && data.user.role === 'student') {
          setStep('faceEnroll');
          return;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const returnTo = searchParams.get('returnTo');

        if (returnTo) {
          setLocation(decodeURIComponent(returnTo));
        } else {
          if (data.user.role === 'teacher' && !data.user.biometricsVerified) {
            setLocation('/teacher/biometrics-setup');
          } else {
            setLocation(data.user.role === 'teacher' ? '/teacher/dashboard' : '/dashboard');
          }
        }
      },
      onError: (err: any) => {
        const code = err?.data?.code;
        if (err?.status === 409 && code === 'NEW_DEVICE') {
          setSecurityCreds(loginForm.getValues());
          setSecurityMsg({ message: err.data.message, messageAr: err.data.messageAr });
          setStep('newDevice');
          return;
        }
        if (err?.status === 403 && code === 'REVERIFY_REQUIRED') {
          setSecurityCreds(loginForm.getValues());
          setSecurityMsg({ message: err.data.message, messageAr: err.data.messageAr });
          setStep('reverify');
          return;
        }
        if (err?.status === 403 && code === 'ACCOUNT_BLOCKED') {
          setErrorMsg(isRtl ? err.data.messageAr : err.data.message);
          return;
        }
        setErrorMsg(err.message || 'Login failed');
      }
    }
  });

  // ── Device-switch face verification (after NEW_DEVICE warning) ──────────────
  const handleDeviceSwitchCapture = async (descriptor: number[], imageBase64: string) => {
    if (!securityCreds) return;
    setSecurityBusy(true);
    setErrorMsg('');
    try {
      const data = await api.post('/auth/device-switch/verify', {
        ...securityCreds,
        ...getDeviceInfo(),
        faceDescriptor: descriptor,
        snapshot: imageBase64,
      });
      toast({
        title: isRtl ? 'تم تأكيد هويتك ✓' : 'Identity confirmed ✓',
        description: isRtl ? data.messageAr : data.message,
      });
      setAuthContext(data.token);
      setLocation('/dashboard');
    } catch (err: any) {
      const body = err?.data || {};
      setErrorMsg(isRtl ? (body.messageAr || err.message) : (body.message || err.message));
      setStep('form');
    } finally {
      setSecurityBusy(false);
    }
  };

  // ── Periodic face re-verification ────────────────────────────────────────────
  const handleReverifyCapture = async (descriptor: number[], imageBase64: string) => {
    if (!securityCreds) return;
    setSecurityBusy(true);
    setErrorMsg('');
    try {
      const data = await api.post('/auth/reverify-face', {
        ...securityCreds,
        deviceFingerprint: getDeviceInfo().deviceFingerprint,
        faceDescriptor: descriptor,
        snapshot: imageBase64,
      });
      toast({ title: isRtl ? 'تم التحقق ✓' : 'Verified ✓' });
      setAuthContext(data.token);
      setLocation('/dashboard');
    } catch (err: any) {
      const body = err?.data || {};
      setErrorMsg(isRtl ? (body.messageAr || err.message) : (body.message || err.message));
      setStep('form');
    } finally {
      setSecurityBusy(false);
    }
  };

  // ── Face enrollment for grandfathered students ───────────────────────────────
  const handleFaceEnrollComplete = async (descriptors: Record<string, number[]>, snapshot: string | null) => {
    setSecurityBusy(true);
    try {
      await api.post('/auth/enroll-face', { faceDescriptors: descriptors, facePhotoUrl: snapshot });
      toast({ title: isRtl ? 'تم حفظ ملف الوجه ✓' : 'Face profile saved ✓' });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to save face profile', variant: 'destructive' });
    } finally {
      setSecurityBusy(false);
      setLocation('/dashboard');
    }
  };


  const { mutate: registerMutate, isPending: isRegistering } = useRegister({
    mutation: {
      onSuccess: (data: any) => {
        setPendingToken(data.token);
        setPendingRole(data.user.role);
        setPendingEmail(data.user.email);
        setStep('otp');
      },
      onError: (err) => setErrorMsg(err.message || 'Registration failed')
    }
  });

  const onSubmitLogin = (data: z.infer<typeof loginSchema>) => {
    setErrorMsg('');
    loginMutate({ data: { ...data, ...getDeviceInfo() } as any });
  };

  const handleRequestReset = async () => {
    if (!resetEmail) {
      setErrorMsg('Please enter your email');
      return;
    }
    setErrorMsg('');
    setVerifying(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: resetEmail });
      if (res.otpMessage) {
        // password reset OTP was sent to email
      } else {
        // no message
      }
      setStep('reset');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setErrorMsg(err.message || 'Failed to request reset code');
    } finally {
      setVerifying(false);
    }
  };

  const handleFinalReset = async () => {
    if (otpCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit reset code');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    setErrorMsg('');
    setVerifying(true);
    try {
      await api.post('/auth/reset-password', {
        email: resetEmail,
        otpCode,
        newPassword
      });
      toast({ 
        title: language === 'ar' ? 'تم إعادة تعيين كلمة المرور!' : 'Password reset successful!', 
        description: language === 'ar' ? 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.' : 'You can now log in with your new password.' 
      });
      setStep('form');
      setLocation('/login');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password');
    } finally {
      setVerifying(false);
    }
  };

  const onSubmitRegister = (data: z.infer<typeof registerSchema>) => {
    setErrorMsg('');
    // All roles now register directly. Teachers default to 'free' tier on the backend,
    // but we can be explicit here if the API expects it.
    // Device info binds the signup device as the student's trusted device.
    registerMutate({ data: { ...data, tier: 'free', ...getDeviceInfo() } as any });
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit code');
      return;
    }
    setVerifying(true);
    setErrorMsg('');
    try {
      localStorage.setItem('lms_token', pendingToken);
      // Determine type based on whether the user entered a phone number or email
      const isPhone = !!registerForm.getValues('phoneNumber');
      await api.post('/auth/verify-otp', { code: otpCode, type: isPhone ? 'phone' : 'email' });
      setAuthContext(pendingToken);
      toast({ title: 'Registration successful!' });
      if (pendingRole === 'teacher') {
        window.location.href = '/teacher/biometrics-setup';
      } else {
        // Students must enroll their face at signup (device/identity security)
        setStep('faceEnroll');
      }
    } catch (err: any) {
      localStorage.removeItem('lms_token');
      setErrorMsg(err.message || 'Invalid code');
    } finally {
      setVerifying(false);
    }
  };

  const handleSkipVerification = () => {
    // Verification is mandatory.
  };



  // ── New Device Warning ────────────────────────────────────────────────
  if (step === 'newDevice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border shadow-xl p-10 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-display font-bold">
              {isRtl ? 'جهاز جديد تم اكتشافه' : 'New Device Detected'}
            </h2>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 leading-relaxed">
            {isRtl ? securityMsg?.messageAr : securityMsg?.message}
          </div>
          <div className="space-y-3">
            <Button className="w-full h-12 text-base font-semibold" onClick={() => { setErrorMsg(''); setStep('faceVerify'); }}>
              {isRtl ? 'متابعة والتحقق من الوجه' : 'Continue & Verify My Face'}
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={() => setStep('form')}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Device-Switch Face Verification ──────────────────────────────────────
  if (step === 'faceVerify' || step === 'reverify') {
    const isReverify = step === 'reverify';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border shadow-xl p-10 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold">
              {isReverify
                ? (isRtl ? 'إعادة التحقق من الهوية' : 'Identity Re-verification')
                : (isRtl ? 'التحقق من الوجه' : 'Face Verification')}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {isReverify && securityMsg
                ? (isRtl ? securityMsg.messageAr : securityMsg.message)
                : (isRtl ? 'انظر إلى الكاميرا مباشرة والتقط صورة للتحقق من هويتك.' : 'Look directly at the camera and capture a photo to confirm your identity.')}
            </p>
          </div>
          {errorMsg && (
            <div className="mb-4 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
              {errorMsg}
            </div>
          )}
          {securityBusy ? (
            <div className="py-10 text-center text-muted-foreground">{isRtl ? 'جارٍ التحقق…' : 'Verifying…'}</div>
          ) : (
            <FaceCapture onCapture={isReverify ? handleReverifyCapture : handleDeviceSwitchCapture} />
          )}
          <Button variant="ghost" className="w-full mt-4" onClick={() => setStep('form')}>
            {isRtl ? 'رجوع' : 'Back'}
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Student Face Enrollment (signup / grandfathered) ─────────────────────
  if (step === 'faceEnroll') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border shadow-xl p-10 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold">
              {isRtl ? 'تسجيل ملف الوجه' : 'Face Profile Setup'}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {isRtl
                ? 'لحماية حسابك، حرّك رأسك ببطء في الاتجاهات الخمسة حتى تلتقط الكاميرا جميع الأوضاع. يُستخدم هذا للتحقق من هويتك عند تغيير الجهاز.'
                : 'To protect your account, slowly move your head in 5 directions while the camera captures each pose. This is used to verify your identity if you switch devices.'}
            </p>
          </div>
          {securityBusy ? (
            <div className="py-10 text-center text-muted-foreground">{isRtl ? 'جارٍ الحفظ…' : 'Saving…'}</div>
          ) : (
            <FaceEnroll onComplete={handleFaceEnrollComplete} onError={(m) => setErrorMsg(m)} />
          )}
          {errorMsg && (
            <div className="mt-4 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
              {errorMsg}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Forgot Password Step ───────────────────────────────────────────────
  if (step === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border shadow-xl p-10 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold">Forgot Password?</h2>
            <p className="text-muted-foreground mt-2 text-sm">Enter your email to receive a reset code</p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <Input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-14 bg-muted/50"
            />
            <Button
              className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-semibold"
              onClick={handleRequestReset}
              disabled={verifying}
            >
              {verifying ? 'Sending...' : 'Send Reset Code'}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => { setStep('form'); setErrorMsg(''); }}
            >
              Back to Login
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Reset Password Step ────────────────────────────────────────────────
  if (step === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border shadow-xl p-10 w-full max-w-md"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold">Set New Password</h2>
            <p className="text-muted-foreground mt-2 text-sm">Enter the code and your new password</p>
          </div>



          {errorMsg && (
            <div className="mb-4 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <Input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="h-12 text-center text-xl font-mono bg-muted/50"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="h-12 bg-muted/50"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="h-12 bg-muted/50"
            />
            <Button
              className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-semibold"
              onClick={handleFinalReset}
              disabled={verifying}
            >
              {verifying ? 'Resetting...' : 'Update Password'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── OTP Step ────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border shadow-xl p-10 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold">Verify Your Account</h2>
            <p className="text-muted-foreground mt-2 text-sm">Enter the 6-digit verification code</p>
          </div>

          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-700 dark:text-emerald-400 flex gap-3 items-start">
            <Mail className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Check your email</p>
              <p className="mt-0.5 opacity-80">We sent a 6-digit verification code to <span className="font-medium">{pendingEmail}</span>. Please check your inbox (and spam folder).</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <Input
              ref={otpInputRef}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="h-14 text-center text-2xl tracking-[0.5em] font-mono bg-muted/50"
              maxLength={6}
            />
            <Button
              className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-semibold"
              onClick={handleVerifyOtp}
              disabled={verifying || otpCode.length !== 6}
            >
              {verifying ? 'Verifying...' : 'Verify & Continue'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                disabled={resendTimer > 0}
                onClick={handleResend}
                className={`text-sm font-medium ${resendTimer > 0 ? 'text-muted-foreground' : 'text-primary hover:underline'}`}
              >
                {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Terms and Conditions Modal — rendered at root level, outside flex layout */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-display">Terms & Conditions</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground pb-4">
            <p><strong className="text-foreground">1. Introduction</strong><br/>
Welcome to EduLibya (“we,” “our,” “us”). By accessing or using our platform, you (“user,” “student,” “teacher”) agree to these Terms & Conditions. Please read them carefully before using our services.</p>

<p><strong className="text-foreground">2. Eligibility</strong><br/>
Teachers must be qualified professionals capable of delivering valuable course material.<br/>
Students must be at least 13 years old (or 18 depending on jurisdiction).<br/>
Users under 18 may require parental or school consent.<br/>
Each user must maintain only one account and provide accurate information.</p>

<p><strong className="text-foreground">3. Services Provided</strong><br/>
We provide an online platform where teachers, doctors, and experts can publish courses.<br/>
Students can enroll in courses by purchasing redeem cards.<br/>
Certificates (if offered) are informal unless explicitly stated as accredited.</p>

<p><strong className="text-foreground">4. Payments</strong><br/>
Students pay for courses using redeem cards issued by the platform.<br/>
Redeem cards are non-transferable, non-refundable, and must be used before their expiration date.<br/>
If a course is canceled by the platform or teacher, students may receive equivalent redeem card credit.<br/>
Teachers may request withdrawals of their earnings through their profile page, subject to administrative approval.</p>

<p><strong className="text-foreground">5. Commission & Fees</strong><br/>
A percentage of each teacher’s earnings may be retained by the platform as commission.<br/>
The commission rate is configurable by the platform administrator and disclosed during registration.</p>

<p><strong className="text-foreground">6. User Responsibilities</strong><br/>
Teachers must ensure their content is accurate, lawful, and does not infringe intellectual property rights.<br/>
Students must use the platform for educational purposes only and not engage in fraudulent activity.<br/>
Users must maintain the confidentiality of their login credentials and are responsible for all activities under their account.<br/>
Account sharing, hacking, scraping, or misuse is strictly prohibited.</p>

<p><strong className="text-foreground">7. Content Moderation</strong><br/>
We reserve the right to remove or block content that violates laws, infringes intellectual property, or breaches community standards.<br/>
Teachers who breach content guidelines may lose access to earnings.</p>

<p><strong className="text-foreground">8. Intellectual Property</strong><br/>
All course content remains the property of the teacher/creator.<br/>
The platform retains rights to its design, branding, and system features.<br/>
By uploading content, teachers grant the platform a license to host and distribute their material for educational purposes.</p>

<p><strong className="text-foreground">9. Privacy & Data Use</strong><br/>
We collect and store user information for account management and payment processing.<br/>
Personal data will not be shared with third parties except as required by law.<br/>
Users consent to receiving emails/SMS notifications related to their account, payments, or tutoring requests.</p>

<p><strong className="text-foreground">10. Limitation of Liability</strong><br/>
We are not responsible for the accuracy of course content or outcomes of learning.<br/>
We are not liable for technical issues, interruptions, or unauthorized access beyond reasonable control.<br/>
Force Majeure: We are not liable for delays or failures caused by events beyond our reasonable control (e.g., war, natural disasters, internet outages).</p>

<p><strong className="text-foreground">11. Indemnification</strong><br/>
Users agree to indemnify and hold harmless EduLibya from any claims, damages, or liabilities arising from their misuse of the platform or uploaded content.</p>

<p><strong className="text-foreground">12. Account Termination & Service Changes</strong><br/>
Accounts may be suspended or terminated if users violate these Terms.<br/>
Teachers who breach content guidelines may lose access to earnings.<br/>
We reserve the right to modify, suspend, or discontinue services at any time.</p>

<p><strong className="text-foreground">13. Dispute Resolution</strong><br/>
Any disputes shall be resolved through binding arbitration in Tripoli, Libya.<br/>
Users waive the right to participate in class actions or jury trials.</p>

<p><strong className="text-foreground">14. Governing Law</strong><br/>
These Terms are governed by the laws of Libya.<br/>
Any disputes shall be resolved in the courts of Tripoli, Libya, unless arbitration applies.</p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen flex bg-background">
      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[620px] xl:w-[700px] bg-card z-10 relative shadow-2xl">
        <div className="absolute top-8 start-8">
          <Link href={redirectTo ? decodeURIComponent(redirectTo) : "/"}>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> {redirectTo ? 'Back' : 'Back to Home'}
            </Button>
          </Link>
        </div>

        <div className="mx-auto w-full max-w-md pt-20 sm:pt-0">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-5">
              <Logo size={200} linked={false} />
            </div>
            <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Link href={isLogin ? `/register${window.location.search}` : `/login${window.location.search}`} className="font-semibold text-primary hover:underline transition-colors">
                {isLogin ? 'Sign up' : 'Log in'}
              </Link>
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <motion.div
            key={isLogin ? 'login' : 'register'}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                  <Input {...loginForm.register('email')} type="email" placeholder="you@example.com" className="h-12 bg-muted/50 border-transparent focus:bg-background" />
                  {loginForm.formState.errors.email && <p className="mt-1 text-sm text-destructive">{loginForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-foreground">Password</label>
                    <button
                      type="button"
                      onClick={() => { setStep('forgot'); setErrorMsg(''); }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input {...loginForm.register('password')} type="password" placeholder="••••••••" className="h-12 bg-muted/50 border-transparent focus:bg-background" />
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" disabled={isLoggingIn}>
                  {isLoggingIn ? 'Logging in...' : 'Log in'}
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onSubmitRegister)} className="space-y-4">
                {/* Role picker */}
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <label className={`cursor-pointer border-2 rounded-xl p-4 text-center transition-all ${registerForm.watch('role') === 'student' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                    <input type="radio" value="student" {...registerForm.register('role')} className="hidden" />
                    <GraduationCap className="w-6 h-6 mx-auto mb-2" />
                    <span className="font-semibold text-sm block">I'm a Student</span>
                    <span className="text-xs opacity-70">Browse & enroll in courses</span>
                  </label>
                  <label className={`cursor-pointer border-2 rounded-xl p-4 text-center transition-all ${registerForm.watch('role') === 'teacher' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                    <input type="radio" value="teacher" {...registerForm.register('role')} className="hidden" />
                    <Presentation className="w-6 h-6 mx-auto mb-2" />
                    <span className="font-semibold text-sm block">I'm a Teacher</span>
                    <span className="text-xs opacity-70">Create & sell courses</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <Input {...registerForm.register('fullName')} placeholder="Ali Mohamed" className="h-12 bg-muted/50 border-transparent focus:bg-background" />
                  {registerForm.formState.errors.fullName && <p className="mt-1 text-sm text-destructive">{registerForm.formState.errors.fullName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                  <Input {...registerForm.register('email')} type="email" placeholder="you@example.com" className="h-12 bg-muted/50 border-transparent focus:bg-background" />
                  {registerForm.formState.errors.email && <p className="mt-1 text-sm text-destructive">{registerForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Phone Number <span className="text-xs text-muted-foreground">(for SMS verification)</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center justify-center h-12 px-3 bg-muted/50 border border-transparent rounded-md text-sm font-medium text-muted-foreground whitespace-nowrap">
                      🇱🇾 +218
                    </div>
                    <Input
                      {...registerForm.register('phoneNumber')}
                      type="tel"
                      placeholder="91 234 5678"
                      className="h-12 bg-muted/50 border-transparent focus:bg-background flex-1"
                    />
                  </div>
                  {registerForm.formState.errors.phoneNumber && <p className="mt-1 text-sm text-destructive">{registerForm.formState.errors.phoneNumber.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Password</label>
                  <Input {...registerForm.register('password')} type="password" placeholder="Create a strong password (min 6 chars)" className="h-12 bg-muted/50 border-transparent focus:bg-background" />
                  {registerForm.formState.errors.password && <p className="mt-1 text-sm text-destructive">{registerForm.formState.errors.password.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{isRtl ? 'رمز الإحالة (اختياري)' : 'Referral code (optional)'}</label>
                  <Input {...registerForm.register('referralCode')} placeholder="REF…" className="h-12 bg-muted/50 border-transparent focus:bg-background uppercase" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {isRtl ? 'أدخل رمز صديقك — تحصلان معًا على رصيد محفظة عند أول عملية شراء.' : "Enter a friend's code — you both get wallet credit on your first purchase."}
                  </p>
                </div>

                {registerForm.watch('role') === 'teacher' && (
                  <div className="flex flex-col gap-1 mt-4 p-4 rounded-xl border border-border bg-muted/20">
                    <div className="flex items-start gap-3">
                      <input 
                        type="checkbox" 
                        {...registerForm.register('agreedToCommission')} 
                        id="agreedToCommission" 
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" 
                      />
                      <label htmlFor="agreedToCommission" className="text-sm text-foreground cursor-pointer">
                        I agree that the platform will retain <span className="font-bold text-primary">{commissionPercent}%</span> of my income as commission.
                      </label>
                    </div>
                    {registerForm.formState.errors.agreedToCommission && (
                      <p className="text-sm text-destructive font-medium ms-8">{registerForm.formState.errors.agreedToCommission.message}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1 mt-4">
                  <div className="flex items-start gap-3">
                    <input 
                      type="checkbox" 
                      {...registerForm.register('agreedToTerms')} 
                      id="agreedToTerms" 
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" 
                    />
                    <label htmlFor="agreedToTerms" className="text-sm text-foreground cursor-pointer select-none">
                      I have read and agree to the Terms & Conditions
                    </label>
                  </div>
                  {registerForm.formState.errors.agreedToTerms && (
                    <p className="text-sm text-destructive font-medium ms-8">{registerForm.formState.errors.agreedToTerms.message as string}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="ms-8 text-xs text-primary font-semibold hover:underline"
                  >
                    📄 Read the full Terms & Conditions
                  </button>
                </div>

                <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" disabled={isRegistering}>
                  {isRegistering ? 'Creating account...' : 'Create Account →'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  A verification code will be sent to your phone to confirm your account.
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>

      {/* Image Side */}
      <div className="hidden lg:block relative flex-1 bg-muted overflow-hidden">
        <Blob color="bg-primary/40" size="w-[600px] h-[600px]" className="-top-32 -start-32" duration={20} />
        <Blob color="bg-cyan-500/30" size="w-[500px] h-[500px]" className="bottom-0 -end-32" delay={3} duration={25} />
        <div className="absolute inset-0 bg-primary/20 mix-blend-multiply z-10" />
        <img
          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=1600&fit=crop"
          alt="Students learning"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-16 text-white">
          <h3 className="font-display text-4xl font-bold mb-4">Empower your future.</h3>
          <p className="text-xl text-white/80 max-w-lg">Join the premier platform for Libyan education. High-quality content, dedicated teachers, and a thriving community.</p>

        </div>
      </div>
      </div>
    </>
  );
}
