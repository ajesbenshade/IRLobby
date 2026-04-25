import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Bell, LogOut, Search, Settings, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface TopHeaderProps {
  onOpenCommandPalette: () => void;
}

export default function TopHeader({ onOpenCommandPalette }: TopHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || 'U';

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="hidden h-6 md:block" />

      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="hidden md:flex h-9 flex-1 max-w-md items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search activities, people, places…</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" aria-label="Notifications">
          <Link to="/app/notifications">
            <Bell className="h-5 w-5" />
          </Link>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-medium hover:ring-2 hover:ring-primary/40"
              aria-label="Open user menu"
            >
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.firstName ?? 'You'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1">
            <div className="px-2 py-2">
              <div className="text-sm font-medium leading-tight">
                {user?.firstName ?? 'Member'} {user?.lastName ?? ''}
              </div>
              {user?.email && (
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              )}
            </div>
            <Separator />
            <Link
              to="/app/profile"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <Link
              to="/app/settings"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Separator className="my-1" />
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
