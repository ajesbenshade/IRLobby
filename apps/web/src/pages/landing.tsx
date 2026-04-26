import AuthForm from '@/components/auth-form';
import PublicMetadata from '@/components/public-metadata';
import { useAuth } from '@/hooks/useAuth';
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
import { Link } from 'react-router-dom';

const activityTags = ['tonight', 'low-key', '0.8 mi'];

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
      <div className="public-phone-shadow rounded-[42px] border border-white/12 bg-[#f7f7fa] p-3">
        <div className="overflow-hidden rounded-[32px] bg-[#f7f7fa] text-[#0b0b14]">
          <div className="flex items-center justify-between px-6 pt-5 text-xs font-bold">
            <span>9:41</span>
            <span className="rounded-full bg-[#0b0b14] px-2 py-0.5 text-white">100</span>
          </div>
          <div className="relative min-h-[690px] px-5 pb-5 pt-8">
            <div className="absolute -right-28 -top-24 h-64 w-64 rounded-full bg-[#ffe0ea]" />
            <div className="absolute -left-28 top-24 h-52 w-52 rounded-full bg-[#fff4c2]" />
            <div className="absolute -right-28 bottom-20 h-56 w-56 rounded-full bg-[#cff7fe]" />

            <div className="relative">
              <p className="text-sm font-extrabold text-[#ff2e63]">For you</p>
              <h2 className="mt-4 max-w-[260px] font-display text-4xl font-black leading-[0.98] text-[#0b0b14]">
                Plans worth leaving for
              </h2>
              <p className="mt-4 max-w-[260px] text-base leading-relaxed text-[#5b5b6b]">
                Swipe through what is happening near you tonight.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full border border-[#ececf1] bg-white/72 px-4 py-2 text-sm font-bold text-[#ff2e63] shadow-sm">
                  Vibe filters
                </span>
                <span className="rounded-full border border-[#ececf1] bg-white/72 px-4 py-2 text-sm font-bold text-[#ff2e63] shadow-sm">
                  Map view
                </span>
              </div>
            </div>

            <div className="relative mt-8 rounded-[30px] bg-[#0b0b14] p-4 text-white shadow-[0_26px_60px_rgba(11,11,20,0.18)]">
              <div className="rounded-[24px] bg-gradient-to-br from-[#fcd34d] via-[#ff2e63] to-[#22d3ee] p-[1px]">
                <div className="rounded-[23px] bg-[#15151f]/86 p-4 backdrop-blur">
                  <div className="flex items-center justify-between text-xs text-white/58">
                    <span>Tonight · 7:30 PM</span>
                    <span>live now</span>
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-black leading-tight">
                    Rooftop sunset hang
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/66">
                    Casual drinks, city views, and people who actually want to make plans.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activityTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-full border border-white/12 bg-white/8 text-lg text-white/52">
                  x
                </span>
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#ff2e63] text-3xl font-light text-white shadow-[0_18px_44px_rgba(255,46,99,0.38)]">
                  +
                </span>
              </div>
            </div>

            <div className="absolute bottom-5 left-5 right-5 rounded-[28px] border border-[#ececf1] bg-white/88 px-4 py-3 shadow-[0_18px_50px_rgba(11,11,20,0.12)] backdrop-blur-xl">
              <div className="grid grid-cols-5 items-end gap-1 text-center text-[11px] font-bold text-[#9a9aa8]">
                <span className="text-[#ff2e63]">Discover</span>
                <span>Events</span>
                <span className="mx-auto grid h-12 w-12 -translate-y-3 place-items-center rounded-full bg-[#ff2e63] text-3xl font-light text-white shadow-[0_14px_32px_rgba(255,46,99,0.34)]">
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
  const { handleAuthentication } = useAuth();

  const handleAuth = async (token: string, userId: string) => {
    await handleAuthentication(token, userId);
  };

  return (
    <div className="public-site-bg min-h-screen overflow-hidden text-white">
      <PublicMetadata
        title="IRLobby - Real Plans Nearby"
        description="IRLobby helps you swipe through nearby activities, match with people who want the same plan, and coordinate instantly."
        canonicalPath="/"
      />

      <header className="relative z-20 px-6 pt-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-white/8 bg-[#0b0b14]/52 px-4 py-3 shadow-2xl backdrop-blur-2xl sm:px-5">
          <Link to="/" className="flex shrink-0 items-center gap-3 font-display text-lg font-black">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_16px_42px_rgba(255,46,99,0.28)] ring-1 ring-white/12">
              <img src="/app-icon.png" alt="" className="h-full w-full object-cover" />
            </span>
            <span>IRLobby</span>
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
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-black text-[#0b0b14] transition hover:scale-[1.02] sm:px-5"
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
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff2e63] px-7 py-4 text-base font-black text-white shadow-[0_22px_64px_rgba(255,46,99,0.34)] transition hover:scale-[1.02] hover:bg-[#d6004f]"
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
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff2e63]/16 text-[#ff6b9a]">
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
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#ff6b9a]">
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
                    className="rounded-[26px] border border-white/8 bg-[#0b0b14]/38 p-5"
                  >
                    <Icon className="h-6 w-6 text-[#fcd34d]" />
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
            <AuthForm onAuthenticated={handleAuth} />
          </div>
        </div>
      </section>
    </div>
  );
}
