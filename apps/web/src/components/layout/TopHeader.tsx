import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TopHeaderProps {
  onOpenCommandPalette: () => void;
  showSidebarTrigger?: boolean;
}

export default function TopHeader({ onOpenCommandPalette, showSidebarTrigger = false }: TopHeaderProps) {
  const { user } = useAuth();

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || 'U';

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/90 px-4 backdrop-blur-xl">
      {showSidebarTrigger ? <SidebarTrigger className="-ml-1 hidden md:flex" /> : null}
      <Link to="/app" className="flex min-w-0 flex-col">
        <span className="font-display text-[22px] font-bold leading-none text-foreground md:text-[26px]">
          The Foyer
        </span>
        <span className="truncate text-[11px] text-muted-foreground">Franconia Mennonite Church</span>
      </Link>
      <Separator orientation="vertical" className="hidden h-6 md:block" />

      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="hidden md:flex h-10 flex-1 max-w-md items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 text-sm text-muted-foreground transition-colors duration-fast hover:bg-muted/50"
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

        <Link
          to="/app/profile"
          className="ml-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-[#f9e8ee] text-sm font-semibold text-[#a2033f] hover:ring-2 hover:ring-primary/40"
          aria-label="Profile"
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
        </Link>
      </div>
    </header>
  );
}
