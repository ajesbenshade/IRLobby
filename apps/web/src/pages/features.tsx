import PublicMetadata from '@/components/public-metadata';
import PublicSiteLayout, { PublicHeroHeader } from '@/components/public-site-layout';
import { featureCards } from '@/lib/public-site-content';

export default function FeaturesPage() {
  return (
    <PublicSiteLayout activePath="/features">
      <PublicMetadata
        title="IRLobby Features - Activity-First Social Matching"
        description="Explore the product features behind IRLobby: vibe quiz onboarding, activity-first discovery, real-time chat, and safety controls."
        canonicalPath="/features"
      />
      <PublicHeroHeader
        eyebrow="Features"
        title={
          <>
            Every detail tuned for{' '}
            <span className="public-text-gradient">getting out the door.</span>
          </>
        }
        description="No endless feeds, no algorithm rabbit holes. Just a tight loop: find something real, match, coordinate, and go."
      />

      <section className="pb-12">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2">
          {featureCards.map((feature) => (
            <article
              key={feature.title}
              className="public-glass public-card-hover rounded-[28px] p-8 sm:p-10"
            >
              <div className="text-5xl">{feature.emoji}</div>
              <h2 className="mt-5 font-display text-2xl font-bold text-white">{feature.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-white/70">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-4xl font-black text-white sm:text-5xl">
            See it in action.
          </h2>
          <a
            href="/download"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-8 py-4 text-base font-bold text-white transition hover:scale-[1.02] hover:bg-[#6d28d9]"
          >
            Get IRLobby
          </a>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
