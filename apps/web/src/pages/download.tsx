import PublicMetadata from '@/components/public-metadata';
import PublicSiteLayout, { PublicHeroHeader } from '@/components/public-site-layout';

export default function DownloadPage() {
  return (
    <PublicSiteLayout activePath="/download">
      <PublicMetadata
        title="Download IRLobby - iPhone App and Android Waitlist"
        description="Download IRLobby on the App Store, see platform requirements, and join the Android launch waitlist."
        canonicalPath="/download"
      />
      <PublicHeroHeader
        eyebrow="Download"
        title={
          <>
            Free. <br />
            <span className="public-text-gradient">On the App Store.</span>
          </>
        }
        description="IRLobby is iPhone-first today. Android is on the roadmap, and you can join the waitlist now."
      />

      <section className="px-6 pb-16">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4">
          <a
            href="https://apps.apple.com/app/id6759202702"
            className="inline-flex items-center gap-4 rounded-[24px] bg-white px-7 py-4 text-left text-[#0f172a] shadow-2xl transition hover:scale-[1.02]"
          >
            <span className="text-3xl"></span>
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide text-[#0f172a]/55">
                Download on the
              </span>
              <span className="block text-xl font-bold">App Store</span>
            </span>
          </a>
          <div className="inline-flex cursor-not-allowed items-center gap-4 rounded-[24px] border border-white/10 bg-white/5 px-7 py-4 text-left text-white/45">
            <span className="text-3xl">▶</span>
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide">Coming to</span>
              <span className="block text-xl font-bold">Google Play</span>
            </span>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          <article className="public-glass rounded-[28px] p-8">
            <h2 className="font-display text-2xl font-bold text-white">📱 Scan to install</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Point your iPhone camera at the App Store listing QR once it is live on the public
              website deployment.
            </p>
            <div className="mt-5 grid aspect-square place-items-center rounded-[24px] border border-white/8 bg-white/4 text-sm text-white/25">
              QR code
            </div>
          </article>
          <article className="public-glass rounded-[28px] p-8">
            <h2 className="font-display text-2xl font-bold text-white">⚙️ Requirements</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/70">
              <li>iPhone running iOS 17 or newer</li>
              <li>Location services for nearby activities</li>
              <li>Notifications recommended for matches and chats</li>
              <li>Free to download</li>
            </ul>
          </article>
          <article className="public-glass rounded-[28px] p-8">
            <h2 className="font-display text-2xl font-bold text-white">🧰 Need help?</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Having install trouble, login issues, or account access questions? The support team
              can help.
            </p>
            <a
              href="/support"
              className="mt-5 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/8 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Open support center
            </a>
          </article>
        </div>
        <p className="mt-10 text-center text-sm text-white/55">
          Want Android? Email{' '}
          <a
            href="mailto:hello@irlobby.com?subject=Android%20waitlist"
            className="text-[#ec4899] hover:underline"
          >
            hello@irlobby.com
          </a>{' '}
          to join the waitlist.
        </p>
      </section>
    </PublicSiteLayout>
  );
}
