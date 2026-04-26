import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { footerLinks, publicNavLinks } from '@/lib/public-site-content';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

type PublicSiteLayoutProps = {
  children: ReactNode;
  activePath?: string;
  pageBackgroundClassName?: string;
};

function PublicWordmark() {
  return (
    <span className="flex items-center gap-3 font-display text-lg font-black tracking-tight text-white">
      <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_16px_42px_rgba(255,46,99,0.28)] ring-1 ring-white/12">
        <img src="/app-icon.png" alt="" className="h-full w-full object-cover" />
      </span>
      <span className="leading-none">IRLobby</span>
    </span>
  );
}

function PublicNav({ activePath }: { activePath?: string }) {
  const { isAuthenticated } = useAuth();

  return (
    <nav className="sticky top-0 z-40 border-b border-white/8 bg-[#0b0b14]/76 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="shrink-0">
          <PublicWordmark />
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium text-white/72 md:flex">
          {publicNavLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'transition hover:text-white',
                  activePath === link.to || isActive ? 'text-white' : 'text-white/72',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Button
              asChild
              className="rounded-full bg-[#ff2e63] px-5 text-white hover:bg-[#e01f52]"
            >
              <Link to="/app">Open app</Link>
            </Button>
          ) : (
            <Button
              asChild
              className="rounded-full bg-[#ff2e63] px-5 text-white hover:bg-[#e01f52]"
            >
              <a href="/#auth">Get started</a>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-3 text-white">
          <PublicWordmark />
          <span className="text-sm font-normal text-white/40">© 2026</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-white/60">
          {footerLinks.map((link) => (
            <Link key={link.to} to={link.to} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function PublicHeroHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <section className="px-6 pb-16 pt-20 text-center sm:pt-24">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#ff6b9a]">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-5xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl md:text-7xl">
          {title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
          {description}
        </p>
      </div>
    </section>
  );
}

export default function PublicSiteLayout({
  children,
  activePath,
  pageBackgroundClassName,
}: PublicSiteLayoutProps) {
  return (
    <div className={cn('min-h-screen text-white', pageBackgroundClassName ?? 'public-page-bg')}>
      <PublicNav activePath={activePath} />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
