import React, { useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const DISMISS_KEY = 'lms_app_banner_dismissed';
// Set VITE_ANDROID_APP_URL after the app is live on Google Play, e.g.
// https://play.google.com/store/apps/details?id=com.essamku.learn
const ANDROID_URL = import.meta.env.VITE_ANDROID_APP_URL as string | undefined;

function isAndroidBrowser(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * "Open in the app" banner shown to Android mobile-web visitors.
 * Hidden until VITE_ANDROID_APP_URL is configured (i.e. app published),
 * and stays hidden for 14 days after the user dismisses it.
 */
export function AppBanner() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [visible, setVisible] = useState(() => {
    if (!ANDROID_URL || !isAndroidBrowser()) return false;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 14 * 24 * 60 * 60 * 1000) return false;
    return true;
  });

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div className="sticky top-0 z-[60] bg-gradient-to-r from-primary to-teal-500 text-white px-3 py-2.5 flex items-center gap-3 shadow-md">
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
        <Smartphone className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">
          {isAr ? 'تجربة أفضل في التطبيق' : 'Better in the app'}
        </p>
        <p className="text-[11px] opacity-85 leading-tight">
          {isAr ? 'حمّل تطبيق EduLibya من متجر Google Play' : 'Get the EduLibya app on Google Play'}
        </p>
      </div>
      <a
        href={ANDROID_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 bg-white text-primary text-xs font-bold px-4 py-2 rounded-full shadow hover:opacity-90"
      >
        {isAr ? 'فتح' : 'Open'}
      </a>
    </div>
  );
}
