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
      <div className="public-phone-shadow rounded-[42px] border border-white/12 bg-[#0A0814] p-3">
        <div className="overflow-hidden rounded-[32px] bg-[#0A0814] text-[#F4F3FA]">
          <div className="flex items-center justify-between px-6 pt-5 text-xs font-semibold text-[#A5A1C2]">
            <span>9:41</span>
            <span>Tonight</span>
          </div>
          <div className="relative min-h-[690px] px-5 pb-5 pt-6">
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A5A1C2]">
                For you
              </p>
              <h2 className="mt-3 max-w-[260px] font-display text-3xl font-semibold leading-[1.05] text-[#F4F3FA]">
                Plans worth leaving for
              </h2>
              <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-[#A5A1C2]">
                Swipe through what is happening near you tonight.
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

            <div className="relative mt-6 overflow-hidden rounded-[28px] border border-[#E8C872]/40">
              <div className="h-72 bg-gradient-to-br from-[#5B4BFF] to-[#C026D3]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0A0814] via-[#0A0814]/80 to-transparent p-4">
                <div className="mb-2 flex gap-2">
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium">
                    rooftop
                  </span>
                  <span className="rounded-full border border-[#E8C872]/40 bg-[#E8C872]/15 px-3 py-1 text-[11px] font-medium text-[#E8C872]">
                    Ticket · $24
                  </span>
                </div>
                <h3 className="font-display text-xl font-semibold leading-tight">
                  Rooftop sunset hang
                </h3>
                <p className="mt-1 text-xs text-[#A5A1C2]">Downtown · Tonight, 7:30 PM</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="grid h-11 w-24 place-items-center rounded-full border border-white/12 text-sm font-medium text-[#F4F3FA]">
                Pass
              </span>
              <span className="grid h-11 w-24 place-items-center rounded-full bg-[#5B4BFF] text-sm font-medium text-white">
                I&apos;m down
              </span>
            </div>

            <div className="absolute bottom-5 left-5 right-5 rounded-[20px] border border-white/10 bg-[#161330]/92 px-4 py-3 backdrop-blur-xl">
              <div className="grid grid-cols-5 items-center gap-1 text-center text-[11px] font-medium text-[#7A7599]">
                <span className="text-[#5B4BFF]">Discover</span>
                <span>Events</span>
                <span className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-[#5B4BFF] text-white">
                  +
                </span>
                <span>Chat</span>
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
    <div className="public-site-bg min-h-screen overflow-hidden text-white">
      <PublicMetadata
        title="IRLobby - Real Plans Nearby"
        description="IRLobby helps you swipe through nearby activities, match with people who want the same plan, and coordinate instantly."
        canonicalPath="/"
      />

      <header className="relative z-20 px-6 pt-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-white/8 bg-[#0f172a]/52 px-4 py-3 shadow-2xl backdrop-blur-2xl sm:px-5">
          <Link to="/" className="flex shrink-0 items-center gap-3 font-display text-lg font-black">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_16px_42px_rgba(91,75,255,0.28)] ring-1 ring-white/12">
              <img src="/app-icon.png" alt="" className="h-full w-full object-cover" />
            </span>
            <span className="font-display">
              The Foyer
              <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal opacity-70">
                Franconia Mennonite Church
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-white/68 md:flex">
            <Link to="/how-it-works" className="transition hover:text-white">
              How it works
            </Link>
            <Link to="/features" className="transition hover:text-white">
              Features
            </Link>
            <Link to="/support" className="transition hover:text-white">
              Support
            </Link>
          </nav>
          <Link
            to="/download"
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-black text-[#0f172a] transition hover:scale-[1.02] sm:px-5"
          >
            Download
          </Link>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-12 sm:pt-16 lg:min-h-[calc(100vh-104px)] lg:pb-24">
        <div className="absolute left-1/2 top-0 h-px w-[82vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/7 px-4 py-2 text-sm font-bold text-white/78 shadow-2xl backdrop-blur-xl">
              <img
                src="/app-icon.png"
                alt=""
                className="h-7 w-7 rounded-xl bg-white object-cover"
              />
              <span>IRLobby for iPhone · Android testing underway</span>
            </div>

            <h1 className="mt-7 max-w-4xl font-display text-5xl font-black leading-[0.96] text-white sm:text-6xl lg:text-7xl">
              IRLobby turns swipes into <span className="public-text-gradient">actual plans.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/72 sm:text-xl">
              Discover real activities near you, match with people who want the same night out, and
              move straight into a chat that already knows the plan.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/download"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5B4BFF] px-7 py-4 text-base font-black text-white shadow-[0_22px_64px_rgba(91,75,255,0.34)] transition hover:scale-[1.02] hover:bg-[#4A3BE6]"
              >
                Download the app
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#auth"
                className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/7 px-7 py-4 text-base font-bold text-white transition hover:bg-white/12"
              >
                Create account
              </a>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <div
                  key={point.label}
                  className="rounded-[24px] border border-white/8 bg-white/6 p-4 backdrop-blur-xl"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                    {point.label}
                  </p>
                  <p className="mt-2 font-display text-xl font-black text-white">{point.value}</p>
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
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#5B4BFF]/16 text-[#C026D3]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-4xl font-black text-white/12">
                      0{index + 1}
                    </span>
                  </div>
                  <h2 className="mt-7 font-display text-2xl font-black text-white">{item.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/66">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[36px] border border-white/8 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-10 lg:grid-cols-[1fr_410px] lg:p-12">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#C026D3]">
              Why it feels different
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl font-black leading-tight text-white sm:text-5xl">
              Built for the moment you decide you do not want another night stuck scrolling.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {featureHighlights.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="rounded-[26px] border border-white/8 bg-[#0f172a]/38 p-5"
                  >
                    <Icon className="h-6 w-6 text-[#22d3ee]" />
                    <h3 className="mt-4 font-display text-lg font-black text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/62">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div id="auth" className="scroll-mt-28">
            <div className="mb-4 rounded-[28px] border border-white/8 bg-white/6 p-5">
              <div className="flex items-center gap-2 text-[#22d3ee]">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-[0.18em]">Join IRLobby</span>
              </div>
              <h2 className="mt-4 font-display text-3xl font-black text-white">
                Start with the same account on web and mobile.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/64">
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
