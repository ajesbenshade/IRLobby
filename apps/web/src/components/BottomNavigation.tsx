import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MessageCircle,
  Plus,
  Calendar,
  User
} from "lucide-react";
import { useLocation, useNavigate } from 'react-router-dom';

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      id: 'discovery',
      route: '/app/discovery',
      label: 'Discover',
      icon: Search,
    },
    {
      id: 'matches',
      route: '/app/matches',
      label: 'Matches',
      icon: MessageCircle,
      badge: 0,
    },
    {
      id: 'create',
      route: '/app/create',
      label: 'Create',
      icon: Plus,
      isSpecial: true,
    },
    {
      id: 'activities',
      route: '/app/activities',
      label: 'My Events',
      icon: Calendar,
    },
    {
      id: 'profile',
      route: '/app/profile',
      label: 'Profile',
      icon: User,
    },
  ];

  const getCurrentScreen = () => {
    const path = location.pathname;

    if (path.startsWith('/app/matches')) {
      return 'matches';
    }
    if (path.startsWith('/app/create')) {
      return 'create';
    }
    if (path.startsWith('/app/activities')) {
      return 'activities';
    }
    if (
      path.startsWith('/app/profile') ||
      path.startsWith('/app/settings') ||
      path.startsWith('/app/reviews') ||
      path.startsWith('/app/help-support')
    ) {
      return 'profile';
    }

    return 'discovery';
  };

  const currentScreen = getCurrentScreen();

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 shadow-lg dark:shadow-gray-900/20">
      <div className="flex justify-around items-center py-2">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          const Icon = item.icon;

          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={() => navigate(item.route)}
              className={`flex flex-col items-center justify-center p-2 relative min-h-[60px] flex-1 ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {item.isSpecial ? (
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-purple-600 rounded-full flex items-center justify-center mb-1">
                  <Icon className="w-4 h-4 text-white" />
                </div>
              ) : (
                <Icon className="w-5 h-5 mb-1" />
              )}

              <span className="text-xs font-medium text-center">{item.label}</span>

              {item.badge && item.badge > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute top-1 right-2 w-5 h-5 p-0 text-xs flex items-center justify-center"
                >
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
