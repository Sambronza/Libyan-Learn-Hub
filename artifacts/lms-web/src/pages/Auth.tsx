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
import { Blob } from '@/components/ui/Blob';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(9, 'Enter a valid phone number').regex(/^[0-9+\s\-()]+$/, 'Invalid phone number').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  passkey: z.string().length(4, 'Passkey must be exactly 4 digits').regex(/^\d+$/, 'Passkey must contain only numbers'),
  role: z.enum(['student', 'teacher']),
  agreedToCommission: z.boolean().optional(),
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
    return params.get('redirect') || null;
  })();
  const { login: setAuthContext } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isRtl = language === 'ar';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const api = useApi();
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<'form' | 'otp' | 'forgot' | 'reset'>('form');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpInfo, setOtpInfo] = useState<{ message: string; code: string } | null>(null);
  const [pendingToken, setPendingToken] = useState<string>('');
  const [pendingRole, setPendingRole] = useState<string>('student');
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [commissionPercent, setCommissionPercent] = useState('20');
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
      setOtpCode(''); // Clear any stale code from previous steps
    }
    if (step === 'reset') {
      setOtpCode(''); // Clear any stale code from the registration OTP step
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
    if (resendTimer > 0 || resendLoading) return;
    setErrorMsg('');
    setResendLoading(true);
    try {
      const data = await api.post('/auth/resend-otp', { email: registerForm.getValues('email'), type: 'email' });
      setOtpInfo({ message: data.otpMessage, code: data.otpCode });
      setOtpCode(''); // Clear field so user enters the fresh code
      setResendTimer(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Resend failed');
    } finally {
      setResendLoading(false);
    }
  };

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phoneNumber: '', password: '', passkey: '', role: 'student' as 'student' | 'teacher', agreedToCommission: false }
  });

  const { mutate: loginMutate, isPending: isLoggingIn } = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuthContext(data.token);
        const searchParams = new URLSearchParams(window.location.search);
        const returnTo = searchParams.get('returnTo');
        
        if (returnTo) {
          window.location.href = decodeURIComponent(returnTo);
        } else {
          window.location.href = data.user.role === 'teacher' ? '/teacher/dashboard' : '/dashboard';
        }
      },
      onError: (err) => setErrorMsg(err.message || 'Login failed')
    }
  });

  const { mutate: registerMutate, isPending: isRegistering } = useRegister({
    mutation: {
      onSuccess: (data: any) => {
        setPendingToken(data.token);
        setPendingRole(data.user.role);
        setOtpInfo({ message: data.otpMessage, code: data.otpCode });
        setStep('otp');
      },
      onError: (err) => setErrorMsg(err.message || 'Registration failed')
    }
  });

  const onSubmitLogin = (data: z.infer<typeof loginSchema>) => {
    setErrorMsg('');
    loginMutate({ data });
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
      setOtpInfo({ message: res.otpMessage, code: res.otpCode });
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
    registerMutate({ data: { ...data, tier: 'free' } as any });
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit code');
      return;
    }
    setVerifying(true);
    setErrorMsg('');
    try {
      // Store token first so useApi can attach it as Authorization header,
      // then immediately remove it if verification fails.
      localStorage.setItem('lms_token', pendingToken);
      await api.post('/auth/verify-otp', { code: otpCode, type: 'email' });
      // Verification succeeded — now formally log the user in
      setAuthContext(pendingToken);
      toast({ title: 'Registration successful!', description: 'Your email has been verified.' });
      window.location.href = pendingRole === 'teacher' ? '/teacher/dashboard' : '/dashboard';
    } catch (err: any) {
      // Verification failed — evict the token so the user is not partially logged in
      localStorage.removeItem('lms_token');
      setOtpCode('');
      setErrorMsg(err.message || 'Invalid code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSkipVerification = () => {
    setAuthContext(pendingToken);
    // Allow auth state to settle before navigating
    setTimeout(() => {
      setLocation(pendingRole === 'teacher' ? '/teacher/dashboard' : '/dashboard');
    }, 100);
  };



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
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold">Verify Your Account</h2>
            <p className="text-muted-foreground mt-2 text-sm">Enter the 6-digit verification code sent to your email</p>
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
                disabled={resendTimer > 0 || resendLoading}
                onClick={handleResend}
                className={`text-sm font-medium ${resendTimer > 0 || resendLoading ? 'text-muted-foreground' : 'text-primary hover:underline'}`}
              >
                {resendLoading ? 'Sending...' : resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
              </button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={handleSkipVerification}
            >
              Skip for now →
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[620px] xl:w-[700px] bg-card z-10 relative shadow-2xl">
        <div className="absolute top-8 start-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
        </div>

        <div className="mx-auto w-full max-w-md pt-20 sm:pt-0">
          <div className="mb-8 text-center lg:text-start">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-teal-400 flex items-center justify-center text-white shadow-lg mx-auto lg:mx-0 mb-5">
              <span className="font-display font-bold text-2xl">L</span>
            </div>
            <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Link href={isLogin ? '/register' : '/login'} className="font-semibold text-primary hover:underline transition-colors">
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
                    Phone Number <span className="text-xs text-muted-foreground">(Optional)</span>
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
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Session Passkey (4 Digits)</label>
                  <Input {...registerForm.register('passkey')} type="password" placeholder="e.g., 1234 (used to quickly unlock your session)" maxLength={4} className="h-12 bg-muted/50 border-transparent focus:bg-background" />
                  {registerForm.formState.errors.passkey && <p className="mt-1 text-sm text-destructive">{registerForm.formState.errors.passkey.message}</p>}
                </div>

                <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" disabled={isRegistering}>
                  {isRegistering ? 'Creating account...' : 'Create Account →'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  A verification code will be sent to your email to confirm your account.
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
  );
}
