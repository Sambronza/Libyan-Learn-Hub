import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: number;
  userId: number;
  type: 'new_course' | 'live_session_starting' | 'live_session_cancelled' | 'system_alert' | 'course_submitted' | 'course_approved' | 'course_rejected';
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  referenceId: number | null;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { get, put } = useApi();
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await get('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // Silently fail — don't disrupt the app for notification errors
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, get]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    fetchNotifications();

    // Poll every 15 seconds for more responsive notifications
    intervalRef.current = setInterval(fetchNotifications, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, fetchNotifications]);

  const markAsRead = useCallback(async (id: number) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await put(`/notifications/${id}/read`, {});
    } catch {
      // Revert on failure
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: false } : n))
      );
    }
  }, [put]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    refetch: fetchNotifications,
  };
}
