import { useAuth } from "@/hooks/useAuth";
import BottomNavigation from "@/components/BottomNavigation";
import Discovery from "./discovery";
import Matches from "./matches";
import CreateActivity from "./create-activity";
import Profile from "./profile";
import Chat from "./chat";
import { useState } from "react";

export default function Home() {
  const { user } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<string>('discovery');
  const [chatActivityId, setChatActivityId] = useState<number | null>(null);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'discovery':
        return <Discovery />;
      case 'matches':
        return <Matches onOpenChat={(activityId) => {
          setChatActivityId(activityId);
          setCurrentScreen('chat');
        }} />;
      case 'create':
        return <CreateActivity onActivityCreated={() => setCurrentScreen('discovery')} />;
      case 'activities':
        return <Matches onOpenChat={(activityId) => {
          setChatActivityId(activityId);
          setCurrentScreen('chat');
        }} showUserActivities />;
      case 'profile':
        return <Profile />;
      case 'chat':
        return chatActivityId ? (
          <Chat 
            activityId={chatActivityId} 
            onBack={() => setCurrentScreen('matches')} 
          />
        ) : (
          <Discovery />
        );
      default:
        return <Discovery />;
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl relative overflow-hidden">
      {renderScreen()}
      {currentScreen !== 'chat' && (
        <BottomNavigation 
          currentScreen={currentScreen} 
          onNavigate={setCurrentScreen} 
        />
      )}
    </div>
  );
}
