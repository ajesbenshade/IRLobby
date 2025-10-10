import BottomNavigation from '@/components/BottomNavigation';
import { useAuth } from '@/hooks/useAuth';
import { Suspense, lazy, useState } from 'react';

// Lazy load components for better performance
const Discovery = lazy(() => import('./discovery'));
const Matches = lazy(() => import('./matches'));
const CreateActivity = lazy(() => import('./create-activity'));
const Profile = lazy(() => import('./profile'));
const Chat = lazy(() => import('./chat'));
const Settings = lazy(() => import('./settings'));
const HelpSupport = lazy(() => import('./help-support'));

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
  const [currentScreen, setCurrentScreen] = useState<string>('discovery');
  const [chatActivityId, setChatActivityId] = useState<number | null>(null);

  const renderScreen = () => {
    const screenComponent = (() => {
      switch (currentScreen) {
        case 'discovery':
          return <Discovery />;
        case 'matches':
          return (
            <Matches
              onOpenChat={(activityId) => {
                setChatActivityId(activityId);
                setCurrentScreen('chat');
              }}
            />
          );
        case 'create':
          return <CreateActivity onActivityCreated={() => setCurrentScreen('discovery')} />;
        case 'activities':
          return (
            <Matches
              onOpenChat={(activityId) => {
                setChatActivityId(activityId);
                setCurrentScreen('chat');
              }}
              showUserActivities
            />
          );
        case 'profile':
          return <Profile onNavigate={setCurrentScreen} />;
        case 'settings':
          return <Settings onBack={() => setCurrentScreen('profile')} />;
        case 'help-support':
          return <HelpSupport />;
        case 'chat':
          return chatActivityId ? (
            <Chat activityId={chatActivityId} onBack={() => setCurrentScreen('matches')} />
          ) : (
            <Discovery />
          );
        default:
          return <Discovery />;
      }
    })();

    return <Suspense fallback={<ScreenLoader />}>{screenComponent}</Suspense>;
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full bg-white min-h-screen relative overflow-hidden md:max-w-md md:mx-auto md:shadow-xl">
      {renderScreen()}
      {currentScreen !== 'chat' && (
        <BottomNavigation currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      )}
    </div>
  );
}
