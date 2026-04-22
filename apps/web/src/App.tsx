import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { queryClient } from '@/lib/queryClient';

// Lazy load pages for better mobile performance
const Landing = lazy(() => import('@/pages/landing'));
const FeaturesPage = lazy(() => import('@/pages/features'));
const HowItWorksPage = lazy(() => import('@/pages/how-it-works'));
const DownloadPage = lazy(() => import('@/pages/download'));
const SupportPage = lazy(() => import('@/pages/support'));
const Home = lazy(() => import('@/pages/home'));
const Discovery = lazy(() => import('@/pages/discovery'));
const Matches = lazy(() => import('@/pages/matches'));
const CreateActivity = lazy(() => import('@/pages/create-activity'));
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
const TwitterCallback = lazy(() => import('@/pages/twitter-callback'));

// Loading component for better UX
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-green-700">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white">Loading IRLobby...</p>
    </div>
  </div>
);

function AppRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            user?.onboardingCompleted === false ? <Navigate to="/onboarding" replace /> : <Navigate to="/app" replace />
          ) : (
            <Landing />
          )
        }
      />
      <Route
        path="/app"
        element={
          !isAuthenticated ? (
            <Navigate to="/" replace />
          ) : user?.onboardingCompleted === false ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <Home />
          )
        }
      >
        <Route index element={<Navigate to="discovery" replace />} />
        <Route path="discovery" element={<Discovery />} />
        <Route path="matches" element={<Matches />} />
        <Route path="matches/:matchId/chat" element={<Chat />} />
        <Route path="create" element={<CreateActivity />} />
        <Route path="activities" element={<Matches showUserActivities />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="help-support" element={<HelpSupport />} />
      </Route>
      <Route
        path="/onboarding"
        element={
          !isAuthenticated ? (
            <Navigate to="/" replace />
          ) : user?.onboardingCompleted === false ? (
            <Onboarding />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/download" element={<DownloadPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/auth/twitter/callback" element={<TwitterCallback />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
