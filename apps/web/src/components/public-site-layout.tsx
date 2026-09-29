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
    <span className="flex items-center gap-3 text-[#222222]">
      <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-[#e1dbd7]">
        <img src="/app-icon.png" alt="" className="h-full w-full object-cover" />
      </span>
      <span className="flex flex-col">
        <span className="font-display text-[22px] font-bold leading-none">The Foyer</span>
        <span className="text-[11px] text-[#6e6a68]">Franconia Mennonite Church</span>
      </span>
    </span>
  );
}

function PublicNav({ activePath }: { activePath?: string }) {
  const { isAuthenticated } = useAuth();

  return (
    <nav className="sticky top-0 z-40 border-b border-[#e1dbd7] bg-[#f6f1ee]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="shrink-0">
          <PublicWordmark />
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium text-[#6e6a68] md:flex">
          {publicNavLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'transition hover:text-[#a2033f]',
                  activePath === link.to || isActive ? 'text-[#a2033f]' : 'text-[#6e6a68]',
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
              className="rounded-full bg-[#a2033f] px-5 text-white hover:bg-[#7c0230]"
            >
              <Link to="/app">Open app</Link>
            </Button>
          ) : (
            <Button
              asChild
              className="rounded-full bg-[#a2033f] px-5 text-white hover:bg-[#7c0230]"
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
    <footer className="border-t border-[#e1dbd7] py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-3 text-[#222222]">
          <PublicWordmark />
          <span className="text-sm font-normal text-[#6e6a68]">© 2026</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-[#6e6a68]">
          {footerLinks.map((link) => (
            <Link key={link.to} to={link.to} className="transition hover:text-[#a2033f]">
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
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#a2033f]">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-5xl font-black leading-[1.03] tracking-tight text-[#222222] sm:text-6xl md:text-7xl">
          {title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6e6a68] sm:text-xl">
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
    <div className={cn('min-h-screen text-[#222222]', pageBackgroundClassName ?? 'public-page-bg')}>
      <PublicNav activePath={activePath} />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
