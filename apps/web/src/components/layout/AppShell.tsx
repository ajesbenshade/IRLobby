import BottomNavigation from '@/components/BottomNavigation';
import CommandPalette from '@/components/layout/CommandPalette';
import TopHeader from '@/components/layout/TopHeader';
import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface AppShellProps {
  children: ReactNode;
}

// Phone-width column at every viewport size; on wide screens it is centered
// with a quiet backdrop so the app never stretches into a desktop dashboard.
export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Hide bottom nav inside chat threads
  const hideBottomNav = location.pathname.includes('/chat');

  return (
    <div className="min-h-[100dvh] w-full bg-[#ece6e2]">
      <div className="relative mx-auto min-h-[100dvh] w-full max-w-[480px] overflow-x-hidden bg-background sm:shadow-xl">
        <TopHeader onOpenCommandPalette={() => setPaletteOpen(true)} />
        {children}
        {!hideBottomNav && <BottomNavigation />}
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </div>
  );
}
