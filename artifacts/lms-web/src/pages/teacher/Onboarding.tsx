import { useLocation } from 'wouter';
import TeacherOnboarding from '@/components/TeacherOnboarding';

/**
 * Route wrapper for the teacher onboarding / document-resubmission wizard.
 * Mounted at /teacher/onboarding — the "Complete Registration" and
 * "Resubmit Application" buttons on the teacher dashboard link here.
 * On completion, returns the teacher to their dashboard.
 */
export default function TeacherOnboardingPage() {
  const [, setLocation] = useLocation();
  return <TeacherOnboarding onComplete={() => setLocation('/teacher/dashboard')} />;
}
