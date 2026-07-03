import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScreenProtectionProps {
  children: React.ReactNode;
  className?: string;
}

export function ScreenProtection({ children, className = '' }: ScreenProtectionProps) {
  const [warning, setWarning] = useState<string | null>(null);
  const [isObscured, setIsObscured] = useState(false);

  const showWarning = (msg: string) => {
    setWarning(msg);
    setTimeout(() => setWarning(null), 5000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        showWarning('Screenshots are strictly prohibited and monitored.');
        // Best-effort: wipe clipboard
        navigator.clipboard.writeText('').catch(() => {});
      }

      // Mac Cmd+Shift+3/4/5 (screenshot / screen recording shortcuts)
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        showWarning('Screen recording/capture is strictly prohibited.');
      }

      // DevTools shortcuts — F12, Ctrl+Shift+I/J/C, Ctrl+U, Cmd+Option+I/J/U
      const isDevTools =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && !e.shiftKey && e.key.toUpperCase() === 'U') ||
        (e.metaKey && e.altKey && ['I', 'J', 'U'].includes(e.key.toUpperCase()));

      if (isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Developer tools are disabled for content security.');
      }
    };

    // visibilitychange: fires when the user switches browser tabs or minimises.
    // LiveKit renders directly in the DOM (no iframes), so this fires correctly.
    const handleVisibilityChange = () => {
      setIsObscured(document.hidden);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    showWarning('Right-click is disabled for content protection.');
  };

  return (
    <div
      className={`relative w-full h-full protection-overlay overflow-hidden ${className}`}
      onContextMenu={handleContextMenu}
    >
      {children}

      {/* --- Layer 1: Tab-switch obscure (highest priority, covers everything) --- */}
      <AnimatePresence>
        {isObscured && (
          <motion.div
            key="obscure"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            className="absolute inset-0 z-[300] flex flex-col items-center justify-center bg-black"
          >
            <ShieldAlert className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
            <h2 className="text-2xl font-bold text-white mb-2 text-center px-4">Content Hidden</h2>
            <p className="text-white/60 max-w-sm text-center px-4 text-sm leading-relaxed">
              Return to this tab to continue watching. Screen recording or opening other applications
              is not permitted while viewing protected content.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Layer 2: Short-lived security warning toast --- */}
      <AnimatePresence>
        {warning && !isObscured && (
          <motion.div
            key="warning"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-none"
          >
            <div className="bg-destructive text-destructive-foreground p-6 rounded-2xl max-w-sm w-[90%] text-center shadow-2xl border border-white/10">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-90" />
              <h3 className="font-bold text-lg mb-1">Security Warning</h3>
              <p className="text-white/90 text-sm">{warning}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Layer 3: Subtle inner-shadow depth effect (lowest z-index) --- */}
      <div className="absolute inset-0 z-[5] pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]" />
    </div>
  );
}
