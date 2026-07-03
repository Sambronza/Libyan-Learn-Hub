import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from 'wouter';
import { Shield } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ShieldAlert, LogOut, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Configure timeouts (in milliseconds)
const INACTIVITY_LOCK_LIMIT = 5 * 60 * 1000;   // 5 minutes of inactivity
const INACTIVITY_LOGOUT_LIMIT = 60 * 60 * 1000; // 1 hour hard logout
const GRACE_PERIOD = 30 * 1000;                 // 30 seconds countdown warning
const STORAGE_KEY = 'lms_last_activity';

export function InactivityTimer({ suppressWhenActive = false }: { suppressWhenActive?: boolean }) {
  const { user, logout, lock, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(GRACE_PERIOD / 1000);

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityUpdateRef = useRef<number>(Date.now());
  const showWarningRef = useRef<boolean>(showWarning);

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  // Auto action triggered when the grace countdown finishes
  // If user has a passkey: lock the session (show PasscodeLock overlay)
  // If no passkey: fully log them out
  const handleAutoLogout = useCallback(() => {
    setShowWarning(false);
    const hasPasskey = !!(user as any)?.hasPasskey;
    if (hasPasskey) {
      lock();
    } else {
      logout('/login?reason=inactivity');
    }
  }, [lock, logout, user]);

  // Update localStorage with current time, throttled to max once per second
  const updateActivity = useCallback(() => {
    if (!isAuthenticated || showWarningRef.current) return;
    const now = Date.now();
    if (now - lastActivityUpdateRef.current > 1000) {
      localStorage.setItem(STORAGE_KEY, now.toString());
      lastActivityUpdateRef.current = now;
      
      // If we're showing the warning but user interacts (e.g., clicks around),
      // we don't automatically hide it unless they click the explicit "Keep Me Signed In" button
      // to ensure they acknowledge it.
    }
  }, [isAuthenticated]);

  // Listen to interactive events to establish user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initialize activity
    localStorage.setItem(STORAGE_KEY, Date.now().toString());

    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    
    // Attach listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Cleanup listeners
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [isAuthenticated, updateActivity]);

  // Periodic check for inactivity across tabs
  useEffect(() => {
    if (!isAuthenticated) {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      return;
    }

    checkIntervalRef.current = setInterval(() => {
      // If media is actively playing / uploading / streaming, keep resetting the activity
      // timestamp so the warning never fires while the user is "passively" active.
      if (suppressWhenActive) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        lastActivityUpdateRef.current = Date.now();
        // Make sure any stale warning is dismissed
        if (showWarning) setShowWarning(false);
        return;
      }

      const lastActivityStr = localStorage.getItem(STORAGE_KEY);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const timeSinceLastActivity = Date.now() - lastActivity;

      // Hard logout after 1 hour
      if (timeSinceLastActivity >= INACTIVITY_LOGOUT_LIMIT) {
        logout('/login?reason=inactivity');
        return;
      }

      // Lock warning after 5 minutes
      if (timeSinceLastActivity >= INACTIVITY_LOCK_LIMIT) {
        setShowWarning(true);
      } else {
        // If another tab updated activity, dismiss the warning here
        if (showWarning && timeSinceLastActivity < INACTIVITY_LOCK_LIMIT) {
          setShowWarning(false);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [isAuthenticated, showWarning, suppressWhenActive]);

  // Listen to storage events directly so if another tab clicks "Keep Me Signed In",
  // this tab immediately closes the modal.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && showWarning) {
        const newTime = parseInt(e.newValue || '0', 10);
        if (Date.now() - newTime < INACTIVITY_LOCK_LIMIT) {
          setShowWarning(false);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [showWarning]);

  // Handle countdown interval when warning alert dialog is displayed
  useEffect(() => {
    if (showWarning) {
      setCountdown(GRACE_PERIOD / 1000);

      countdownTimerRef.current = setInterval(() => {
        // Re-check activity in case it was updated in another tab but the interval hasn't fired
        const lastActivityStr = localStorage.getItem(STORAGE_KEY);
        const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
        if (Date.now() - lastActivity < INACTIVITY_LOCK_LIMIT) {
          setShowWarning(false);
          return;
        }

        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current!);
            handleAutoLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [showWarning, handleAutoLogout]);

  // Keep Session Action
  const handleKeepSession = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShowWarning(false);
  };

  const hasPasskey = !!(user as any)?.hasPasskey;

  // Immediate action from the warning dialog
  // If user has a passkey: lock; otherwise: log out
  const handleManualLogout = () => {
    setShowWarning(false);
    if (hasPasskey) {
      lock();
    } else {
      logout('/login?reason=inactivity');
    }
  };

  if (!isAuthenticated || !user) return null;

  // Determine dynamic message text based on role
  const isTeacher = user.role === 'teacher';
  const roleDescription = isTeacher 
    ? t('inactivity.teacher.message') 
    : t('inactivity.student.message');

  return (
    <AnimatePresence>
      {showWarning && (
        <AlertDialog open={showWarning} onOpenChange={(open) => {
          // If the user tries to dismiss via outside click or escape, treat it as activity
          if (!open) {
            handleKeepSession();
          }
        }}>
          <AlertDialogContent className="max-w-md rounded-3xl border border-border shadow-2xl p-6 overflow-hidden">
            
            {/* Glassmorphic Background Glow */}
            <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${
              isTeacher ? 'bg-secondary' : 'bg-primary'
            }`} />

            <AlertDialogHeader className="flex flex-col items-center text-center">
              {/* Animated Icon Header */}
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                  isTeacher ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'
                }`}
              >
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </motion.div>

              <AlertDialogTitle className="text-xl font-display font-bold">
                {t('inactivity.warning.title')}
              </AlertDialogTitle>

              {/* Custom Interactive Avatar & Banner */}
              <div className="flex items-center gap-3 bg-muted/50 py-2 px-4 rounded-full my-3 border border-border/30">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-sm font-semibold text-foreground/80">
                  {isTeacher ? `👨‍🏫 ${user.fullName}` : `🎓 ${user.fullName}`}
                </span>
              </div>

              <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed text-center px-2">
                {roleDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Countdown Clock Display */}
            <div className="flex flex-col items-center justify-center my-5 py-4 bg-muted/40 rounded-2xl border border-border/20">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-1">
                {t('inactivity.countdown').replace('{seconds}', countdown.toString()).split(' ')[0]}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-mono font-bold tracking-tight text-destructive">
                  00:{countdown < 10 ? `0${countdown}` : countdown}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t('inactivity.countdown').replace('{seconds}', countdown.toString())}
              </p>
            </div>

            <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
              <AlertDialogCancel 
                onClick={handleManualLogout} 
                className="flex-1 h-12 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors gap-2 m-0"
              >
                {hasPasskey ? (
                  <><Shield className="w-4 h-4" /> Lock Session</>
                ) : (
                  <><LogOut className="w-4 h-4" /> {t('inactivity.btn.logout')}</>
                )}
              </AlertDialogCancel>
              
              <AlertDialogAction 
                onClick={handleKeepSession} 
                className={`flex-1 h-12 rounded-xl text-white font-medium shadow-lg transition-all hover:scale-[1.02] gap-2 m-0 ${
                  isTeacher 
                    ? 'bg-secondary hover:bg-secondary/90 shadow-secondary/20' 
                    : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {t('inactivity.btn.stay')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AnimatePresence>
  );
}
