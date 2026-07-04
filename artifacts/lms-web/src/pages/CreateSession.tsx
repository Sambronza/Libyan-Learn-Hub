import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from '@/components/layout/PageContainer';

/**
 * /teacher/sessions/new is now replaced by the ScheduleLiveCourseModal
 * accessible from the Live Sessions page header.
 * This component immediately redirects teachers there so any existing
 * bookmarks or links continue to work gracefully.
 */
export default function CreateSession() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'teacher') {
      setLocation('/login');
      return;
    }
    // Redirect to the Live Sessions page; the teacher can open the modal from there
    setLocation('/live-sessions?schedule=1');
  }, [user, isLoading, setLocation]);

  return (
    <PageContainer>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </PageContainer>
  );
}
