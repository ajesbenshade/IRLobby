import BottomNavigation from '@/components/BottomNavigation';
import CommandPalette from '@/components/layout/CommandPalette';
import SideNavigation from '@/components/layout/SideNavigation';
import TopHeader from '@/components/layout/TopHeader';
import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface AppShellProps {
  children: ReactNode;
}

// Adaptive shell. Below md: full-bleed phone shell with bottom tabs and iOS
// safe-area insets. md+: fixed sidebar + fluid main pane (no phone column).
export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Hide bottom nav inside chat threads
  const hideBottomNav = location.pathname.includes('/chat');

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <SideNavigation />
      <div className="relative min-h-[100dvh] min-w-0 overflow-x-hidden md:pl-60">
        <TopHeader onOpenCommandPalette={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full sm:max-w-[560px] md:max-w-[720px] lg:max-w-[1120px]">
          {children}
        </main>
        {!hideBottomNav && <BottomNavigation />}
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </div>
  );
}
