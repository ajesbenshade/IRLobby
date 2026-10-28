import { Button } from '@/components/ui/button';
import { Search, Plus, Calendar, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export const navItems = [
  { id: 'discovery', route: '/app/discovery', label: 'Discover', icon: Search },
  { id: 'gatherings', route: '/app/gatherings', label: 'Gatherings', icon: Calendar },
  { id: 'create', route: '/app/host', label: 'Host', icon: Plus, isSpecial: true },
  { id: 'profile', route: '/app/profile', label: 'Profile', icon: User },
];

export function currentNavId(path: string) {
  if (path.startsWith('/app/gatherings') || path.startsWith('/app/activities')) return 'gatherings';
  if (path.startsWith('/app/create') || path.startsWith('/app/host')) return 'create';
  if (
    path.startsWith('/app/profile') ||
    path.startsWith('/app/settings') ||
    path.startsWith('/app/reviews') ||
    path.startsWith('/app/help-support')
  ) {
    return 'profile';
  }
  return 'discovery';
}

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentScreen = currentNavId(location.pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 pb-[env(safe-area-inset-bottom)] shadow-lg dark:shadow-gray-900/20">
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
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary-deep rounded-full flex items-center justify-center mb-1 shadow-[0_8px_24px_hsl(var(--primary)/0.24)]">
                  <Icon className="w-4 h-4 text-white" />
                </div>
              ) : (
                <Icon className="w-5 h-5 mb-1" />
              )}

              <span className="text-xs font-medium text-center">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
