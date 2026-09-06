import PublicMetadata from '@/components/public-metadata';
import PublicSiteLayout, { PublicHeroHeader } from '@/components/public-site-layout';

export default function PrivacyPolicy() {
  return (
    <PublicSiteLayout activePath="/privacy">
      <PublicMetadata
        title="IRLobby Privacy Policy"
        description="How IRLobby collects and uses account, location, chat, and diagnostic data, and how to export or delete your account."
        canonicalPath="/privacy"
      />
      <PublicHeroHeader
        eyebrow="Privacy"
        title={<>Privacy Policy</>}
        description="Last updated: September 2, 2026"
      />

      <section className="px-6 pb-24">
        <div className="prose prose-invert prose-headings:font-display prose-headings:text-white prose-p:text-white/75 prose-li:text-white/75 mx-auto max-w-4xl rounded-[32px] border border-white/8 bg-white/95 p-8 text-slate-900 shadow-[0_25px_100px_rgba(0,0,0,0.22)] sm:p-10 prose-h2:text-slate-900 prose-h3:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              IRLobby (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is an activity-first
              social matching product. Users create accounts, discover nearby activities, match
              with people who want the same plan, and chat to coordinate. This policy describes how
              we handle information in the iOS app (bundle com.irlobby.app), the website, and the
              api.irlobby.com backend.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">2. Information we collect</h2>

            <h3 className="text-xl font-medium mb-2">2.1 Account and profile</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Email address, password (stored hashed), display name, and username</li>
              <li>
                Profile photo and optional activity photos you upload (camera or photo library, only
                when you choose to upload)
              </li>
              <li>Vibe-quiz answers and activity preferences used to rank nearby plans</li>
              <li>Legal acceptance timestamps when you accept the terms and this policy</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">2.2 Location</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              With permission, the mobile app reads location while it is in use so we can show
              activities near you. iOS uses a while-using prompt. We do not request always-on
              background location in the current app. You can deny or later disable location in
              system settings; discovery quality drops because nearby ranking is core to the
              product.
            </p>

            <h3 className="text-xl font-medium mb-2">2.3 Activity, matching, and chat</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>
                Activities you host or join (title, description, time, place, coordinates when
                provided, tags, capacity, images)
              </li>
              <li>Swipes, matches, and reviews (ratings and comments)</li>
              <li>
                Chat messages between matched users, stored on the IRLobby backend so history works
                across devices. We do not send message bodies to a third-party chat vendor.
              </li>
              <li>Block and report submissions used for moderation</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">2.4 Optional sign-in, payments, diagnostics</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>
                Apple, Google, or X (Twitter) identifiers and profile fields if you use that
                sign-in
              </li>
              <li>
                Stripe identifiers for paid activities only. We do not store full card numbers on
                IRLobby servers.
              </li>
              <li>Crash and performance diagnostics via Sentry when configured</li>
              <li>Expo push tokens when you enable notifications</li>
              <li>Website authentication cookies, including a refresh cookie</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">3. How we use it</h2>
            <ul className="list-disc pl-6 text-gray-700">
              <li>Create and authenticate your account</li>
              <li>Operate discovery, matching, chat, reviews, and activity hosting</li>
              <li>Show map tiles for nearby activities (Mapbox)</li>
              <li>Prevent abuse and review reports</li>
              <li>Send transactional email such as password reset when SMTP is configured</li>
              <li>Debug crashes and improve reliability</li>
              <li>Process paid-activity payments through Stripe when that feature is used</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              We do not use your data to run third-party advertising networks, and we do not sell
              personal information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">4. Sharing</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We share information only as needed to run the product: other users (profile and
              activity details required to match and chat), our hosting provider, Sentry, Mapbox,
              Stripe for paid activities, Apple/Google/X if you use that sign-in, and the SMTP
              provider for transactional mail. We may also share information when required by law
              or to protect people from abuse.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">5. Your choices</h2>
            <ul className="list-disc pl-6 text-gray-700">
              <li>
                Export: Settings includes an export that returns a JSON copy of profile, hosted
                activities, participations, swipes, matches, and reviews.
              </li>
              <li>
                Delete account: Settings → Delete account permanently removes the user record and
                associated data. This cannot be undone.
              </li>
              <li>Location: iOS Settings → Privacy → Location Services → IRLobby</li>
              <li>Notifications: disable in the app settings and/or iOS notification settings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">6. Children</h2>
            <p className="text-gray-700 leading-relaxed">
              IRLobby is a social networking product rated 17+ on the App Store. It is not directed
              at children under 17, and we do not knowingly collect personal information from them.
              If you believe a person under 17 has an account, email us and we will delete it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">7. Changes</h2>
            <p className="text-gray-700 leading-relaxed">
              We will update the date at the top when this policy changes. Material changes will
              also be posted on this page.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-4">8. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              Privacy and support requests:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="text-gray-700">
                <strong>Email:</strong>{' '}
                <a href="mailto:support@irlobby.com" className="text-primary hover:underline">
                  support@irlobby.com
                </a>
                <br />
                <strong>Operator:</strong>{' '}
                <a href="mailto:ajesbenshade@gmail.com" className="text-primary hover:underline">
                  ajesbenshade@gmail.com
                </a>
              </p>
            </div>
          </section>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
