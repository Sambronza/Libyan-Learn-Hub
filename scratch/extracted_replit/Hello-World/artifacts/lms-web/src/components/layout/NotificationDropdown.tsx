import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BookOpen, MonitorPlay, Info, AlertTriangle, CheckCircle2, ClipboardCheck, BadgeCheck, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLocation } from 'wouter';

export function NotificationDropdown() {
  const { language } = useLanguage();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'new_course': return <BookOpen className="w-5 h-5 text-indigo-500" />;
      case 'live_session_starting': return <MonitorPlay className="w-5 h-5 text-emerald-500" />;
      case 'live_session_cancelled': return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      case 'course_submitted': return <ClipboardCheck className="w-5 h-5 text-amber-500" />;
      case 'course_approved': return <BadgeCheck className="w-5 h-5 text-green-500" />;
      case 'course_rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    
    // Deep linking based on type
    if (notification.type === 'new_course' && notification.referenceId) {
      setLocation(`/courses/${notification.referenceId}`);
    } else if (notification.type === 'live_session_starting' && notification.referenceId) {
      setLocation(`/live/${notification.referenceId}`);
    } else if (notification.type === 'course_submitted') {
      // Send admin to the Approvals tab
      setLocation('/admin?tab=approvals');
    } else if (notification.type === 'course_approved' || notification.type === 'course_rejected') {
      // Send teacher to their dashboard
      setLocation('/teacher/dashboard');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-secondary/20 text-muted-foreground hover:text-secondary transition-colors"
      >
        <motion.div
          animate={unreadCount > 0 ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.5, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 5 }}
        >
          <Bell className="w-5 h-5" />
        </motion.div>
        
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-background" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={`absolute ${language === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-80 sm:w-96 bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-50`}
          >
            <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center bg-muted/20">
              <h3 className="font-bold text-foreground">
                {language === 'ar' ? 'الإشعارات' : 'Notifications'}
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                  {unreadCount} {language === 'ar' ? 'جديد' : 'New'}
                </span>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center flex flex-col items-center justify-center text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">{language === 'ar' ? 'لا توجد إشعارات جديدة' : 'No new notifications'}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full text-start p-4 transition-colors hover:bg-muted/30 flex gap-3 ${!notification.isRead ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!notification.isRead ? 'bg-background shadow-sm' : 'bg-muted/50'}`}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <p className={`text-sm font-semibold ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {language === 'ar' ? notification.titleAr : notification.title}
                          </p>
                        </div>
                        <p className={`text-xs ${!notification.isRead ? 'text-foreground/80' : 'text-muted-foreground'} line-clamp-2`}>
                          {language === 'ar' ? notification.messageAr : notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), { 
                            addSuffix: true,
                            locale: language === 'ar' ? ar : enUS 
                          })}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
