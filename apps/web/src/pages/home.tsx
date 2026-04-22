import BottomNavigation from '@/components/BottomNavigation';
import { useAuth } from '@/hooks/useAuth';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

// Loading component
const ScreenLoader = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const hideBottomNav = location.pathname.includes('/chat/');

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full bg-white min-h-screen relative overflow-hidden md:max-w-md md:mx-auto md:shadow-xl">
      <Suspense fallback={<ScreenLoader />}>
        <Outlet />
      </Suspense>
      {!hideBottomNav && <BottomNavigation />}
    </div>
  );
}
