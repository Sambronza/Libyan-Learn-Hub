import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, LogOut, ShieldCheck, Delete } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo } from '@/components/ui/Logo';

const MAX_DIGITS = 4;

interface PasscodeLockProps {
  onUnlocked: () => void;
}

export function PasscodeLock({ onUnlocked }: PasscodeLockProps) {
  const { user, logout, login } = useAuth();
  const { language } = useLanguage();
  const api = useApi();
  const isRtl = language === 'ar';

  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleVerify = useCallback(async (code: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-passkey', { passkey: code });
      if (res.token) {
        login(res.token);
      }
      onUnlocked();
    } catch (err: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setDigits([]);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      if (newAttempts >= 5) {
        setError(isRtl
          ? 'محاولات خاطئة كثيرة. يرجى تسجيل الدخول مجدداً.'
          : 'Too many failed attempts. Please log in again.');
      } else {
        setError(isRtl ? 'رمز المرور غير صحيح' : 'Incorrect passkey');
      }
    } finally {
      setIsVerifying(false);
    }
  }, [api, attempts, isRtl, isVerifying, onUnlocked, login]);

  const addDigit = useCallback((d: string) => {
    if (isVerifying || attempts >= 5) return;
    setError('');
    setDigits(prev => {
      if (prev.length >= MAX_DIGITS) return prev;
      const next = [...prev, d];
      // Auto-verify when 4 digits reached
      if (next.length === 4) {
        handleVerify(next.join(''));
      }
      return next;
    });
  }, [handleVerify, isVerifying, attempts]);

  const removeDigit = () => {
    setError('');
    setDigits(prev => prev.slice(0, -1));
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') addDigit(e.key);
    else if (e.key === 'Backspace') removeDigit();
  }, [addDigit]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const dialPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  const isTeacher = user?.role === 'teacher';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Background glow */}
      <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none ${isTeacher ? 'bg-secondary' : 'bg-primary'}`} />

      {/* Card */}
      <motion.div
        animate={shake ? { x: [-12, 12, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="bg-card border border-border shadow-2xl rounded-3xl p-8 w-full max-w-sm flex flex-col items-center gap-6"
      >
        {/* Brand Logo */}
        <div className="mb-2">
          <Logo size={52} linked={false} />
        </div>

        {/* Icon */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isTeacher ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'}`}>
          <Lock className="w-8 h-8" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-display font-bold">
            {isRtl ? 'الجلسة مقفلة' : 'Session Locked'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isRtl
              ? `أهلاً ${user?.fullName}، أدخل رمز المرور للمتابعة`
              : `Welcome back, ${user?.fullName}. Enter your passkey to continue.`}
          </p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: digits.length === i + 1 ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.15 }}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < digits.length
                  ? isTeacher ? 'bg-secondary border-secondary' : 'bg-primary border-primary'
                  : 'border-border bg-transparent'
              }`}
            />
          ))}
        </div>


        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-destructive font-medium text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Dial Pad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {dialPad.flat().map((key, i) => {
            if (!key) return <div key={i} />;
            if (key === 'del') {
              return (
                <button
                  key={i}
                  onClick={removeDigit}
                  className="h-14 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors active:scale-95"
                  aria-label="Delete"
                >
                  <Delete className="w-5 h-5" />
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={() => addDigit(key)}
                disabled={isVerifying || attempts >= 5}
                className={`h-14 rounded-2xl text-xl font-semibold bg-muted/50 hover:bg-muted transition-all active:scale-95 disabled:opacity-40 ${isVerifying ? 'cursor-wait' : ''}`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between w-full pt-2 border-t border-border/50">
          {attempts >= 5 ? (
            <button
              onClick={() => logout('/login')}
              className="flex items-center gap-2 text-sm text-destructive font-medium hover:underline mx-auto"
            >
              <LogOut className="w-4 h-4" />
              {isRtl ? 'تسجيل الدخول مجدداً' : 'Log in again'}
            </button>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {isRtl ? 'نسيت الرمز؟' : 'Forgot passkey?'}
              </span>
              <button
                onClick={() => logout('/login')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isRtl ? 'تسجيل الخروج' : 'Sign out'}
              </button>
            </>
          )}
        </div>
      </motion.div>

      {isVerifying && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          {isRtl ? 'جارٍ التحقق...' : 'Verifying...'}
        </div>
      )}
    </motion.div>
  );
}
