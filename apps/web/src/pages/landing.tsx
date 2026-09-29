import AuthForm from '@/components/auth-form';
import PublicMetadata from '@/components/public-metadata';
import { useAuth } from '@/hooks/useAuth';
import { getSafePostAuthRedirect } from '@/lib/authRouting';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Compass,
  MessageCircle,
  ShieldCheck,
  UsersRound,
  Zap,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const proofPoints = [
  { label: 'Vibe Quiz', value: '5 questions' },
  { label: 'Discovery', value: 'plans nearby' },
  { label: 'Matches', value: 'chat unlocks' },
];

const productLoop = [
  {
    icon: Zap,
    title: 'Tune your vibe',
    description: 'Five quick prompts shape the feed without turning onboarding into homework.',
  },
  {
    icon: Compass,
    title: 'Swipe real plans',
    description:
      'Cards lead with the activity, timing, distance, and energy so decisions feel easy.',
  },
  {
    icon: MessageCircle,
    title: 'Match into chat',
    description: 'Mutual interest opens a focused thread with the plan already attached.',
  },
];

const featureHighlights = [
  {
    icon: CalendarDays,
    title: 'Activity-first discovery',
    description:
      'Rooftops, hikes, game nights, deep conversations. You swipe on what you actually want to do.',
  },
  {
    icon: UsersRound,
    title: 'Built for momentum',
    description:
      'The match moment pushes straight toward coordination instead of endless app chatter.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety stays nearby',
    description:
      'Reporting, blocking, and account controls remain close to the places people interact.',
  },
];

function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[342px] sm:max-w-[380px] lg:max-w-[404px]">
      <div className="public-phone-shadow rounded-[42px] border border-[#e1dbd7] bg-[#f6f1ee] p-3">
        <div className="overflow-hidden rounded-[32px] bg-[#f6f1ee] text-[#222222]">
          <div className="flex items-center justify-between px-6 pt-5 text-xs font-semibold text-[#6e6a68]">
            <span>9:41</span>
            <span>Tonight</span>
          </div>
          <div className="relative min-h-[690px] px-5 pb-5 pt-6">
            <div className="relative">
              <p className="font-display text-[22px] font-bold leading-none text-[#222222]">The Foyer</p>
              <p className="mt-1 text-[11px] text-[#6e6a68]">Franconia Mennonite Church</p>
              <h2 className="mt-4 max-w-[260px] font-display text-[25px] font-bold leading-[1.1] text-[#222222]">
                Gatherings near you
              </h2>
              <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-[#6e6a68]">
                Swipe to pass, or say you’re going.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#F4F3FA]">
                  Tonight
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#A5A1C2]">
                  Filters
                </span>
              </div>
            </div>

            <div className="relative mt-6 overflow-hidden rounded-[22px] border border-[#e1dbd7]">
              <div className="h-72 bg-gradient-to-br from-[#a2033f] to-[#7c0230]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#222222] via-[#222222]/80 to-transparent p-4 text-[#222222]">
                <div className="mb-2 flex gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium">
                    fellowship
                  </span>
                </div>
                <h3 className="font-display text-xl font-semibold leading-tight">
                  Rooftop sunset hang
                </h3>
                <p className="mt-1 text-xs text-[#A5A1C2]">Downtown · Tonight, 7:30 PM</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="grid h-11 w-24 place-items-center rounded-full border border-[#e1dbd7] bg-white text-sm font-medium text-[#222222]">
                Pass
              </span>
              <span className="grid h-[54px] w-28 place-items-center rounded-full bg-[#a2033f] px-5 text-sm font-medium text-white">
                I&apos;m going
              </span>
            </div>

            <div className="absolute bottom-5 left-5 right-5 rounded-[16px] border border-[#e1dbd7] bg-white px-3 py-3 shadow-sm">
              <div className="grid grid-cols-4 items-center gap-1 text-center text-[11px] font-medium text-[#6e6a68]">
                <span className="text-[#a2033f]">Discover</span>
                <span>Gatherings</span>
                <span className="text-[#a2033f]">Host</span>
                <span>Profile</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { handleAuthentication, loginWithGoogleIdToken, loginWithAppleIdentityToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const postAuthRedirect = () =>
    navigate(getSafePostAuthRedirect(searchParams.get('redirect')), { replace: true });

  const handleAuth = async (token: string, userId: string) => {
    await handleAuthentication(token, userId);
    postAuthRedirect();
  };

  return (
    <div className="public-site-bg min-h-screen overflow-hidden text-[#222222]">
      <PublicMetadata
        title="The Foyer — Franconia Mennonite Church"
        description="The Foyer is the gatherings app for Franconia Mennonite Church."
        canonicalPath="/"
      />

      <header className="relative z-20 px-6 pt-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-[#e1dbd7] bg-white px-4 py-3 shadow-sm sm:px-5">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-[#e1dbd7]">
              <img src="/app-icon.png" alt="" className="h-full w-full object-cover" />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-[22px] font-bold leading-none">The Foyer</span>
              <span className="text-[11px] text-[#6e6a68]">Franconia Mennonite Church</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#6e6a68] md:flex">
            <Link to="/how-it-works" className="transition hover:text-[#a2033f]">
              How it works
            </Link>
            <Link to="/features" className="transition hover:text-[#a2033f]">
              Features
            </Link>
            <Link to="/support" className="transition hover:text-[#a2033f]">
              Support
            </Link>
          </nav>
          <Link
            to="/download"
            className="inline-flex h-[54px] items-center justify-center rounded-full bg-[#a2033f] px-5 text-sm font-semibold text-white transition hover:bg-[#7c0230] sm:px-5"
          >
            Download
          </Link>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-12 sm:pt-16 lg:min-h-[calc(100vh-104px)] lg:pb-24">
        <div className="absolute left-1/2 top-0 h-px w-[82vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#e1dbd7] bg-white px-4 py-2 text-sm font-semibold text-[#6e6a68]">
              <img
                src="/app-icon.png"
                alt=""
                className="h-7 w-7 rounded-xl bg-white object-cover"
              />
              <span>The Foyer for Franconia Mennonite Church</span>
            </div>

            <h1 className="mt-7 max-w-4xl font-display text-5xl font-bold leading-[0.96] text-[#222222] sm:text-6xl lg:text-7xl">
              The Foyer turns swipes into <span className="public-text-gradient">gatherings.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#6e6a68] sm:text-xl">
              See gatherings at Franconia Mennonite Church, say you’re going, and coordinate with the people who are coming too.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/download"
                className="inline-flex h-[54px] items-center justify-center gap-2 rounded-full bg-[#a2033f] px-5 text-base font-semibold text-white transition hover:bg-[#7c0230]"
              >
                Download the app
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#auth"
                className="inline-flex h-[54px] items-center justify-center rounded-full border border-[#e1dbd7] bg-white px-5 text-base font-semibold text-[#222222] transition hover:bg-[#f9e8ee]"
              >
                Create account
              </a>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <div
                  key={point.label}
                  className="rounded-[22px] border border-[#e1dbd7] bg-white p-4"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a09b98]">
                    {point.label}
                  </p>
                  <p className="mt-2 font-display text-xl font-bold text-[#222222]">{point.value}</p>
                </div>
              ))}
            </div>
          </div>

          <PhonePreview />
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {productLoop.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="public-glass public-card-hover rounded-[28px] p-6 sm:p-7"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f9e8ee] text-[#a2033f]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-4xl font-bold text-[#a2033f]/20">
                      0{index + 1}
                    </span>
                  </div>
                  <h2 className="mt-7 font-display text-[25px] font-bold text-[#222222]">{item.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#6e6a68]">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[22px] border border-[#e1dbd7] bg-white p-6 shadow-sm sm:p-10 lg:grid-cols-[1fr_410px] lg:p-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#a2033f]">
              Why it feels different
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight text-[#222222] sm:text-5xl">
              Built for the moment you decide you do not want another night stuck scrolling.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {featureHighlights.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="rounded-[16px] border border-[#e1dbd7] bg-[#f6f1ee] p-5"
                  >
                    <Icon className="h-6 w-6 text-[#a2033f]" />
                    <h3 className="mt-4 font-display text-[25px] font-bold text-[#222222]">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#6e6a68]">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div id="auth" className="scroll-mt-28">
            <div className="mb-4 rounded-[22px] border border-[#e1dbd7] bg-[#f9e8ee] p-5">
              <div className="flex items-center gap-2 text-[#a2033f]">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-bold uppercase tracking-[0.18em]">Join The Foyer</span>
              </div>
              <h2 className="mt-4 font-display text-[25px] font-bold text-[#222222]">
                Start with the same account on web and mobile.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#6e6a68]">
                Create an account here or jump back in before opening the app.
              </p>
            </div>
            <AuthForm
              onAuthenticated={handleAuth}
              loginWithGoogleIdToken={loginWithGoogleIdToken}
              loginWithAppleIdentityToken={loginWithAppleIdentityToken}
              onOAuthSuccess={postAuthRedirect}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
