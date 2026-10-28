import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { buildLoginRedirect, getAuthRedirect, getSafePostAuthRedirect } from '@/lib/authRouting';
import { queryClient } from '@/lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Lazy load pages for better mobile performance
const Landing = lazy(() => import('@/pages/landing'));
const SupportPage = lazy(() => import('@/pages/support'));
const Home = lazy(() => import('@/pages/home'));
const Discovery = lazy(() => import('@/pages/discovery'));
const CreateActivity = lazy(() => import('@/pages/create-activity'));
const FoyerHost = lazy(() => import('@/pages/foyer-host'));
const Gatherings = lazy(() => import('@/pages/gatherings'));
const PrayerRequests = lazy(() => import('@/pages/prayer-requests'));
const PrayerCreate = lazy(() => import('@/pages/prayer-create'));
const PrayerDetail = lazy(() => import('@/pages/prayer-detail'));
const PrayerChat = lazy(() => import('@/pages/prayer-chat'));
const Household = lazy(() => import('@/pages/household'));
const Profile = lazy(() => import('@/pages/profile'));
const Chat = lazy(() => import('@/pages/chat'));
const Reviews = lazy(() => import('@/pages/reviews'));
const Settings = lazy(() => import('@/pages/settings'));
const HelpSupport = lazy(() => import('@/pages/help-support'));
const Onboarding = lazy(() => import('@/pages/onboarding'));
const NotFound = lazy(() => import('@/pages/not-found'));
const ForgotPasswordPage = lazy(() => import('@/pages/forgot-password'));
const ResetPasswordPage = lazy(() => import('@/pages/reset-password'));
const PrivacyPolicy = lazy(() => import('@/pages/privacy-policy'));
const TermsOfService = lazy(() => import('@/pages/terms-of-service'));
const Notifications = lazy(() => import('@/pages/notifications'));
const Moderation = lazy(() => import('@/pages/moderation'));
const ActivityDetail = lazy(() => import('@/pages/activity-detail'));
const UserDetail = lazy(() => import('@/pages/user-detail'));

// Loading component for better UX
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#f6f1ee]">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-[#f9e8ee] border-t-[#a2033f] rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-[#222222]">Loading The Foyer...</p>
    </div>
  </div>
);

function AppRoutes() {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const location = useLocation();

  const authRouteState = { isAuthenticated, isLoading, needsOnboarding };

  const PublicHomeRoute = ({ children }: { children: ReactNode }) => {
    const redirectTo = getAuthRedirect('public-home', authRouteState);
    const postAuthRedirect = getSafePostAuthRedirect(
      new URLSearchParams(location.search).get('redirect'),
      redirectTo ?? undefined,
    );
    return redirectTo ? <Navigate to={postAuthRedirect} replace /> : <>{children}</>;
  };

  const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const redirectTo = getAuthRedirect('protected', authRouteState);
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    if (redirectTo) {
      const loginRedirect = redirectTo === '/' ? buildLoginRedirect(currentPath) : redirectTo;
      return <Navigate to={loginRedirect} replace />;
    }
    return <>{children}</>;
  };

  const OnboardingRoute = ({ children }: { children: ReactNode }) => {
    const redirectTo = getAuthRedirect('onboarding', authRouteState);
    return redirectTo ? <Navigate to={redirectTo} replace /> : <>{children}</>;
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicHomeRoute>
            <Landing />
          </PublicHomeRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicHomeRoute>
            <Landing />
          </PublicHomeRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/discovery" replace />} />
        <Route path="discovery" element={<Discovery />} />
        <Route path="gatherings/:matchId/chat" element={<Chat />} />
        <Route path="create" element={<CreateActivity />} />
        <Route path="host" element={<FoyerHost />} />
        <Route path="gatherings" element={<Gatherings />} />
        <Route path="prayer" element={<PrayerRequests />} />
        <Route path="prayer/new" element={<PrayerCreate />} />
        <Route path="prayer/:prayerId/chat" element={<PrayerChat />} />
        <Route path="prayer/:prayerId" element={<PrayerDetail />} />
        <Route path="household" element={<Household />} />
        <Route path="activities" element={<Navigate to="/app/gatherings" replace />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="moderation" element={<Moderation />} />
        <Route path="activity/:activityId" element={<ActivityDetail />} />
        <Route path="user/:userId" element={<UserDetail />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="help-support" element={<HelpSupport />} />
      </Route>
      <Route
        path="/onboarding"
        element={
          <OnboardingRoute>
            <Onboarding />
          </OnboardingRoute>
        }
      />
      <Route path="/features" element={<Navigate to="/" replace />} />
      <Route path="/how-it-works" element={<Navigate to="/" replace />} />
      <Route path="/download" element={<Navigate to="/" replace />} />
      <Route path="/app/matches/*" element={<Navigate to="/app/gatherings" replace />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </ErrorBoundary>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
