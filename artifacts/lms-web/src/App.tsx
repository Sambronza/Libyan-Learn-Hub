import React, { Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { InactivityTimer } from "@/components/layout/InactivityTimer";
import { PasscodeLock } from "@/components/layout/PasscodeLock";
import { useAuth } from "@/contexts/AuthContext";
import { MediaActivityProvider, useMediaActivity } from "@/contexts/MediaActivityContext";
import { useLocation } from "wouter";

const NotFound = React.lazy(() => import("@/pages/not-found"));
const Home = React.lazy(() => import("@/pages/Home"));
const Courses = React.lazy(() => import("@/pages/Courses"));
const CourseDetail = React.lazy(() => import("@/pages/CourseDetail"));
const Learn = React.lazy(() => import("@/pages/Learn"));
const Auth = React.lazy(() => import("@/pages/Auth"));
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const TeacherDashboard = React.lazy(() => import("@/pages/TeacherDashboard"));
const CreateCourse = React.lazy(() => import("@/pages/CreateCourse"));
const EditCourse = React.lazy(() => import("@/pages/EditCourse"));
const CreateSession = React.lazy(() => import("@/pages/CreateSession"));
const ManageCourse = React.lazy(() => import("@/pages/ManageCourse"));
const AdminDashboard = React.lazy(() => import("@/pages/AdminDashboard"));
const LiveSessions = React.lazy(() => import("@/pages/LiveSessions"));
const SessionRoom = React.lazy(() => import("@/pages/SessionRoom"));
const TutoringRoom = React.lazy(() => import("@/pages/TutoringRoom"));
const Tutoring = React.lazy(() => import("@/pages/Tutoring"));
const Teachers = React.lazy(() => import("@/pages/Teachers"));
const TeacherProfile = React.lazy(() => import("@/pages/TeacherProfile"));
const SearchPage = React.lazy(() => import("@/pages/Search"));
const DMCAComplaint = React.lazy(() => import("@/pages/DMCAComplaint"));
const Academy = React.lazy(() => import("@/pages/Academy"));
const AcademyDashboard = React.lazy(() => import("@/pages/AcademyDashboard"));
const AcademyApply = React.lazy(() => import("@/pages/AcademyApply"));
const BiometricsSetup = React.lazy(() => import("@/pages/teacher/BiometricsSetup"));
const TutoringRegistration = React.lazy(() => import("@/pages/teacher/TutoringRegistration"));
const Wallet = React.lazy(() => import("@/pages/Wallet"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Caught error in boundary:", error, errorInfo);
    // If the error is a dynamic import failure (chunk load error), reload the page to get the latest bundle
    if (
      error?.message?.includes("Failed to fetch dynamically imported module") || 
      error?.message?.includes("Importing a module script failed") ||
      error?.name === 'ChunkLoadError'
    ) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            We had trouble loading this page. This usually happens when the app has been updated.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const noLayoutRoutes = ['/login', '/register', '/session/', '/tutoring/room/'];
  const hideLayout = noLayoutRoutes.some(route => location.startsWith(route));

  if (hideLayout) {
    return <>{children}</>;
  }

  return <MainLayout>{children}</MainLayout>;
}

function Router() {
  return (
    <LayoutWrapper>
      <ErrorBoundary>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/courses" component={Courses} />
        <Route path="/courses/:id" component={CourseDetail} />
        <Route path="/courses/:id/learn" component={Learn} />
        <Route path="/academy" component={Academy} />
        <Route path="/academy/dashboard" component={AcademyDashboard} />
        <Route path="/academy/apply" component={AcademyApply} />
        <Route path="/live-sessions" component={LiveSessions} />
        <Route path="/session/:id" component={SessionRoom} />
        <Route path="/tutoring/room/:id" component={TutoringRoom} />
        <Route path="/tutoring" component={Tutoring} />
        <Route path="/teachers" component={Teachers} />
        <Route path="/teachers/:slug" component={TeacherProfile} />
        <Route path="/teacher/biometrics-setup" component={BiometricsSetup} />
        <Route path="/search" component={SearchPage} />
        <Route path="/dmca" component={DMCAComplaint} />
        <Route path="/login" component={Auth} />
        <Route path="/register" component={Auth} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/profile" component={Profile} />
        <Route path="/teacher/dashboard" component={TeacherDashboard} />
        <Route path="/teacher/courses/new" component={CreateCourse} />
        <Route path="/teacher/courses/:id/edit" component={EditCourse} />
        <Route path="/teacher/courses/:id/lessons" component={ManageCourse} />
        <Route path="/teacher/sessions/new" component={CreateSession} />
        <Route path="/teacher/tutoring-registration" component={TutoringRegistration} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/wallet" component={Wallet} />
        <Route component={NotFound} />
      </Switch>
        </Suspense>
      </ErrorBoundary>
    </LayoutWrapper>
  );
}

function GlobalLockScreen() {
  const { isLocked, unlock, isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated || !isLocked) {
    return null;
  }

  return <PasscodeLock onUnlocked={unlock} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MediaActivityProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
              <InactivityTimerWrapper />
              <GlobalLockScreen />
            </TooltipProvider>
          </MediaActivityProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function InactivityTimerWrapper() {
  const { isMediaActive } = useMediaActivity();
  return <InactivityTimer suppressWhenActive={isMediaActive} />;
}

export default App;
