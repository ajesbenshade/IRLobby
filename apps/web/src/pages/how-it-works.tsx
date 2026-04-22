import PublicMetadata from '@/components/public-metadata';
import PublicSiteLayout, { PublicHeroHeader } from '@/components/public-site-layout';
import { howItWorksSteps } from '@/lib/public-site-content';

export default function HowItWorksPage() {
  return (
    <PublicSiteLayout activePath="/how-it-works">
      <PublicMetadata
        title="How IRLobby Works - From Match to Real Meetup"
        description="See the IRLobby flow: vibe quiz, swipe nearby activities, then coordinate in chat when interest is mutual."
        canonicalPath="/how-it-works"
      />
      <PublicHeroHeader
        eyebrow="How it works"
        title={
          <>
            From scroll-paralysis to <span className="public-text-gradient">actual plans.</span>
          </>
        }
        description="IRLobby cuts the back-and-forth. Tell it your vibe, swipe real activities near you, and coordinate the moment interest is mutual."
      />

      <section className="pb-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6">
          {howItWorksSteps.map((step, index) => (
            <article
              key={step.step}
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12"
            >
              <div className={index % 2 === 1 ? 'md:order-2' : undefined}>
                <div className="inline-flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff2e63]/15 text-lg font-bold text-[#ff6b9a]">
                    {step.step}
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-[0.25em] text-[#ff6b9a]">
                    {step.label}
                  </span>
                </div>
                <h2 className="mt-6 font-display text-4xl font-black leading-tight text-white sm:text-5xl">
                  {step.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-white/70">{step.description}</p>
                <ul className="mt-6 space-y-3 text-white/70">
                  {step.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="text-[#ff6b9a]">●</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={
                  index % 2 === 1
                    ? 'public-glass public-card-hover md:order-1 grid aspect-square place-items-center rounded-[32px] text-8xl'
                    : 'public-glass public-card-hover grid aspect-square place-items-center rounded-[32px] text-8xl'
                }
              >
                {step.emoji}
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicSiteLayout>
  );
}
