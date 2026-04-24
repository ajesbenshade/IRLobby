import BottomNavigation from '@/components/BottomNavigation';
import AppSidebar from '@/components/layout/AppSidebar';
import CommandPalette from '@/components/layout/CommandPalette';
import RightRail from '@/components/layout/RightRail';
import TopHeader from '@/components/layout/TopHeader';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Hide bottom nav inside chat threads on mobile (preserves prior behavior)
  const hideBottomNav = location.pathname.includes('/chat/');

  if (isMobile) {
    return (
      <div className="w-full bg-white min-h-screen relative overflow-hidden">
        {children}
        {!hideBottomNav && <BottomNavigation />}
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="flex min-h-screen flex-col">
        <TopHeader onOpenCommandPalette={() => setPaletteOpen(true)} />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-6">
              {children}
            </div>
          </main>
          <RightRail />
        </div>
      </SidebarInset>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  );
}
