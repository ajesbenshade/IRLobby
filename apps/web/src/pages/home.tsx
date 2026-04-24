import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

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

  if (!user) {
    return <ScreenLoader />;
  }

  return (
    <AppShell>
      <Suspense fallback={<ScreenLoader />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
