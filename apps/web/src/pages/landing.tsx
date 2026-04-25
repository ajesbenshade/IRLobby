import AuthForm from '@/components/auth-form';
import PublicMetadata from '@/components/public-metadata';
import { useAuth } from '@/hooks/useAuth';
import { homepageFeatureHighlights, homepageSteps } from '@/lib/public-site-content';
import { ArrowRight, Heart, MessageCircle, Sparkles } from 'lucide-react';

export default function Landing() {
  const { handleAuthentication } = useAuth();

  // Create a wrapper function to handle authentication
  const handleAuth = async (token: string, userId: string) => {
    await handleAuthentication(token, userId);
  };

  return (
    <div className="public-site-bg min-h-screen text-white">
      <PublicMetadata
        title="IRLobby - Activity Matching That Gets You Out the Door"
        description="Discover real activities near you, match with people who want to do the same thing, and coordinate instantly."
        canonicalPath="/"
      />
      <section className="relative overflow-hidden px-6 pb-24 pt-24 sm:pt-28 lg:pb-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Now on the App Store
            </div>
            <h1 className="mt-6 font-display text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Get out. <br />
              Get together. <br />
              <span className="public-text-gradient">For real.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/72 sm:text-xl">
              Swipe on actual activities happening near you. Mutual interest unlocks chat so plans stop dying in the group text.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="#auth"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff2e63] px-8 py-4 text-base font-bold text-white shadow-[0_20px_60px_rgba(255,46,99,0.35)] transition hover:scale-[1.02] hover:bg-[#e01f52]"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/download"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
              >
                Download the app
              </a>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {homepageSteps.map((step) => (
                <article key={step.step} className="public-glass rounded-[24px] p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#ff2e63]/15 text-sm font-bold text-[#ff6b9a]">
                    {step.step}
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold text-white">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">{step.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-8 hidden rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.22)] lg:block">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#ff6b9a]" />
                Match celebration
              </div>
              <p className="mt-2 text-white/55">Mutual swipe unlocks chat instantly.</p>
            </div>
            <div className="absolute -right-8 bottom-14 hidden rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.22)] lg:block">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#ff6b9a]" />
                Real-time chat
              </div>
              <p className="mt-2 text-white/55">Context sticks to the activity.</p>
            </div>
            <div className="mx-auto flex h-[620px] max-w-[340px] flex-col rounded-[40px] border border-white/10 bg-[#11111a] p-4 shadow-[0_25px_100px_rgba(255,46,99,0.2)]">
              <div className="mx-auto h-6 w-32 rounded-full bg-black" />
              <div className="mt-5 flex items-center justify-between text-xs text-white/50">
                <span>9:41</span>
                <span>●●● 100%</span>
              </div>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Tonight near you</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">Rooftop sunset hang</h2>
              </div>
              <div className="mt-4 flex-1 rounded-[28px] bg-gradient-to-br from-amber-400 via-pink-500 to-fuchsia-700 p-4 shadow-xl">
                <div className="flex h-full flex-col justify-end rounded-[22px] bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                    Mission Dolores · 0.8 mi
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['chill', 'outdoors', 'tonight'].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/12 bg-white/15 px-3 py-1 text-xs font-medium text-white"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-center gap-4 pb-3">
                <button
                  type="button"
                  aria-label="Skip activity preview"
                  title="Skip activity preview"
                  className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/6 text-xl text-white/55"
                >
                  ✕
                </button>
                <button
                  type="button"
                  aria-label="Like activity preview"
                  title="Like activity preview"
                  className="grid h-14 w-14 place-items-center rounded-full bg-[#ff2e63] text-white shadow-[0_18px_45px_rgba(255,46,99,0.35)]"
                >
                  <Heart className="h-6 w-6 fill-current" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-7xl rounded-[36px] border border-white/8 bg-white/4 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.2)] sm:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#ff6b9a]">
                Why people use it
              </p>
              <h2 className="mt-4 font-display text-4xl font-black leading-tight text-white sm:text-5xl">
                Built to actually get you out the door.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">
                The product loop is simple: get a signal on your vibe, find something real nearby, and move straight into coordination.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {homepageFeatureHighlights.map((feature) => (
                  <article key={feature.title} className="public-glass public-card-hover rounded-[24px] p-5">
                    <div className="text-3xl">{feature.emoji}</div>
                    <h3 className="mt-3 font-display text-lg font-bold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/66">{feature.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div id="auth" className="scroll-mt-28">
              <div className="mb-4">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#ff6b9a]">
                  Join IRLobby
                </p>
                <h2 className="mt-3 font-display text-3xl font-black text-white">Create an account or jump back in.</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  The public website and the product shell now live in the same React app, so this is the fastest path from browse to join.
                </p>
              </div>
              <AuthForm onAuthenticated={handleAuth} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
