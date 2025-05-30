import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  MessageCircle, 
  Plus, 
  Calendar, 
  User 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type Screen = "discovery" | "matches" | "create" | "activities" | "profile";

interface BottomNavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export function BottomNavigation({ currentScreen, onScreenChange }: BottomNavigationProps) {
  const { data: matches } = useQuery({
    queryKey: ["/api/matches"],
  });

  const unreadCount = 0; // This would come from WebSocket or API

  const navItems = [
    {
      id: "discovery" as Screen,
      icon: Heart,
      label: "Discover",
    },
    {
      id: "matches" as Screen,
      icon: MessageCircle,
      label: "Matches",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      id: "create" as Screen,
      icon: Plus,
      label: "Create",
      special: true,
    },
    {
      id: "activities" as Screen,
      icon: Calendar,
      label: "My Events",
    },
    {
      id: "profile" as Screen,
      icon: User,
      label: "Profile",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <Button
              key={item.id}
              onClick={() => onScreenChange(item.id)}
              variant="ghost"
              className={`flex flex-col items-center p-3 relative ${
                isActive 
                  ? "text-primary" 
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {item.special ? (
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-purple-600 rounded-full flex items-center justify-center mb-1">
                  <Icon className="h-4 w-4 text-white" />
                </div>
              ) : (
                <Icon className="h-5 w-5 mb-1" />
              )}
              
              <span className="text-xs font-medium">{item.label}</span>
              
              {item.badge && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 text-xs flex items-center justify-center bg-red-500 text-white p-0">
                  {item.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
