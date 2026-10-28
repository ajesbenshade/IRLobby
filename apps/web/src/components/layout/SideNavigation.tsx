import { currentNavId, navItems } from '@/components/BottomNavigation';
import { HelpCircle, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const linkClass = (active: boolean) =>
  `flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
    active
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
  }`;

// Desktop/tablet navigation (md+). Same four primary destinations as the phone
// tab bar; Notifications stays a header icon, not a sidebar peer.
export default function SideNavigation() {
  const { pathname } = useLocation();
  const current = currentNavId(pathname);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/60 bg-card px-3 py-6 md:flex">
      <Link to="/app" className="mb-6 px-3 font-display text-[26px] font-bold text-foreground">
        The Foyer
      </Link>
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.route}
              aria-current={current === item.id ? 'page' : undefined}
              className={linkClass(current === item.id)}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <nav
        aria-label="Secondary"
        className="mt-auto flex flex-col gap-1 border-t border-border/60 pt-3"
      >
        <Link to="/app/settings" className={linkClass(pathname.startsWith('/app/settings'))}>
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <Link
          to="/app/help-support"
          className={linkClass(pathname.startsWith('/app/help-support'))}
        >
          <HelpCircle className="h-5 w-5" />
          Help
        </Link>
      </nav>
    </aside>
  );
}
